/** 時計の後ろで、インクを落とした水のような流体を動かす背景（docs/failure-modes.md の B1〜B11） */

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;
const PRESSURE_ITERS = 20;
const STILL_STEPS = 420;
const WARM_STEPS = 90;
const VEL_DISSIPATION = 0.2;
const DYE_DISSIPATION = 0.28;
const CURL = 35;
const MAX_SPEED = 60;
// 表示用キャンバスを画面の解像度にすると、ぼかしの手間が画素数に比例して増える。格子の数倍に留めて CSS で引き伸ばす
const DISPLAY_SCALE = 3;
// 色ごとの頭打ちだけでは、全色が重なった所で輝度が足し上がるので、相対輝度にも上限をかける。#eef2f5 の数字に対して (0.88+0.05)/(0.028+0.05) ≈ 12:1
const LUM_CAP = 0.028;
const CHANNEL_CAP = 0.16;

type Mode = "fluid" | "still" | "static" | "off";

interface Emitter {
	cx: number;
	cy: number;
	ax: number;
	ay: number;
	px: number;
	py: number;
	fx: number;
	fy: number;
	r: number;
	swirl: number;
	dye: number;
	color: string;
}

// 周期を揃えると同じ組が同じ場所でぶつかり続けて単調になるので、互いに素に近い秒数にする
const EMITTERS: Emitter[] = [
	{ cx: 0.5, cy: 0.5, ax: 0.36, ay: 0.3, px: 0.0, py: 1.3, fx: 1 / 47, fy: 1 / 31, r: 0.11, swirl: 1, dye: 1.0, color: "--bg-ink-1" },
	{ cx: 0.5, cy: 0.5, ax: 0.38, ay: 0.32, px: 2.6, py: 4.1, fx: 1 / 53, fy: 1 / 37, r: 0.12, swirl: -1, dye: 1.0, color: "--bg-ink-2" },
	{ cx: 0.5, cy: 0.5, ax: 0.34, ay: 0.28, px: 4.4, py: 0.5, fx: 1 / 41, fy: 1 / 59, r: 0.1, swirl: 1, dye: 0.9, color: "--bg-ink-3" },
	{ cx: 0.5, cy: 0.5, ax: 0.3, ay: 0.34, px: 1.2, py: 2.4, fx: 1 / 61, fy: 1 / 43, r: 0.07, swirl: -1, dye: 0.55, color: "--bg-ink-4" },
];

