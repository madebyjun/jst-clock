import { correction, generate } from "lean-qr";
import { type Clock, mono } from "./clock.ts";
import { COLS, HOLDS, type Hold, modules, packRows, packRowsV2, QUIET, ROWS } from "./timecode-format.ts";

declare const __APP_VERSION__: string;

const QR_PERIOD_MS = 500;
const QR_QUIET = 4;
const LOG_MAX = 20_000;
const WHITE = "#fff";
const BLACK = "#050607";
const DEFAULT_HOLD: Hold = 100;

function holdFromUrl(): Hold {
	const v = Number(new URLSearchParams(location.search).get("hold"));
	return (HOLDS as readonly number[]).includes(v) ? (v as Hold) : DEFAULT_HOLD;
}

type Meta = { verified: boolean; slewing: boolean; fields: string };
type Anchor = { n: number; t: number | null };

const f1 = (v: number) => v.toFixed(1);

/** QR の中身のうち、アンカー（N, T）以外 */
function snapshot(clock: Clock, t: number | null, at: number, frameMs: number, lag: number, zoneMin: number, hold: Hold): Meta {
	const e = clock.estimate;
	const r = clock.rate;
	const holdover = clock.lastRoundOk === 0;
	const learned = r.points >= 2 && r.hi - r.lo < 150e-6;
	const verified = !!e && e.agreeing * 2 > e.responding && e.agreeing >= 2 && !holdover;
	let slewing = false;
	const parts = [`F${frameMs.toFixed(3)}`, `L${f1(lag)}`, `G${hold}`];
	const b = clock.bounds(at);
	const shown = clock.shownOffset();
	const error = clock.shownError(at);
	if (b && shown !== null && error !== null && t !== null) {
		const diff = shown - (b.lo + b.hi) / 2;
		slewing = Math.abs(diff) > (b.hi - b.lo) / 2;
		parts.push(`D${f1(Date.now() - (mono() + shown))}`, `U${f1(error)}`, `E${f1(diff)}`);
	} else parts.push("D-", "U-", "E-");
	parts.push(learned ? `R${f1(-((r.lo + r.hi) / 2) * 1e6)}` : "R-", learned ? `Q${f1(((r.hi - r.lo) / 2) * 1e6)}` : "Q-");
	parts.push(`A${e?.agreeing ?? 0}`, `S${e?.responding ?? 0}`, `H${holdover ? 1 : 0}`, `K${clock.rounds}`, `Z${zoneMin}`, `V${__APP_VERSION__}`);
	return { verified, slewing, fields: parts.join(" ") };
}

