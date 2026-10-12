const N = 7;
const STEP = 1 / 120;
const TENSION = 0.03;
const MAX_DT = 0.05;
const GL_DIV = 6;
const FRAME_MS = 1000 / 30;
const CANVAS_DIV = 8;
const STILL_SECONDS = 11;

type Blob = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	color: number;
	a: number;
	va: number;
	ax: number;
	ay: number;
	home: [number, number];
	amp: [number, number];
	freq: [number, number];
	phase: [number, number];
};

type World = { blobs: Blob[]; t: number; w: number; h: number; linked: boolean[] };

declare global {
	interface Window {
		__bg?: { mode: "webgl" | "2d" | "off"; frameMs: number; frames: number; merges: number; pinches: number };
	}
}

function rng(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hex(v: string): [number, number, number] {
	const m = v.trim().replace("#", "");
	return [0, 2, 4].map((i) => Number.parseInt(m.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function createWorld(w: number, h: number): World {
	const rand = rng(20251013);
	const blobs: Blob[] = [];
	const cols = w >= h ? 4 : 2;
	const rows = Math.ceil(N / cols);
	for (let i = 0; i < N; i++) {
		const hx = 0.14 + 0.72 * (((i % cols) + 0.5 + (rand() - 0.5) * 0.5) / cols);
		const hy = 0.16 + 0.68 * ((Math.floor(i / cols) + 0.5 + (rand() - 0.5) * 0.5) / rows);
		blobs.push({
			x: hx * w,
			y: hy * h,
			vx: 0,
			vy: 0,
			r: 0.075 + 0.045 * rand(),
			color: i % 3,
			a: 0,
			va: 0,
			ax: 1,
			ay: 0,
			home: [hx, hy],
			amp: [(0.5 + 0.5 * rand()) * (0.6 / cols), (0.5 + 0.5 * rand()) * (0.6 / rows)],
			freq: [0.22 + 0.25 * rand(), 0.18 + 0.22 * rand()],
			phase: [rand() * 6.283, rand() * 6.283],
		});
	}
	return { blobs, t: 0, w, h, linked: new Array(N * N).fill(false) };
}

/** 2つの液滴だけの場 r1²/d1² + r2²/d2² が中心線上で最小になる点でちょうど 1 になる距離。これより近いと首でつながる */
const neckDistance = (r1: number, r2: number) => (r1 ** (2 / 3) + r2 ** (2 / 3)) ** 1.5;

function step(world: World, dt: number, stats: { merges: number; pinches: number }) {
	const { blobs, w, h } = world;
	world.t += dt;
	const t = world.t;
	const fx = new Float64Array(N);
	const fy = new Float64Array(N);
	for (let i = 0; i < N; i++) {
		const b = blobs[i];
		const tx = (b.home[0] + b.amp[0] * Math.sin(b.freq[0] * t + b.phase[0])) * w;
		const ty = (b.home[1] + b.amp[1] * Math.sin(b.freq[1] * t + b.phase[1])) * h;
		fx[i] += 0.55 * (tx - b.x) - 1.1 * b.vx;
		fy[i] += 0.55 * (ty - b.y) - 1.1 * b.vy;
	}
	for (let i = 0; i < N; i++) {
		for (let j = i + 1; j < N; j++) {
			const p = blobs[i];
			const q = blobs[j];
			const dx = q.x - p.x;
			const dy = q.y - p.y;
			const d = Math.hypot(dx, dy) || 1e-6;
			const ux = dx / d;
			const uy = dy / d;
			const reach = neckDistance(p.r, q.r);
			const k = i * N + j;
			const was = world.linked[k];
			// ちぎれる距離をつながる距離より少し遠くにして、境目で付いたり離れたりを繰り返さないようにする
			const linked = was ? d < reach * 1.08 : d < reach;
			let pull = 0;
			if (linked) {
				// 表面張力の引き合いを距離に比例させると、くっついた液滴がばねに勝って二度とちぎれず、最後は全部が1つの塊になる
				pull = TENSION * Math.min(1, d / reach + 0.25);
				const rvx = q.vx - p.vx;
				const rvy = q.vy - p.vy;
				fx[i] += 0.3 * rvx;
				fy[i] += 0.3 * rvy;
				fx[j] -= 0.3 * rvx;
				fy[j] -= 0.3 * rvy;
			} else if (d < reach * 2.4) {
				pull = 0.012 * (1 - d / (reach * 2.4));
			}
			fx[i] += pull * ux;
			fy[i] += pull * uy;
			fx[j] -= pull * ux;
			fy[j] -= pull * uy;
			if (linked !== was) {
				world.linked[k] = linked;
				// 変形量を直接書き換えると1フレームで形が跳んで見えるので、変形の速さに蹴りを入れて減衰振動させる
				const kick = linked ? -0.7 : 1.4;
				for (const [b, o] of [[p, q], [q, p]]) {
					// 揺れている最中に軸を回すと形が一瞬で変わって見えるので、揺れが収まっている液滴だけ向きを合わせる
					if (Math.abs(b.a) < 0.04) {
						b.ax = ux;
						b.ay = uy;
					}
					b.va += kick * Math.min(1.5, Math.max(0.5, o.r / b.r));
				}
				if (linked) stats.merges++;
				else stats.pinches++;
			}
		}
	}
	for (let i = 0; i < N; i++) {
		const b = blobs[i];
		const m = b.r * b.r * 40;
		b.vx += (fx[i] / m) * dt;
		b.vy += (fy[i] / m) * dt;
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		const omega = 7 / Math.sqrt(b.r * 10);
		b.va += (-omega * omega * b.a - 2.2 * b.va) * dt;
		b.a += b.va * dt;
		b.a = Math.max(-0.35, Math.min(0.35, b.a));
	}
}

function advance(world: World, seconds: number, stats: { merges: number; pinches: number }) {
	for (let s = 0; s < seconds; s += STEP) step(world, STEP, stats);
}

function resizeWorld(world: World, w: number, h: number) {
	for (const b of world.blobs) {
		b.x *= w / world.w;
		b.y *= h / world.h;
	}
	world.w = w;
	world.h = h;
}

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;
uniform vec2 uRes;
uniform float uScale;
uniform vec4 uBlob[${N}];
uniform vec2 uAxis[${N}];
uniform vec3 uCol[${N}];
uniform vec3 uBg;
void main(){
	vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uScale;
	float f=0.;
	vec3 c=vec3(0.);
	for(int i=0;i<${N};i++){
		vec2 d=p-uBlob[i].xy;
		vec2 ax=uAxis[i];
		float s=1.+uBlob[i].w;
		vec2 q=vec2(dot(d,ax)/s,(d.x*ax.y-d.y*ax.x)*s);
		float w=uBlob[i].z*uBlob[i].z/max(dot(q,q),1e-5);
		f+=w;
		c+=uCol[i]*w;
	}
	c/=max(f,1e-5);
	float body=smoothstep(.45,1.75,f);
	float halo=smoothstep(.08,1.,f);
	float k=.35*halo+.65*body;
	gl_FragColor=vec4(mix(uBg,c,k),1.);
}`;

function fieldColor(px: number, py: number, world: World, cols: [number, number, number][], bg: [number, number, number], out: Uint8ClampedArray, o: number) {
	let f = 0;
	let r = 0;
	let g = 0;
	let bl = 0;
	for (const b of world.blobs) {
		const dx = px - b.x;
		const dy = py - b.y;
		const s = 1 + b.a;
		const qx = (dx * b.ax + dy * b.ay) / s;
		const qy = (dx * b.ay - dy * b.ax) * s;
		const w = (b.r * b.r) / Math.max(qx * qx + qy * qy, 1e-5);
		const c = cols[b.color];
		f += w;
		r += c[0] * w;
		g += c[1] * w;
		bl += c[2] * w;
	}
	const sm = (e0: number, e1: number, x: number) => {
		const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
		return t * t * (3 - 2 * t);
	};
	const k = 0.35 * sm(0.08, 1, f) + 0.65 * sm(0.45, 1.75, f);
	out[o] = 255 * (bg[0] + (r / f - bg[0]) * k);
	out[o + 1] = 255 * (bg[1] + (g / f - bg[1]) * k);
	out[o + 2] = 255 * (bg[2] + (bl / f - bg[2]) * k);
	out[o + 3] = 255;
}

type Renderer = { mode: "webgl" | "2d"; size: (cssW: number, cssH: number) => void; draw: (world: World, unit: number) => void };

function webgl(canvas: HTMLCanvasElement, cols: [number, number, number][], bg: [number, number, number]): Renderer | null {
	// preserveDrawingBuffer は E2E で描画結果を読むため。縮小描画なのでコストは小さい
	const gl = canvas.getContext("webgl", { antialias: false, depth: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "low-power" });
	if (!gl) return null;
	const sh = (type: number, src: string) => {
		const s = gl.createShader(type)!;
		gl.shaderSource(s, src);
		gl.compileShader(s);
		return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
	};
	const vs = sh(gl.VERTEX_SHADER, VERT);
	const fs = sh(gl.FRAGMENT_SHADER, FRAG);
	if (!vs || !fs) return null;
	const prog = gl.createProgram()!;
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
	gl.useProgram(prog);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	const u = (n: string) => gl.getUniformLocation(prog, n);
	const uRes = u("uRes");
	const uScale = u("uScale");
	const uBlob = u("uBlob");
	const uAxis = u("uAxis");
	gl.uniform3fv(u("uCol"), new Float32Array(Array.from({ length: N }, (_, i) => cols[i % cols.length]).flat()));
	gl.uniform3fv(u("uBg"), new Float32Array(bg));
	const blob = new Float32Array(N * 4);
	const axis = new Float32Array(N * 2);
	return {
		mode: "webgl",
		size(cssW, cssH) {
			canvas.width = Math.max(1, Math.ceil(cssW / GL_DIV));
			canvas.height = Math.max(1, Math.ceil(cssH / GL_DIV));
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.uniform2f(uRes, canvas.width, canvas.height);
		},
		draw(world, unit) {
			world.blobs.forEach((b, i) => {
				blob.set([b.x, b.y, b.r, b.a], i * 4);
				axis.set([b.ax, b.ay], i * 2);
			});
			gl.uniform1f(uScale, unit / GL_DIV);
			gl.uniform4fv(uBlob, blob);
			gl.uniform2fv(uAxis, axis);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		},
	};
}

function canvas2d(canvas: HTMLCanvasElement, cols: [number, number, number][], bg: [number, number, number]): Renderer | null {
	const g = canvas.getContext("2d", { alpha: false });
	if (!g) return null;
	let img: ImageData | null = null;
	const ordered = Array.from({ length: N }, (_, i) => cols[i % cols.length]);
	return {
		mode: "2d",
		size(cssW, cssH) {
			canvas.width = Math.max(1, Math.ceil(cssW / CANVAS_DIV));
			canvas.height = Math.max(1, Math.ceil(cssH / CANVAS_DIV));
			img = g.createImageData(canvas.width, canvas.height);
		},
		draw(world, unit) {
			if (!img) return;
			const s = CANVAS_DIV / unit;
			for (let y = 0; y < img.height; y++) {
				for (let x = 0; x < img.width; x++) fieldColor((x + 0.5) * s, (y + 0.5) * s, world, ordered, bg, img.data, (y * img.width + x) * 4);
			}
			g.putImageData(img, 0, 0);
		},
	};
}

function grain(): string {
	const c = document.createElement("canvas");
	c.width = c.height = 128;
	const g = c.getContext("2d");
	if (!g) return "";
	const img = g.createImageData(128, 128);
	const rand = rng(7);
	for (let i = 0; i < img.data.length; i += 4) {
		const v = rand() * 255;
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
		img.data[i + 3] = 255;
	}
	g.putImageData(img, 0, 0);
	return c.toDataURL();
}

/** 時計の後ろに、表面張力でくっついたりちぎれたりする液滴を描く */
export function startBackground() {
	const params = new URLSearchParams(location.search);
	if (params.get("bg") === "off") return;
	const css = getComputedStyle(document.documentElement);
	const token = (n: string) => hex(css.getPropertyValue(n));
	const cols = [token("--bg-a"), token("--bg-b"), token("--bg-c")];
	const bg = token("--bg");

	const canvas = document.createElement("canvas");
	canvas.id = "bg";
	canvas.setAttribute("aria-hidden", "true");
	const noise = document.createElement("div");
	noise.id = "bg-grain";
	noise.setAttribute("aria-hidden", "true");
	const url = grain();
	if (url) noise.style.backgroundImage = `url(${url})`;
	document.body.prepend(canvas, noise);

	const r = webgl(canvas, cols, bg) ?? canvas2d(canvas, cols, bg);
	const info: NonNullable<Window["__bg"]> = { mode: r ? r.mode : "off", frameMs: 0, frames: 0, merges: 0, pinches: 0 };
	window.__bg = info;
	if (!r) {
		canvas.remove();
		return;
	}

	// 背景は CSS の blur で端が透けるので、画面より少し大きく描く（大きさは CSS の inset と合わせる）
	const box = () => ({ w: innerWidth + 120, h: innerHeight + 120 });
	let { w, h } = box();
	let unit = Math.min(w, h);
	const world = createWorld(w / unit, h / unit);
	r.size(w, h);

	const still = matchMedia("(prefers-reduced-motion: reduce)");
	let raf = 0;
	let last = 0;
	let carry = 0;

	const measure = (t0: number) => {
		info.frameMs += (performance.now() - t0 - info.frameMs) * (info.frames ? 0.05 : 1);
		info.frames++;
	};
	const render = () => {
		const t0 = performance.now();
		r.draw(world, unit);
		measure(t0);
	};
	const loop = (ts: number) => {
		raf = requestAnimationFrame(loop);
		// 時計と同じ毎フレームで描くと、GPUの弱い端末で時計の描画まで遅れる。ゆっくりぼけた動きなので30fpsで足りる
		if (last && ts - last < FRAME_MS - 2) return;
		const t0 = performance.now();
		carry += last ? Math.min((ts - last) / 1000, MAX_DT) : 0;
		last = ts;
		while (carry >= STEP) {
			step(world, STEP, info);
			carry -= STEP;
		}
		r.draw(world, unit);
		measure(t0);
	};
	const run = () => {
		cancelAnimationFrame(raf);
		raf = 0;
		last = 0;
		if (still.matches) render();
		else if (!document.hidden) raf = requestAnimationFrame(loop);
	};

	// 1枚だけ描く場合も、液滴がいくつかつながった見た目になるところまで進めておく
	advance(world, STILL_SECONDS, info);
	info.merges = info.pinches = 0;
	run();
	still.addEventListener("change", run);
	document.addEventListener("visibilitychange", run);
	addEventListener("resize", () => {
		({ w, h } = box());
		unit = Math.min(w, h);
		resizeWorld(world, w / unit, h / unit);
		r.size(w, h);
		if (still.matches) render();
	});
	canvas.addEventListener("webglcontextlost", (e) => {
		e.preventDefault();
		cancelAnimationFrame(raf);
		canvas.remove();
		info.mode = "off";
	});
}