function emitterAt(e: Emitter, t: number) {
	const wx = 2 * Math.PI * e.fx;
	const wy = 2 * Math.PI * e.fy;
	const breathe = 1 + 0.3 * Math.sin(t * 2 * Math.PI * e.fx * 3 + e.py);
	return {
		x: e.cx + e.ax * Math.sin(wx * t + e.px),
		y: e.cy + e.ay * Math.sin(wy * t + e.py),
		vx: e.ax * wx * Math.cos(wx * t + e.px),
		vy: e.ay * wy * Math.cos(wy * t + e.py),
		r: e.r * breathe,
	};
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function hexToLinear(hex: string): [number, number, number] {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	const n = m ? parseInt(m[1], 16) : 0;
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

const srgbToLinear = (v: number) => {
	const s = v / 255;
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (r: number, g: number, b: number) => 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);

function pixelStats(px: Uint8Array | Uint8ClampedArray) {
	let sum = 0;
	let max = 0;
	let hash = 0;
	const n = px.length / 4;
	for (let i = 0; i < px.length; i += 4) {
		const l = luminance(px[i], px[i + 1], px[i + 2]);
		sum += l;
		if (l > max) max = l;
		hash = (hash * 31 + px[i] + px[i + 1] * 7 + px[i + 2] * 13) | 0;
	}
	return { meanLum: sum / n, maxLum: max, hash };
}

/** 同じ見た目を毎回再現できるよう、乱数は種を固定する */
function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function grainURL() {
	const size = 192;
	const c = document.createElement("canvas");
	c.width = c.height = size;
	const g = c.getContext("2d");
	if (!g) return null;
	const img = g.createImageData(size, size);
	const rnd = mulberry32(20241013);
	for (let i = 0; i < img.data.length; i += 4) {
		const v = rnd();
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 0.5 ? 255 : 0;
		img.data[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * 22);
	}
	g.putImageData(img, 0, 0);
	return c.toDataURL("image/png");
}

function gridSize() {
	const w = Math.max(1, innerWidth);
	const h = Math.max(1, innerHeight);
	const long = Math.min(w, h) < 720 ? 96 : 128;
	const aspect = w / h;
	return aspect >= 1
		? { W: long, H: Math.max(16, Math.round(long / aspect)), aspect }
		: { W: Math.max(16, Math.round(long * aspect)), H: long, aspect };
}

const VERT = `#version 300 es
out vec2 vUv;
void main() {
	vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
	vUv = p;
	gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
uniform vec2 uTexel;
`;

const FRAG = {
	splat: `${HEAD}
uniform sampler2D uSrc;
uniform int uMode;
uniform float uAspect;
uniform float uDt;
uniform vec4 uE[4];
uniform vec4 uV[4];
uniform vec3 uC[4];
uniform vec2 uGrid;
void main() {
	vec4 s = texture(uSrc, vUv);
	for (int i = 0; i < 4; i++) {
		vec2 p = vUv - uE[i].xy;
		p.x *= uAspect;
		float r = uE[i].z * (uMode == 0 ? 1.0 : 0.6);
		float g = exp(-dot(p, p) / (r * r));
		if (uMode == 0) {
			vec2 tang = vec2(-p.y, p.x) / r;
			tang.x /= uAspect;
			vec2 push = uV[i].xy * uE[i].w + tang * uV[i].z;
			s.xy += push * uGrid * g * uDt;
		} else {
			s.rgb += uC[i] * uV[i].w * g * uDt;
		}
	}
	o = s;
}`,
	advect: `${HEAD}
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform float uDt;
uniform float uDiss;
uniform float uMaxV;
uniform int uMode;
void main() {
	vec2 c = vUv - uDt * texture(uVel, vUv).xy * uTexel;
	vec4 r = texture(uSrc, c) * uDiss;
	if (uMode == 0) {
		float m = length(r.xy);
		if (!(m < 1e4)) r = vec4(0.0);
		else if (m > uMaxV) r.xy *= uMaxV / m;
	} else {
		float m = max(max(r.r, r.g), r.b);
		if (!(m < 1e4)) r = vec4(0.0);
		r = max(r, vec4(0.0));
	}
	o = r;
}`,
	curl: `${HEAD}
uniform sampler2D uVel;
void main() {
	float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
	float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
	float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
	float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
	o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
	vorticity: `${HEAD}
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform float uCurlK;
uniform float uDt;
void main() {
	float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
	float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
	float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
	float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
	float C = texture(uCurl, vUv).x;
	vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
	f /= length(f) + 1e-4;
	f *= uCurlK * C;
	f.y = -f.y;
	vec2 v = texture(uVel, vUv).xy + f * uDt;
	o = vec4(v, 0.0, 1.0);
}`,
	divergence: `${HEAD}
uniform sampler2D uVel;
void main() {
	vec2 C = texture(uVel, vUv).xy;
	float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
	float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
	float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
	float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
	if (vUv.x - uTexel.x < 0.0) L = -C.x;
	if (vUv.x + uTexel.x > 1.0) R = -C.x;
	if (vUv.y - uTexel.y < 0.0) B = -C.y;
	if (vUv.y + uTexel.y > 1.0) T = -C.y;
	o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
	scale: `${HEAD}
uniform sampler2D uSrc;
uniform float uK;
void main() { o = texture(uSrc, vUv) * uK; }`,
	pressure: `${HEAD}
uniform sampler2D uP;
uniform sampler2D uDiv;
void main() {
	float L = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
	float R = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
	float B = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
	float T = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
	o = vec4((L + R + B + T - texture(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`,
	gradient: `${HEAD}
uniform sampler2D uP;
uniform sampler2D uVel;
void main() {
	float L = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
	float R = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
	float B = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
	float T = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
	vec2 v = texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
	o = vec4(v, 0.0, 1.0);
}`,
	blur: `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uDir;
void main() {
	vec4 acc = vec4(0.0);
	float wsum = 0.0;
	for (int i = -8; i <= 8; i++) {
		float x = float(i);
		float w = exp(-x * x / 12.0);
		acc += texture(uSrc, vUv + uDir * uTexel * x * 2.0) * w;
		wsum += w;
	}
	o = acc / wsum;
}`,
	display: `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform vec3 uBase;
uniform float uLumCap;
uniform float uChanCap;
vec3 toSrgb(vec3 c) {
	return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
	vec3 d = vec3(0.0);
	float wsum = 0.0;
	for (int i = -8; i <= 8; i++) {
		float x = float(i);
		float w = exp(-x * x / 12.0);
		d += texture(uSrc, vUv + uDir * uTexel * x * 2.0).rgb * w;
		wsum += w;
	}
	d = max(d / wsum, vec3(0.0));
	vec3 c = uChanCap * (1.0 - exp(-d / uChanCap));
	float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
	c *= uLumCap * (1.0 - exp(-L / uLumCap)) / max(L, 1e-6);
	o = vec4(toSrgb(clamp(uBase + c, 0.0, 1.0)), 1.0);
}`,
};

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };
type Double = { read: Target; write: Target; swap: () => void };

function createFluid(canvas: HTMLCanvasElement, allowSoftware: boolean) {
	// ソフトウェア描画の WebGL（SwiftShader など）では、流体の計算がCPUを奪って時刻の問い合わせの往復時間まで伸ばすので、使わずに静止背景にする
	const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: !allowSoftware });
	if (!gl) throw new Error("WebGL2 が使えない、またはGPUで描けない");
	const info = gl.getExtension("WEBGL_debug_renderer_info");
	const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
	// failIfMajorPerformanceCaveat だけでは、ANGLE 経由の SwiftShader を弾かない Chromium がある
	if (!allowSoftware && /SwiftShader|llvmpipe|softpipe|Software/i.test(renderer)) {
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		throw new Error("ソフトウェア描画");
	}
	if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) throw new Error("浮動小数点テクスチャに描けない");

	const compile = (type: number, src: string) => {
		const s = gl.createShader(type)!;
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
		return s;
	};
	const vs = compile(gl.VERTEX_SHADER, VERT);
	const progs = Object.fromEntries(
		Object.entries(FRAG).map(([k, src]) => {
			const p = gl.createProgram()!;
			gl.attachShader(p, vs);
			gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
			gl.linkProgram(p);
			if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
			const u: Prog["u"] = {};
			const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
			for (let i = 0; i < n; i++) {
				const name = gl.getActiveUniform(p, i)!.name.replace(/\[0\]$/, "");
				u[name] = gl.getUniformLocation(p, name);
			}
			return [k, { p, u }];
		}),
	) as Record<keyof typeof FRAG, Prog>;

	const target = (w: number, h: number, internal: number, format: number): Target => {
		const tex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
		const fb = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("浮動小数点テクスチャに描けない");
		gl.viewport(0, 0, w, h);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		return { tex, fb, w, h };
	};
	const double = (w: number, h: number, internal: number, format: number): Double => {
		const d = { read: target(w, h, internal, format), write: target(w, h, internal, format), swap: () => ([d.read, d.write] = [d.write, d.read]) };
		return d;
	};

	let grid = gridSize();
	let vel: Double, dye: Double, pressure: Double, div: Target, curl: Target, tmp: Target;
	const allocate = () => {
		const { W, H } = grid;
		vel = double(W, H, gl.RG16F, gl.RG);
		dye = double(W, H, gl.RGBA16F, gl.RGBA);
		pressure = double(W, H, gl.R16F, gl.RED);
		div = target(W, H, gl.R16F, gl.RED);
		curl = target(W, H, gl.R16F, gl.RED);
		tmp = target(W * DISPLAY_SCALE, H * DISPLAY_SCALE, gl.RGBA16F, gl.RGBA);
		canvas.width = W * DISPLAY_SCALE;
		canvas.height = H * DISPLAY_SCALE;
	};
	allocate();

	let unit = 0;
	const use = (prog: Prog, texel: [number, number]) => {
		gl.useProgram(prog.p);
		gl.uniform2f(prog.u.uTexel, texel[0], texel[1]);
		unit = 0;
		return (name: string, t: Target) => {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, t.tex);
			gl.uniform1i(prog.u[name], unit++);
		};
	};
	const draw = (out: Target | null) => {
		gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
		gl.viewport(0, 0, out ? out.w : canvas.width, out ? out.h : canvas.height);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	};

	const colors = EMITTERS.map((e) => hexToLinear(css(e.color)));
	const base = hexToLinear(css("--bg"));
	let t = 0;
	let steps = 0;

	const step = () => {
		const { W, H, aspect } = grid;
		const tx: [number, number] = [1 / W, 1 / H];
		const E = new Float32Array(16);
		const V = new Float32Array(16);
		const C = new Float32Array(12);
		EMITTERS.forEach((e, i) => {
			const s = emitterAt(e, t);
			E.set([s.x, s.y, s.r, 8], i * 4);
			V.set([s.vx, s.vy, e.swirl * 2, e.dye * 1.1], i * 4);
			C.set(colors[i], i * 3);
		});

		for (const mode of [0, 1]) {
			const f = mode === 0 ? vel : dye;
			const bind = use(progs.splat, tx);
			bind("uSrc", f.read);
			gl.uniform1i(progs.splat.u.uMode, mode);
			gl.uniform1f(progs.splat.u.uAspect, aspect);
			gl.uniform1f(progs.splat.u.uDt, STEP);
			gl.uniform2f(progs.splat.u.uGrid, W, H);
			gl.uniform4fv(progs.splat.u.uE, E);
			gl.uniform4fv(progs.splat.u.uV, V);
			gl.uniform3fv(progs.splat.u.uC, C);
			draw(f.write);
			f.swap();
		}

		let bind = use(progs.curl, tx);
		bind("uVel", vel.read);
		draw(curl);

		bind = use(progs.vorticity, tx);
		bind("uVel", vel.read);
		bind("uCurl", curl);
		gl.uniform1f(progs.vorticity.u.uCurlK, CURL);
		gl.uniform1f(progs.vorticity.u.uDt, STEP);
		draw(vel.write);
		vel.swap();

		bind = use(progs.divergence, tx);
		bind("uVel", vel.read);
		draw(div);

		bind = use(progs.scale, tx);
		bind("uSrc", pressure.read);
		gl.uniform1f(progs.scale.u.uK, 0.8);
		draw(pressure.write);
		pressure.swap();

		for (let i = 0; i < PRESSURE_ITERS; i++) {
			bind = use(progs.pressure, tx);
			bind("uP", pressure.read);
			bind("uDiv", div);
			draw(pressure.write);
			pressure.swap();
		}

		bind = use(progs.gradient, tx);
		bind("uP", pressure.read);
		bind("uVel", vel.read);
		draw(vel.write);
		vel.swap();

		for (const [mode, f, rate] of [[0, vel, VEL_DISSIPATION], [1, dye, DYE_DISSIPATION]] as const) {
			bind = use(progs.advect, tx);
			bind("uVel", vel.read);
			bind("uSrc", f.read);
			gl.uniform1f(progs.advect.u.uDt, STEP);
			gl.uniform1f(progs.advect.u.uDiss, Math.exp(-rate * STEP));
			gl.uniform1f(progs.advect.u.uMaxV, MAX_SPEED);
			gl.uniform1i(progs.advect.u.uMode, mode);
			draw(f.write);
			f.swap();
		}
		t += STEP;
		steps++;
	};

	const render = () => {
		const dt: [number, number] = [1 / tmp.w, 1 / tmp.h];
		let bind = use(progs.blur, dt);
		bind("uSrc", dye.read);
		gl.uniform2f(progs.blur.u.uDir, 1, 0);
		draw(tmp);
		bind = use(progs.display, dt);
		bind("uSrc", tmp);
		gl.uniform2f(progs.display.u.uDir, 0, 1);
		gl.uniform3f(progs.display.u.uBase, base[0], base[1], base[2]);
		gl.uniform1f(progs.display.u.uLumCap, LUM_CAP);
		gl.uniform1f(progs.display.u.uChanCap, CHANNEL_CAP);
		draw(null);
	};

	const read = () => {
		render();
		const px = new Uint8Array(canvas.width * canvas.height * 4);
		gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	};

	const resize = () => {
		const next = gridSize();
		// 縦横比が少し変わる程度（スマートフォンのアドレスバーの出入り）では作り直さない。状態が消えて背景が一瞬空になるため
		if (Math.abs(Math.log(next.aspect / grid.aspect)) < 0.15) return false;
		grid = next;
		allocate();
		return true;
	};

	return {
		gl,
		step,
		render,
		read,
		resize,
		info: () => ({ simW: grid.W, simH: grid.H, steps, simTime: t, renderer }),
	};
}