/** zoneOffset: 画面に出している地域の、時刻 t における UTC からのずれ（ms） */
export function mountTimecode(container: HTMLElement, clock: Clock, zoneOffset: (t: number) => number) {
	const strip = document.createElement("canvas");
	strip.className = "tc-strip";
	strip.setAttribute("aria-hidden", "true");
	const qr = document.createElement("canvas");
	qr.className = "tc-qr";
	qr.setAttribute("aria-hidden", "true");
	container.replaceChildren(strip, qr);

	let enabled = false;
	let frozen: Meta | null = null;
	let n = 0;
	let lastQ = Number.NaN;
	const hold = holdFromUrl();
	let qrKey = Number.NaN;
	let stripPx = 0;
	let qrBudget = 0;
	let lastStrip: number[] | null = null;
	let lastQr: string | null = null;
	const log: { n: number; t: number | null }[] = [];

	function layout() {
		const w = container.clientWidth;
		if (!w) return;
		const dpr = devicePixelRatio || 1;
		const wide = w >= 640;
		// 小数のデバイスピクセルにするとセルの境界が補間されて中間色になるので、1モジュールを整数に切り下げる
		stripPx = Math.max(1, Math.floor(((wide ? w * 0.72 : w) * dpr) / (COLS + 2 * QUIET)));
		strip.width = stripPx * (COLS + 2 * QUIET);
		strip.height = stripPx * (ROWS + 2 * QUIET);
		strip.style.width = `${strip.width / dpr}px`;
		strip.style.height = `${strip.height / dpr}px`;
		qrBudget = Math.floor((wide ? w * 0.22 : Math.min(w * 0.6, 260)) * dpr);
		if (lastStrip) drawStrip(lastStrip);
		if (lastQr) drawQr(lastQr);
	}

	function drawStrip(words: number[]) {
		lastStrip = words;
		const ctx = strip.getContext("2d")!;
		const m = stripPx;
		ctx.fillStyle = BLACK;
		ctx.fillRect(0, 0, strip.width, strip.height);
		ctx.fillStyle = WHITE;
		const grid = modules(words);
		for (let y = 0; y < ROWS; y++) {
			let x = 0;
			while (x < COLS) {
				if (!grid[y][x]) {
					x++;
					continue;
				}
				const start = x;
				while (x < COLS && grid[y][x]) x++;
				ctx.fillRect((QUIET + start) * m, (QUIET + y) * m, (x - start) * m, m);
			}
		}
	}

	function drawQr(text: string) {
		lastQr = text;
		const code = generate(text, { minCorrectionLevel: correction.M, maxCorrectionLevel: correction.M, minVersion: 5 });
		const dpr = devicePixelRatio || 1;
		const size = code.size + 2 * QR_QUIET;
		const m = Math.max(1, Math.floor(qrBudget / size));
		qr.width = qr.height = m * size;
		qr.style.width = qr.style.height = `${(m * size) / dpr}px`;
		const ctx = qr.getContext("2d")!;
		ctx.fillStyle = WHITE;
		ctx.fillRect(0, 0, qr.width, qr.height);
		ctx.fillStyle = "#000";
		for (let y = 0; y < code.size; y++) {
			for (let x = 0; x < code.size; x++) if (code.get(x, y)) ctx.fillRect((QR_QUIET + x) * m, (QR_QUIET + y) * m, m, m);
		}
	}

	function drawHeld(t0: number | null, q: number, meta: Meta) {
		drawStrip(packRowsV2({ t0, q, hold, verified: meta.verified, slewing: meta.slewing }));
	}

	function drawAnchor(anchor: Anchor, meta: Meta) {
		drawQr(`JC1 N${anchor.n} T${anchor.t === null ? "-" : Math.floor(anchor.t)} ${meta.fields}`);
	}

	function render(frameN: number, t: number | null, meta: Meta, anchor: Anchor | null) {
		drawStrip(packRows({ n: frameN, t, verified: meta.verified, slewing: meta.slewing }));
		if (anchor) drawQr(`JC1 N${anchor.n} T${anchor.t === null ? "-" : Math.floor(anchor.t)} ${meta.fields}`);
	}

	const zoneMinutes = (t: number) => Math.round(zoneOffset(t) / 60_000);

	new ResizeObserver(layout).observe(container);

	const api = {
		enable() {
			enabled = true;
			container.hidden = false;
			layout();
		},
		disable() {
			enabled = false;
			container.hidden = true;
		},
		/** 数字と同じ rAF の中で、数字と同じ時刻 t（表示予測時刻 at に対する clock.now の値）を渡す */
		frame(t: number | null, at: number, frameMs: number, lag: number) {
			if (!enabled || frozen) return;
			n++;
			const key = Math.floor((t ?? at) / QR_PERIOD_MS);
			// 毎描画で値を変えると、応答の遅いパネル（120Hz の液晶など）では落ち着く前に次の値になり、どのフレームも読めなくなる
			const q = Math.floor((t ?? at) / hold);
			if (q === lastQ && key === qrKey) return;
			const meta = snapshot(clock, t, at, frameMs, lag, zoneMinutes(t ?? at), hold);
			if (q !== lastQ) {
				drawHeld(t, q, meta);
				log.push({ n: q, t: t === null ? null : Math.floor(t) });
				if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
				lastQ = q;
			}
			if (key !== qrKey) drawAnchor({ n, t }, meta);
			qrKey = key;
		},
	};

	window.__timecode = {
		renderAt(t: number | null, frameN: number, anchor?: Anchor, format: 1 | 2 = 2, deviceAt = mono()) {
			const at = deviceAt;
			frozen ??= snapshot(clock, t, at, 1000 / 60, 0, zoneMinutes(t ?? at), hold);
			if (format === 1) render(frameN, t, frozen, anchor ?? { n: frameN, t });
			else {
				drawHeld(t, Math.floor((t ?? at) / hold), frozen);
				drawAnchor(anchor ?? { n: frameN, t }, frozen);
			}
		},
		hold: () => hold,
		live() {
			frozen = null;
			qrKey = Number.NaN;
			lastQ = Number.NaN;
		},
		log: () => log.slice(),
		qr: () => lastQr,
		enabled: () => enabled,
	};
	return api;
}

declare global {
	interface Window {
		__timecode: {
			/** format 2（既定）は保持型で、行0は floor(t / hold)。n は QR のアンカーにだけ使う。format 1 は描画ごとの旧形式 */
			renderAt: (t: number | null, n: number, anchor?: { n: number; t: number | null }, format?: 1 | 2, at?: number) => void;
			hold: () => number;
			live: () => void;
			/** 時刻帯を描き直した記録。n は行0の値（v2 では floor(t / hold)） */
			log: () => { n: number; t: number | null }[];
			qr: () => string | null;
			enabled: () => boolean;
		};
	}
}
