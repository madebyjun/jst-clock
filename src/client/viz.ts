import { type Clock, mono } from "./clock.ts";
import { msg } from "./i18n.ts";

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function setup(canvas: HTMLCanvasElement) {
	const dpr = window.devicePixelRatio || 1;
	const w = canvas.clientWidth;
	const h = canvas.clientHeight;
	if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
	}
	const g = canvas.getContext("2d")!;
	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	g.clearRect(0, 0, w, h);
	return { g, w, h };
}

function niceStep(span: number, target: number) {
	const raw = span / target;
	const p = 10 ** Math.floor(Math.log10(raw));
	for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
	return 10 * p;
}

const fmtTick = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v) < 10 && v % 1 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(0)}`;

/** 時刻源ごとの「真の時刻が入る区間」を、合議値を0とした軸に並べる */
export function drawIntervals(canvas: HTMLCanvasElement, clock: Clock, animate: boolean) {
	const { g, w, h } = setup(canvas);
	const e = clock.estimate;
	const states = clock.sourceStates();
	const now = mono();
	const font = css("--mono");
	const C = { fg: css("--fg"), dim: css("--dim"), rule: css("--rule"), ok: css("--ok"), bad: css("--bad"), warn: css("--warn") };

	g.font = `11px ${font}`;
	const labelW = Math.max(...[...states.map((s) => s.label), msg("deviceClock")].map((t) => g.measureText(t).width)) + 14;
	const top = 22;
	const bottom = 26;
	const rowH = (h - top - bottom) / Math.max(states.length + 1, 1);
	const x0 = labelW;
	const x1 = w - 8;

	g.font = `11px ${font}`;
	g.textBaseline = "middle";

	if (!e) {
		g.fillStyle = C.dim;
		g.fillText(msg("waitingSources"), x0, h / 2);
		return;
	}

	const center = e.offset;
	const half = (e.hi - e.lo) / 2;
	let span = Math.max(half * 6, 3);
	for (const s of states) {
		if (s.status === "ok" && s.lo !== null && s.hi !== null) {
			span = Math.max(span, Math.abs(s.lo - center) * 1.15, Math.abs(s.hi - center) * 1.15);
		}
	}
	span = Math.min(span, 500);
	const X = (v: number) => x0 + ((v - center + span) / (2 * span)) * (x1 - x0);
	const clampX = (x: number) => Math.min(Math.max(x, x0), x1);

	// 目盛り
	const step = niceStep(2 * span, 6);
	g.strokeStyle = C.rule;
	g.fillStyle = C.dim;
	g.textAlign = "center";
	g.lineWidth = 1;
	for (let v = Math.ceil(-span / step) * step; v <= span; v += step) {
		const x = X(center + v);
		g.beginPath();
		g.moveTo(x, top - 4);
		g.lineTo(x, h - bottom + 4);
		g.stroke();
		g.fillText(`${fmtTick(v)}`, x, h - bottom + 14);
	}
	g.textAlign = "left";
	g.fillText(msg("axisOffset"), x0, 9);

	// 合議の範囲（全ての一致した区間の共通部分）
	g.fillStyle = C.ok;
	g.globalAlpha = 0.16;
	g.fillRect(X(e.lo), top - 4, Math.max(X(e.hi) - X(e.lo), 1), h - top - bottom + 8);
	g.globalAlpha = 1;
	g.strokeStyle = C.ok;
	g.beginPath();
	g.moveTo(X(center), top - 4);
	g.lineTo(X(center), h - bottom + 4);
	g.stroke();

	const rows = [
		...states.map((s) => ({ kind: "src" as const, s })),
		{ kind: "device" as const, s: null },
	];
	rows.forEach((r, i) => {
		const y = top + rowH * (i + 0.5);
		const barH = Math.max(Math.min(rowH * 0.42, 14), 4);
		if (r.kind === "device") {
			const dev = Date.now() - now;
			const x = X(dev);
			g.fillStyle = C.dim;
			g.fillText(msg("deviceClock"), 0, y);
			g.fillStyle = C.warn;
			const cx = clampX(x);
			g.beginPath();
			if (x < x0 || x > x1) {
				const d = x < x0 ? -1 : 1;
				g.moveTo(cx, y);
				g.lineTo(cx - d * 8, y - 6);
				g.lineTo(cx - d * 8, y + 6);
				g.fill();
				g.textAlign = d < 0 ? "left" : "right";
				g.fillText(`${fmtTick(dev - center)} ms`, cx - d * 12, y);
				g.textAlign = "left";
			} else {
				g.moveTo(cx, y - 7);
				g.lineTo(cx + 6, y);
				g.lineTo(cx, y + 7);
				g.lineTo(cx - 6, y);
				g.fill();
			}
			return;
		}
		const s = r.s;
		const color = s.status === "ok" ? C.fg : s.status === "pending" ? C.dim : C.bad;
		const pulse = animate ? Math.max(0, 1 - (now - (clock.lastSampleAt.get(s.id) ?? -1e9)) / 600) : 0;
		if (pulse > 0) {
			g.fillStyle = C.fg;
			g.globalAlpha = 0.08 * pulse;
			g.fillRect(0, y - rowH / 2, w, rowH);
			g.globalAlpha = 1;
		}
		g.fillStyle = s.status === "ok" ? C.fg : C.dim;
		g.fillText(s.label, 0, y);

		// 過去のサンプル（薄く）
		g.fillStyle = color;
		for (const a of clock.agedSamples(s.id, now)) {
			const l = clampX(X(a.lo));
			const rr = clampX(X(a.hi));
			if (rr - l < 0.5) continue;
			g.globalAlpha = 0.12;
			g.fillRect(l, y - barH / 2, rr - l, barH);
		}
		g.globalAlpha = 1;
		if (s.lo === null || s.hi === null) {
			g.fillStyle = C.dim;
			g.fillText(s.status === "down" ? msg("down") : "…", x0 + 4, y);
			return;
		}
		const l = X(s.lo);
		const rr = X(s.hi);
		g.fillStyle = color;
		g.fillRect(clampX(l), y - barH / 2, Math.max(clampX(rr) - clampX(l), 2), barH);
		if (rr < x0 || l > x1) {
			const d = rr < x0 ? -1 : 1;
			const cx = d < 0 ? x0 : x1;
			g.beginPath();
			g.moveTo(cx + d * 2, y);
			g.lineTo(cx - d * 8, y - 7);
			g.lineTo(cx - d * 8, y + 7);
			g.fill();
			g.textAlign = d < 0 ? "left" : "right";
			g.fillText(`${fmtTick((s.lo + s.hi) / 2 - center)} ms`, cx - d * 12, y);
			g.textAlign = "left";
		}
	});
}

/** 合議の範囲の推移。帯の傾きがこの端末の時計の速さのずれ */
export function drawHistory(canvas: HTMLCanvasElement, clock: Clock) {
	const { g, w, h } = setup(canvas);
	const hist = clock.history;
	const font = css("--mono");
	const C = { fg: css("--fg"), dim: css("--dim"), rule: css("--rule"), ok: css("--ok") };
	g.font = `11px ${font}`;
	g.textBaseline = "middle";
	const e = clock.estimate;
	if (!e || hist.length < 2) {
		g.fillStyle = C.dim;
		g.fillText(msg("collecting"), 0, h / 2);
		return;
	}
	const now = mono();
	const t0 = hist[0].at;
	const tSpan = Math.max(now - t0, 10_000);
	const ref = e.offset;
	let ySpan = 2;
	for (const p of hist) ySpan = Math.max(ySpan, Math.abs(p.lo - ref), Math.abs(p.hi - ref));
	ySpan = Math.min(ySpan * 1.1, 500);
	const left = 44;
	const top = 18;
	const bottom = 22;
	const X = (t: number) => left + ((t - t0) / tSpan) * (w - left - 8);
	const Y = (v: number) => top + (1 - (v - ref + ySpan) / (2 * ySpan)) * (h - top - bottom);

	const step = niceStep(2 * ySpan, 4);
	g.strokeStyle = C.rule;
	g.fillStyle = C.dim;
	g.textAlign = "right";
	for (let v = Math.ceil(-ySpan / step) * step; v <= ySpan; v += step) {
		g.beginPath();
		g.moveTo(left, Y(ref + v));
		g.lineTo(w - 8, Y(ref + v));
		g.stroke();
		g.fillText(fmtTick(v), left - 6, Y(ref + v));
	}
	g.textAlign = "left";
	g.fillText(msg("historyTitle"), left, 7);
	g.textAlign = "right";
	g.fillText(msg("seconds", { n: Math.round(tSpan / 1000) }), w - 8, h - 8);
	g.textAlign = "left";

	g.fillStyle = C.ok;
	g.globalAlpha = 0.25;
	g.beginPath();
	hist.forEach((p, i) => (i ? g.lineTo(X(p.at), Y(p.hi)) : g.moveTo(X(p.at), Y(p.hi))));
	for (let i = hist.length - 1; i >= 0; i--) g.lineTo(X(hist[i].at), Y(hist[i].lo));
	g.closePath();
	g.fill();
	g.globalAlpha = 1;
	g.strokeStyle = C.ok;
	g.beginPath();
	hist.forEach((p, i) => (i ? g.lineTo(X(p.at), Y(p.offset)) : g.moveTo(X(p.at), Y(p.offset))));
	g.stroke();

	const r = clock.rate;
	if (r.points >= 2 && r.hi - r.lo < 150e-6) {
		g.fillStyle = C.fg;
		g.textAlign = "right";
		g.fillText(msg("rateEstimate", { n: r.points, m: Math.round(r.spanMs / 60000) }), w - 8, 7);
		g.textAlign = "left";
	}
}
