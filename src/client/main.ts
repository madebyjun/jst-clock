import { startBackground } from "./bg.ts";
import { Clock, mono } from "./clock.ts";
import { setupControls } from "./controls.ts";
import { applyStatic, lang, msg, redirecting } from "./i18n.ts";
import { settings } from "./settings.ts";
import { SOURCES } from "./sources.ts";
import { mountTimecode } from "./timecode.ts";
import { drawHistory, drawIntervals } from "./viz.ts";
import { Zone } from "./zone.ts";

const params = new URLSearchParams(location.search);
// interval と maxdrift はE2Eで速さの推定を短時間で確かめるためのもの
const ROUND_INTERVAL_MS = Number(params.get("interval")) || 30_000;
const BURST_ROUNDS = 3;
const SUSPEND_GAP_MS = 1000;

let extraLag = settings.get("lag");
let zone = new Zone(settings.get("tz"), lang);
let vizShown = settings.get("details");
let animate = settings.get("animation");
function applyDetails() {
	vizShown = settings.get("details");
	document.body.classList.toggle("min", !vizShown);
}
function applyAnimation() {
	animate = settings.get("animation");
	document.documentElement.dataset.animation = animate ? "on" : "off";
}
settings.subscribe("lag", (v) => {
	extraLag = v;
	renderStatus();
});
settings.subscribe("tz", (v) => {
	zone = new Zone(v, lang);
});
settings.subscribe("details", applyDetails);
settings.subscribe("animation", applyAnimation);
applyStatic();
applyDetails();
applyAnimation();
setupControls();

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
const timecode = mountTimecode($("timecode"), clock, (t) => zone.offsetAt(t));
const applyCode = (on: boolean) => (on ? timecode.enable() : timecode.disable());
applyCode(settings.get("code"));
settings.subscribe("code", applyCode);

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
	state: () => ({
		bounds: clock.bounds(),
		shownOffset: clock.shownOffset(),
		shownError: clock.shownError(),
		estimate: clock.estimate,
		sources: clock.sourceStates(),
		rounds: clock.rounds,
		rate: clock.rate,
		lastRoundOk: clock.lastRoundOk,
		history: clock.history.length,
		suspends,
		debug: clock.debug(),
	}),
	sync: () => clock.round(),
};

let frameMs = 1000 / 60;
let lastViz = 0;
let prevTs = 0;
let dateKey = "";

function frame(ts: number) {
	if (prevTs) {
		const d = ts - prevTs;
		if (d > 4 && d < 60) frameMs += (d - frameMs) * 0.05;
	}
	prevTs = ts;
	// rAF の時刻を描くと画面に出る頃には1フレーム古いので、次のフレームが表示される時刻を描く
	const at = performance.timeOrigin + ts + frameMs + extraLag;
	const t = clock.now(at);
	if (t !== null) {
		const local = new Date(t + zone.offsetAt(t));
		const ms = local.getUTCMilliseconds();
		setTime(`${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}.${pad(ms, 3)}`);
		renderDate(t);
		$("fill").style.transform = `scaleX(${ms / 1000})`;
	}
	document.body.dataset.synced = String(t !== null);
	timecode.frame(t, at, frameMs, extraLag);
	if (vizShown && ts - lastViz > 100) {
		lastViz = ts;
		drawIntervals($("viz-intervals") as HTMLCanvasElement, clock, animate);
		drawHistory($("viz-history") as HTMLCanvasElement, clock);
	}
	requestAnimationFrame(frame);
}

function renderDate(t: number) {
	const d = zone.dateLine(t);
	const key = `${zone.id}|${d.day}|${d.name}|${d.offset}`;
	if (key === dateKey) return;
	dateKey = key;
	$("date-day").textContent = d.day;
	$("date-zone").textContent = d.name;
	$("date-offset").textContent = d.offset;
	document.body.dataset.tz = zone.id;
}

function renderStatus() {
	if (clock.rounds > 0) clock.recompute();
	const e = clock.estimate;
	const states = clock.sourceStates();
	const dot = $("dot");
	if (!e) {
		dot.dataset.level = clock.rounds > 0 ? "bad" : "wait";
		$("state").textContent = msg(clock.rounds > 0 ? "noSource" : "querying");
		$("unc").textContent = "-";
		$("dev").textContent = "-";
	} else {
		const half = clock.shownError() ?? (e.hi - e.lo) / 2;
		const majority = e.agreeing * 2 > e.responding;
		const verified = e.agreeing >= 2;
		const holdover = clock.lastRoundOk === 0;
		dot.dataset.level = majority && verified && !holdover ? "ok" : "warn";
		$("state").textContent = holdover
			? msg("holdover")
			: !verified
				? msg("unverified")
				: msg("agreeing", { a: e.agreeing, r: e.responding });
		$("unc").textContent = `${fmtPm(half)} ms`;
		$("dev").textContent = fmtMs(Date.now() - (mono() + e.offset));
	}
	const r = clock.rate;
	const learned = r.points >= 2 && r.hi - r.lo < 150e-6;
	// 端末の時計の速さは「正しい時刻 − 端末の時計」の増え方の符号を反転したもの
	$("rate").textContent = learned
		? `${fmtPpm(-(r.lo + r.hi) / 2)} (±${((r.hi - r.lo) / 2 * 1e6).toFixed(1)})`
		: msg("estimating");
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
				msg(s.status),
				mid === null ? "-" : fmtMs(mid),
				s.lo === null || s.hi === null ? "-" : fmtPm((s.hi - s.lo) / 2),
				s.rtt === null ? "-" : `${fig(s.rtt.toFixed(1), 6)}${s.timed ? "\u2007" : "*"}`,
			];
			cells.forEach((c, i) => {
				const td = document.createElement("td");
				if (i >= 2) {
					// セルごと direction: ltr にしないのは、右から左の言語で見出しと揃え（text-align: end）がずれるため
					const n = document.createElement("bdi");
					n.dir = "ltr";
					n.textContent = c;
					td.append(n);
				} else td.textContent = c;
				tr.append(td);
			});
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
	$("wake").textContent = msg(wakeLock ? "wakeOn" : "wakeOff");
}

let suspends = 0;
let wallAt = Date.now();
let monoAt = performance.now();
function suspended() {
	const wall = Date.now();
	const now = performance.now();
	const gap = wall - wallAt - (now - monoAt);
	wallAt = wall;
	monoAt = now;
	// 絶対値にしないのは、端末時計が戻る向きの補正はスリープでは起きず、誤検出を増やすだけだから
	return gap > SUSPEND_GAP_MS;
}

async function burst() {
	for (let i = 0; i < BURST_ROUNDS; i++) {
		await clock.round();
		renderStatus();
	}
}

function checkSuspend() {
	if (!suspended()) return false;
	suspends++;
	clock.reset();
	burst();
	return true;
}

document.addEventListener("visibilitychange", () => {
	const reset = checkSuspend();
	if (document.hidden) return;
	keepAwake();
	if (!reset) clock.round().then(renderStatus);
});

async function start() {
	keepAwake();
	await burst();
	startBackground();
	setInterval(() => clock.round().then(renderStatus), ROUND_INTERVAL_MS);
}

for (let i = 1; i < 10; i++) {
	const tick = document.createElement("i");
	tick.style.left = `${i * 10}%`;
	$("bar").append(tick);
}
if (!redirecting) {
	setInterval(() => {
		checkSuspend();
		renderStatus();
	}, 500);
	requestAnimationFrame(frame);
	start();
}
