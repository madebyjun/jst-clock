import { startBackground } from "./bg.ts";
import { Clock, mono } from "./clock.ts";
import { SOURCES } from "./sources.ts";
import { drawHistory, drawIntervals } from "./viz.ts";

const params = new URLSearchParams(location.search);
// interval と maxdrift はE2Eで速さの推定を短時間で確かめるためのもの
const ROUND_INTERVAL_MS = Number(params.get("interval")) || 30_000;
const BURST_ROUNDS = 3;
const JST_MS = 9 * 3600_000;

const extraLag = Number(params.get("lag") ?? 0) || 0;

const clock = new Clock(SOURCES, (Number(params.get("maxdrift")) || 100) * 1e-6);
const $ = (id: string) => document.getElementById(id)!;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
// 桁数が変わっても位置がずれないよう、数字幅の空白(U+2007)で左を埋める
const fig = (s: string, w: number) => s.padStart(w, "\u2007");
const fmtMs = (v: number, w = 6) => `${v >= 0 ? "+" : "−"}${fig(Math.abs(v).toFixed(1), w)} ms`;
const fmtPpm = (v: number) => `${v >= 0 ? "+" : "−"}${fig(Math.abs(v * 1e6).toFixed(1), 5)} ppm`;
const fmtPm = (v: number, w = 5) => `±${fig(v.toFixed(1), w)}`;

const TEMPLATE = "00:00:00.000";
const slots = [...TEMPLATE].map((c) => {
	const el = document.createElement("span");
	el.className = /\d/.test(c) ? "d" : "s";
	el.textContent = c === ":" || c === "." ? c : "-";
	return el;
});
$("time").replaceChildren(...slots);
function setTime(text: string) {
	for (let i = 0; i < slots.length; i++) if (slots[i].textContent !== text[i]) slots[i].textContent = text[i];
}

declare global {
	interface Window {
		__clock: { now: (at?: number) => number | null; state: () => unknown; sync: () => Promise<void> };
	}
}
window.__clock = {
	now: (at?: number) => clock.now(at),
	state: () => ({ estimate: clock.estimate, sources: clock.sourceStates(), rounds: clock.rounds, rate: clock.rate, lastRoundOk: clock.lastRoundOk }),
	sync: () => clock.round(),
};

let frameMs = 1000 / 60;
let lastViz = 0;
const vizHidden = params.has("min");
let prevTs = 0;

function frame(ts: number) {
	if (prevTs) {
		const d = ts - prevTs;
		if (d > 4 && d < 60) frameMs += (d - frameMs) * 0.05;
	}
	prevTs = ts;
	// rAF の時刻を描くと画面に出る頃には1フレーム古いので、次のフレームが表示される時刻を描く
	const t = clock.now(performance.timeOrigin + ts + frameMs + extraLag);
	if (t !== null) {
		const jst = new Date(t + JST_MS);
		const ms = jst.getUTCMilliseconds();
		setTime(`${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}.${pad(ms, 3)}`);
		$("date").textContent = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} JST`;
		$("fill").style.transform = `scaleX(${ms / 1000})`;
	}
	document.body.dataset.synced = String(t !== null);
	if (!vizHidden && ts - lastViz > 100) {
		lastViz = ts;
		drawIntervals($("viz-intervals") as HTMLCanvasElement, clock);
		drawHistory($("viz-history") as HTMLCanvasElement, clock);
	}
	requestAnimationFrame(frame);
}

function renderStatus() {
	if (clock.rounds > 0) clock.recompute();
	const e = clock.estimate;
	const states = clock.sourceStates();
	const dot = $("dot");
	if (!e) {
		dot.dataset.level = clock.rounds > 0 ? "bad" : "wait";
		$("state").textContent = clock.rounds > 0 ? "どの時刻源にも接続できません" : "時刻源に問い合わせ中";
		$("unc").textContent = "-";
		$("dev").textContent = "-";
	} else {
		const half = (e.hi - e.lo) / 2;
		const majority = e.agreeing * 2 > e.responding;
		const verified = e.agreeing >= 2;
		const holdover = clock.lastRoundOk === 0;
		dot.dataset.level = majority && verified && !holdover ? "ok" : "warn";
		$("state").textContent = holdover
			? "時刻源に接続できず、端末の時計の速さから推定中"
			: !verified
				? `時刻源が${e.agreeing}つだけで、照合できていません`
				: `${e.responding}つ中${e.agreeing}つの時刻源が一致`;
		$("unc").textContent = `${fmtPm(half)} ms`;
		$("dev").textContent = fmtMs(Date.now() - (mono() + e.offset));
	}
	const r = clock.rate;
	const learned = r.points >= 2 && r.hi - r.lo < 150e-6;
	// 端末の時計の速さは「正しい時刻 − 端末の時計」の増え方の符号を反転したもの
	$("rate").textContent = learned
		? `${fmtPpm(-(r.lo + r.hi) / 2)}（±${((r.hi - r.lo) / 2 * 1e6).toFixed(1)}）`
		: "推定中";
	$("frame").textContent = `${fig(frameMs.toFixed(1), 4)} ms${extraLag ? ` + ${extraLag} ms` : ""}`;

	const rows = $("rows");
	rows.replaceChildren(
		...states.map((s) => {
			const tr = document.createElement("tr");
			tr.dataset.status = s.status;
			tr.dataset.source = s.id;
			const mid = s.lo !== null && s.hi !== null && e ? (s.lo + s.hi) / 2 - e.offset : null;
			const cells = [
				s.label,
				{ pending: "待機中", ok: "一致", falseticker: "除外", down: "応答なし" }[s.status],
				mid === null ? "-" : fmtMs(mid),
				s.lo === null || s.hi === null ? "-" : fmtPm((s.hi - s.lo) / 2),
				s.rtt === null ? "-" : `${fig(s.rtt.toFixed(1), 6)}${s.timed ? "\u2007" : "*"}`,
			];
			for (const c of cells) {
				const td = document.createElement("td");
				td.textContent = c;
				tr.append(td);
			}
			return tr;
		}),
	);
}

let wakeLock: { release: () => Promise<void> } | null = null;
async function keepAwake() {
	try {
		wakeLock = await (navigator as any).wakeLock?.request("screen");
	} catch {
		wakeLock = null;
	}
	$("wake").textContent = wakeLock ? "画面スリープ防止中" : "画面スリープ防止が使えません";
}

document.addEventListener("visibilitychange", () => {
	if (document.hidden) return;
	keepAwake();
	// スリープ中に performance.now が止まる環境があり、古いサンプルの経過時間が信用できないので捨てて取り直す
	clock.reset();
	clock.round().then(renderStatus);
});

async function start() {
	keepAwake();
	for (let i = 0; i < BURST_ROUNDS; i++) {
		await clock.round();
		renderStatus();
	}
	setInterval(() => clock.round().then(renderStatus), ROUND_INTERVAL_MS);
}

for (let i = 1; i < 10; i++) {
	const tick = document.createElement("i");
	tick.style.left = `${i * 10}%`;
	$("bar").append(tick);
}
setInterval(renderStatus, 500);
requestAnimationFrame(frame);
start();
startBackground();
