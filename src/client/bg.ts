const STEP = 1 / 120;
const MAX_STEPS = 12;
const POINTS = 20;
const ITERATIONS = 3;
const DOWNSCALE = 5;
const DAMP = 0.996;
const MAX_SPEED = 360;
const EDGE_STIFFNESS = 0.5;
const AREA_STIFFNESS = 0.35;
// 形を覚えさせる引き戻しを強くすると衝突で潰れなくなり、弱すぎると輪がしわくちゃになる
const SHAPE_STIFFNESS = 0.012;
const DRIFT_GAIN = 0.5;
const SEED = 0x6a656c6c;
const gx = new Float64Array(POINTS);
const gy = new Float64Array(POINTS);

type Body = {
	x: Float64Array;
	y: Float64Array;
	ox: Float64Array;
	oy: Float64Array;
	qx: Float64Array;
	qy: Float64Array;
	r: number;
	rest: number;
	edge: number;
	color: [number, number, number];
	speed: number;
	phase: [number, number, number];
	cx: number;
	cy: number;
	reach: number;
};

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hex(name: string, fallback: string): [number, number, number] {
	const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
	const m = /^#?([0-9a-f]{6})$/i.exec(v) ?? /^#?([0-9a-f]{6})$/i.exec(fallback)!;
	const n = parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function polygonArea(b: Body) {
	let a = 0;
	for (let i = 0, j = POINTS - 1; i < POINTS; j = i++) a += b.x[j] * b.y[i] - b.x[i] * b.y[j];
	return a / 2;
}

function updateBounds(b: Body) {
	let cx = 0;
	let cy = 0;
	for (let i = 0; i < POINTS; i++) {
		cx += b.x[i];
		cy += b.y[i];
	}
	cx /= POINTS;
	cy /= POINTS;
	let reach = 0;
	for (let i = 0; i < POINTS; i++) reach = Math.max(reach, Math.hypot(b.x[i] - cx, b.y[i] - cy));
	b.cx = cx;
	b.cy = cy;
	b.reach = reach;
}

function shape(b: Body, r: number) {
	b.r = r;
	b.edge = 2 * r * Math.sin(Math.PI / POINTS);
	b.rest = (POINTS / 2) * r * r * Math.sin((2 * Math.PI) / POINTS);
	for (let i = 0; i < POINTS; i++) {
		const a = (i / POINTS) * Math.PI * 2;
		b.qx[i] = Math.cos(a) * r;
		b.qy[i] = Math.sin(a) * r;
	}
}

function makeBody(cx: number, cy: number, r: number, color: [number, number, number], rnd: () => number): Body {
	const f = () => new Float64Array(POINTS);
	const b: Body = {
		x: f(), y: f(), ox: f(), oy: f(), qx: f(), qy: f(),
		r, rest: 0, edge: 0, color,
		speed: 0.75 + rnd() * 0.5,
		phase: [rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2],
		cx, cy, reach: r,
	};
	shape(b, r);
	for (let i = 0; i < POINTS; i++) {
		b.x[i] = b.ox[i] = cx + b.qx[i];
		b.y[i] = b.oy[i] = cy + b.qy[i];
	}
	return b;
}

function pushOut(px: Float64Array, py: Float64Array, k: number, b: Body) {
	const x = px[k];
	const y = py[k];
	let inside = false;
	for (let i = 0, j = POINTS - 1; i < POINTS; j = i++) {
		if (b.y[i] > y !== b.y[j] > y && x < ((b.x[j] - b.x[i]) * (y - b.y[i])) / (b.y[j] - b.y[i]) + b.x[i]) inside = !inside;
	}
	if (!inside) return false;
	let best = Infinity;
	let bi = 0;
	let bt = 0;
	let bdx = 0;
	let bdy = 0;
	for (let i = 0; i < POINTS; i++) {
		const j = (i + 1) % POINTS;
		const ex = b.x[j] - b.x[i];
		const ey = b.y[j] - b.y[i];
		const len2 = ex * ex + ey * ey || 1e-9;
		const t = Math.min(1, Math.max(0, ((x - b.x[i]) * ex + (y - b.y[i]) * ey) / len2));
		const dx = b.x[i] + ex * t - x;
		const dy = b.y[i] + ey * t - y;
		const d2 = dx * dx + dy * dy;
		if (d2 < best) {
			best = d2;
			bi = i;
			bt = t;
			bdx = dx;
			bdy = dy;
		}
	}
	const j = (bi + 1) % POINTS;
	const s = 1 / (1 + (1 - bt) ** 2 + bt ** 2);
	px[k] += bdx * s;
	py[k] += bdy * s;
	b.x[bi] -= bdx * s * (1 - bt);
	b.y[bi] -= bdy * s * (1 - bt);
	b.x[j] -= bdx * s * bt;
	b.y[j] -= bdy * s * bt;
	return true;
}

class World {
	bodies: Body[] = [];
	w = 1;
	h = 1;
	t = 0;
	steps = 0;
	collisions = 0;
	private touching = new Set<number>();

	constructor(w: number, h: number, colors: [number, number, number][]) {
		this.w = w;
		this.h = h;
		const rnd = mulberry32(SEED);
		const unit = Math.sqrt(w * h);
		const radii = [0.2, 0.17, 0.15, 0.13, 0.11].map((k) => k * unit);
		for (let i = 0; i < radii.length; i++) {
			const r = radii[i];
			let cx = w / 2;
			let cy = h / 2;
			for (let tries = 0; tries < 200; tries++) {
				cx = r + rnd() * Math.max(1, w - 2 * r);
				cy = r + rnd() * Math.max(1, h - 2 * r);
				if (this.bodies.every((o) => Math.hypot(o.cx - cx, o.cy - cy) > o.r + r + 8)) break;
			}
			this.bodies.push(makeBody(cx, cy, Math.min(r, w / 2 - 1, h / 2 - 1), colors[i % colors.length], rnd));
		}
	}

	resize(w: number, h: number) {
		const sx = w / this.w;
		const sy = h / this.h;
		const sr = Math.sqrt(sx * sy);
		for (const b of this.bodies) {
			for (let i = 0; i < POINTS; i++) {
				b.x[i] *= sx;
				b.ox[i] *= sx;
				b.y[i] *= sy;
				b.oy[i] *= sy;
			}
			shape(b, Math.min(b.r * sr, w / 2 - 1, h / 2 - 1));
			updateBounds(b);
		}
		this.w = w;
		this.h = h;
	}

	step() {
		const dt = STEP;
		const t = (this.t += dt);
		const unit = Math.sqrt(this.w * this.h);
		const maxStep = MAX_SPEED * dt;
		for (const b of this.bodies) {
			let vx = 0;
			let vy = 0;
			for (let i = 0; i < POINTS; i++) {
				vx += b.x[i] - b.ox[i];
				vy += b.y[i] - b.oy[i];
			}
			vx /= POINTS * dt;
			vy /= POINTS * dt;
			const [p0, p1, p2] = b.phase;
			const heading = p0 + Math.sin(t * 0.11 + p1) * 2.2 + Math.sin(t * 0.047 + p2) * 1.6;
			const speed = 0.06 * unit * b.speed;
			let tx = Math.cos(heading) * speed;
			let ty = Math.sin(heading) * speed;
			// 壁の反発だけに任せないのは、漂う速さが遅いと潰れたまま壁際に居着いてしまうため
			const margin = b.r * 1.4;
			if (b.cx < margin) tx += speed * (1 - b.cx / margin) * 1.5;
			if (b.cx > this.w - margin) tx -= speed * (1 - (this.w - b.cx) / margin) * 1.5;
			if (b.cy < margin) ty += speed * (1 - b.cy / margin) * 1.5;
			if (b.cy > this.h - margin) ty -= speed * (1 - (this.h - b.cy) / margin) * 1.5;
			const ax = (tx - vx) * DRIFT_GAIN * dt * dt;
			const ay = (ty - vy) * DRIFT_GAIN * dt * dt;
			for (let i = 0; i < POINTS; i++) {
				let dx = (b.x[i] - b.ox[i]) * DAMP + ax;
				let dy = (b.y[i] - b.oy[i]) * DAMP + ay;
				const d = Math.hypot(dx, dy);
				if (d > maxStep) {
					dx *= maxStep / d;
					dy *= maxStep / d;
				}
				b.ox[i] = b.x[i];
				b.oy[i] = b.y[i];
				b.x[i] += dx;
				b.y[i] += dy;
			}
		}

		for (let it = 0; it < ITERATIONS; it++) {
			for (const b of this.bodies) this.solveBody(b);
			this.collide();
			this.walls();
		}
		for (const b of this.bodies) updateBounds(b);
		this.steps++;
	}

	private solveBody(b: Body) {
		const { x, y } = b;
		for (let i = 0; i < POINTS; i++) {
			const j = (i + 1) % POINTS;
			const dx = x[j] - x[i];
			const dy = y[j] - y[i];
			const d = Math.hypot(dx, dy) || 1e-9;
			const c = ((d - b.edge) / d) * 0.5 * EDGE_STIFFNESS;
			x[i] += dx * c;
			y[i] += dy * c;
			x[j] -= dx * c;
			y[j] -= dy * c;
		}

		// 力としての圧力ではなく位置の拘束にしたのは、深くめり込んだときに力が大きくなって発散するのを避けるため
		const area = polygonArea(b);
		let g2 = 0;
		for (let i = 0; i < POINTS; i++) {
			const n = x[(i + 1) % POINTS] - x[(i + POINTS - 1) % POINTS];
			const m = y[(i + 1) % POINTS] - y[(i + POINTS - 1) % POINTS];
			g2 += (n * n + m * m) / 4;
		}
		const lambda = ((b.rest - area) / (g2 || 1e-9)) * AREA_STIFFNESS;
		for (let i = 0; i < POINTS; i++) {
			gx[i] = (y[(i + 1) % POINTS] - y[(i + POINTS - 1) % POINTS]) / 2;
			gy[i] = (x[(i + POINTS - 1) % POINTS] - x[(i + 1) % POINTS]) / 2;
		}
		for (let i = 0; i < POINTS; i++) {
			x[i] += gx[i] * lambda;
			y[i] += gy[i] * lambda;
		}

		let cx = 0;
		let cy = 0;
		for (let i = 0; i < POINTS; i++) {
			cx += x[i];
			cy += y[i];
		}
		cx /= POINTS;
		cy /= POINTS;
		let num = 0;
		let den = 0;
		for (let i = 0; i < POINTS; i++) {
			const dx = x[i] - cx;
			const dy = y[i] - cy;
			num += b.qx[i] * dy - b.qy[i] * dx;
			den += b.qx[i] * dx + b.qy[i] * dy;
		}
		const rot = Math.atan2(num, den);
		const cos = Math.cos(rot);
		const sin = Math.sin(rot);
		for (let i = 0; i < POINTS; i++) {
			const gxp = cx + b.qx[i] * cos - b.qy[i] * sin;
			const gyp = cy + b.qx[i] * sin + b.qy[i] * cos;
			x[i] += (gxp - x[i]) * SHAPE_STIFFNESS;
			y[i] += (gyp - y[i]) * SHAPE_STIFFNESS;
		}
		b.cx = cx;
		b.cy = cy;
	}

	private collide() {
		const bs = this.bodies;
		for (let a = 0; a < bs.length; a++) {
			for (let c = a + 1; c < bs.length; c++) {
				const A = bs[a];
				const B = bs[c];
				const key = a * 16 + c;
				if (Math.hypot(A.cx - B.cx, A.cy - B.cy) > A.reach + B.reach) {
					this.touching.delete(key);
					continue;
				}
				let hit = false;
				for (let k = 0; k < POINTS; k++) hit = pushOut(A.x, A.y, k, B) || hit;
				for (let k = 0; k < POINTS; k++) hit = pushOut(B.x, B.y, k, A) || hit;
				if (hit && !this.touching.has(key)) {
					this.touching.add(key);
					this.collisions++;
				}
			}
		}
	}

	private walls() {
		for (const b of this.bodies) {
			for (let i = 0; i < POINTS; i++) {
				b.x[i] = Math.min(this.w, Math.max(0, b.x[i]));
				b.y[i] = Math.min(this.h, Math.max(0, b.y[i]));
			}
		}
	}
}

// 毎フレーム作り直さないのは、粒子が動くとカメラのシャッターと干渉して明滅に見えるため
function grainTile() {
	const cells = 64;
	const c = document.createElement("canvas");
	c.width = c.height = cells;
	const g = c.getContext("2d")!;
	const img = g.createImageData(cells, cells);
	const rnd = mulberry32(SEED ^ 0x9e3779b9);
	for (let i = 0; i < cells * cells; i++) {
		const v = rnd() < 0.5 ? 0 : 255;
		img.data.set([v, v, v, Math.round(rnd() * 255)], i * 4);
	}
	g.putImageData(img, 0, 0);
	return c.toDataURL();
}

declare global {
	interface Window {
		__bg?: { state: () => unknown };
	}
}

export function startBackground() {
	const canvas = document.createElement("canvas");
	canvas.id = "bg";
	canvas.setAttribute("aria-hidden", "true");
	const grain = document.createElement("div");
	grain.id = "bg-grain";
	grain.setAttribute("aria-hidden", "true");
	grain.style.backgroundImage = `url(${grainTile()})`;
	document.body.prepend(canvas, grain);

	const g = canvas.getContext("2d")!;
	const colors = [hex("--bg-a", "#4a3416"), hex("--bg-b", "#3a1c1c"), hex("--bg-c", "#1e262e"), hex("--bg-d", "#352a14")];
	const world = new World(innerWidth, innerHeight, colors);
	let pad = 0;
	let frameMs = 0;
	let raf = 0;
	let last = 0;
	let acc = 0;
	const reduce = matchMedia("(prefers-reduced-motion: reduce)");

	function fit() {
		const rect = canvas.getBoundingClientRect();
		pad = Math.max(0, -rect.left);
		const w = Math.max(1, Math.ceil(rect.width / DOWNSCALE));
		const h = Math.max(1, Math.ceil(rect.height / DOWNSCALE));
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		if (world.w !== innerWidth || world.h !== innerHeight) world.resize(innerWidth, innerHeight);
	}

	// ぼかしを canvas の filter で描き込まず CSS の filter にしたのは、Safari の 2D canvas が filter を描画に反映しないため
	function draw() {
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.clearRect(0, 0, canvas.width, canvas.height);
		g.setTransform(1 / DOWNSCALE, 0, 0, 1 / DOWNSCALE, pad / DOWNSCALE, pad / DOWNSCALE);
		for (const b of world.bodies) {
			const { x, y } = b;
			g.beginPath();
			g.moveTo((x[POINTS - 1] + x[0]) / 2, (y[POINTS - 1] + y[0]) / 2);
			for (let i = 0; i < POINTS; i++) {
				const j = (i + 1) % POINTS;
				g.quadraticCurveTo(x[i], y[i], (x[i] + x[j]) / 2, (y[i] + y[j]) / 2);
			}
			const [r, gg, bb] = b.color;
			const grad = g.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, b.r * 1.05);
			grad.addColorStop(0, `rgb(${r} ${gg} ${bb})`);
			grad.addColorStop(1, `rgb(${r} ${gg} ${bb} / .2)`);
			g.fillStyle = grad;
			g.fill();
		}
	}

	function frame(ts: number) {
		raf = requestAnimationFrame(frame);
		const t0 = performance.now();
		fit();
		if (last) acc += Math.min((ts - last) / 1000, MAX_STEPS * STEP);
		last = ts;
		while (acc >= STEP) {
			world.step();
			acc -= STEP;
		}
		draw();
		frameMs += (performance.now() - t0 - frameMs) * 0.05;
	}

	function run() {
		cancelAnimationFrame(raf);
		raf = 0;
		last = 0;
		acc = 0;
		if (reduce.matches || document.hidden) {
			fit();
			draw();
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	reduce.addEventListener("change", run);
	document.addEventListener("visibilitychange", run);
	addEventListener("resize", () => {
		if (!raf) run();
	});
	run();

	window.__bg = {
		state: () => ({
			w: world.w,
			h: world.h,
			steps: world.steps,
			collisions: world.collisions,
			running: raf !== 0,
			frameMs,
			bodies: world.bodies.map((b) => ({
				cx: b.cx,
				cy: b.cy,
				area: polygonArea(b),
				rest: b.rest,
				minX: Math.min(...b.x),
				maxX: Math.max(...b.x),
				minY: Math.min(...b.y),
				maxY: Math.max(...b.y),
			})),
		}),
	};
}