function drawStatic(canvas: HTMLCanvasElement) {
	const { W, H } = gridSize();
	canvas.width = W * DISPLAY_SCALE;
	canvas.height = H * DISPLAY_SCALE;
	const g = canvas.getContext("2d");
	if (!g) return;
	g.fillStyle = css("--bg");
	g.fillRect(0, 0, canvas.width, canvas.height);
	g.globalAlpha = 0.85;
	for (const e of EMITTERS) {
		const s = emitterAt(e, 7);
		const x = s.x * canvas.width;
		const y = (1 - s.y) * canvas.height;
		const r = s.r * 3 * canvas.height;
		const grad = g.createRadialGradient(x, y, 0, x, y, r);
		grad.addColorStop(0, css(e.color));
		grad.addColorStop(1, "transparent");
		g.fillStyle = grad;
		g.fillRect(0, 0, canvas.width, canvas.height);
	}
	canvas.classList.add("static");
}

declare global {
	interface Window {
		__bg?: {
			stats: () => { mode: Mode; meanLum: number; maxLum: number; hash: number; frameMs: number; simW?: number; simH?: number; steps?: number; simTime?: number; renderer?: string };
			bench: (n: number) => number | null;
		};
	}
}

export function startBackground() {
	const param = new URLSearchParams(location.search).get("bg");
	if (param === "off") return;
	const host = document.createElement("div");
	host.id = "bg";
	host.setAttribute("aria-hidden", "true");
	const canvas = document.createElement("canvas");
	host.append(canvas);
	const grain = grainURL();
	if (grain) host.style.setProperty("--bg-grain", `url(${grain})`);
	document.body.prepend(host);

	const reduce = matchMedia("(prefers-reduced-motion: reduce)");
	let mode: Mode = "off";
	let fluid: ReturnType<typeof createFluid> | null = null;
	let raf = 0;
	let last = 0;
	let acc = 0;
	let frameMs = 0;

	const fallback = () => {
		cancelAnimationFrame(raf);
		fluid = null;
		// WebGL の文脈を一度取ったキャンバスでは2Dの文脈が取れないので、差し替える
		const fresh = document.createElement("canvas");
		canvas.replaceWith(fresh);
		drawStatic(fresh);
		mode = "static";
		window.__bg!.stats = () => {
			const g = fresh.getContext("2d")!;
			return { mode, ...pixelStats(g.getImageData(0, 0, fresh.width, fresh.height).data), frameMs: 0 };
		};
	};

	const frame = (ts: number) => {
		raf = requestAnimationFrame(frame);
		if (!fluid) return;
		const t0 = performance.now();
		try {
			if (last) acc += Math.min((ts - last) / 1000, MAX_STEPS_PER_FRAME * STEP);
			last = ts;
			let n = 0;
			while (acc >= STEP && n < MAX_STEPS_PER_FRAME) {
				fluid.step();
				acc -= STEP;
				n++;
			}
			if (n) fluid.render();
		} catch {
			fallback();
			return;
		}
		frameMs += (performance.now() - t0 - frameMs) * 0.05;
	};

	const still = () => {
		if (!fluid) return;
		cancelAnimationFrame(raf);
		raf = 0;
		mode = "still";
		while (fluid.info().steps < STILL_STEPS) fluid.step();
		fluid.render();
	};
	const animate = () => {
		if (!fluid || document.hidden) return;
		cancelAnimationFrame(raf);
		mode = "fluid";
		last = 0;
		acc = 0;
		raf = requestAnimationFrame(frame);
	};
	const apply = () => (reduce.matches ? still() : animate());

	window.__bg = {
		stats: () => ({ mode, meanLum: 0, maxLum: 0, hash: 0, frameMs: 0 }),
		bench: () => null,
	};

	const init = () => {
		try {
			fluid = createFluid(canvas, param === "force");
		} catch {
			fallback();
			return;
		}
		canvas.addEventListener("webglcontextlost", (e) => {
			e.preventDefault();
			fallback();
		});
		for (let i = 0; i < WARM_STEPS; i++) fluid.step();
		fluid.render();
		window.__bg = {
			stats: () => (fluid ? { mode, ...pixelStats(fluid.read()), frameMs, ...fluid.info() } : { mode, meanLum: 0, maxLum: 0, hash: 0, frameMs: 0 }),
			bench: (n: number) => {
				if (!fluid) return null;
				const one = new Uint8Array(4);
				fluid.gl.readPixels(0, 0, 1, 1, fluid.gl.RGBA, fluid.gl.UNSIGNED_BYTE, one);
				const t0 = performance.now();
				for (let i = 0; i < n; i++) {
					fluid.step();
					fluid.render();
					fluid.gl.readPixels(0, 0, 1, 1, fluid.gl.RGBA, fluid.gl.UNSIGNED_BYTE, one);
				}
				return (performance.now() - t0) / n;
			},
		};
		apply();
	};

	reduce.addEventListener("change", apply);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			cancelAnimationFrame(raf);
			raf = 0;
		} else if (mode === "fluid") animate();
	});
	addEventListener("resize", () => {
		if (fluid?.resize()) {
			fluid.step();
			fluid.render();
		}
	});

	// 時計の最初の描画を背景の初期化（シェーダーのコンパイル）で遅らせないよう、1フレーム待ってから始める
	requestAnimationFrame(() => setTimeout(init, 0));
}
