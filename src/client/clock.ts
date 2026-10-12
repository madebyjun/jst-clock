import type { Source } from "./sources.ts";

const MAX_DRIFT = 100e-6;
const RATE_MARGIN = 1e-6;
const RATE_WINDOW_MS = 60 * 60_000;
const KEEP_MS = 10 * 60_000;
const TIMEOUT_MS = 3000;
const SAMPLES_PER_ROUND = 2;
const JUMP_THRESHOLD_MS = 20;
const SLEW_MS_PER_S = 5;

export const mono = () => performance.timeOrigin + performance.now();

type Sample = { lo: number; hi: number; at: number; rtt: number; timed: boolean; host: string };

export type SourceState = {
	id: string;
	label: string;
	status: "pending" | "ok" | "falseticker" | "down";
	lo: number | null;
	hi: number | null;
	rtt: number | null;
	timed: boolean;
	lastError: string | null;
};

export type Estimate = {
	at: number;
	offset: number;
	lo: number;
	hi: number;
	agreeing: number;
	responding: number;
};

/** 「正しい時刻 − 端末の時計」が1msあたり何ms変わるかの範囲。端末の時計が遅いと正 */
export type Rate = { lo: number; hi: number; points: number; spanMs: number };

function age(s: { lo: number; hi: number; at: number }, now: number, rate: { lo: number; hi: number }) {
	const dt = now - s.at;
	return { lo: s.lo + rate.lo * dt, hi: s.hi + rate.hi * dt };
}

type RatePoint = { at: number; lo: number; hi: number };

/**
 * 新しい点から順に足し、全ての2点の組が許す速さの共通部分を取る。共通部分が空になったら、それより古い点は
 * 速さが変わる前のものとみなして捨てる。最小二乗の傾きにしないのは、範囲でないと誤差上限の保証が崩れるため
 */
function estimateRate(points: RatePoint[], maxDrift: number): { rate: Rate; kept: RatePoint[] } {
	let lo = Number.NEGATIVE_INFINITY;
	let hi = Number.POSITIVE_INFINITY;
	const kept: RatePoint[] = [];
	for (let k = points.length - 1; k >= 0; k--) {
		const p = points[k];
		let nlo = lo;
		let nhi = hi;
		for (const q of kept) {
			const dt = q.at - p.at;
			if (dt <= 0) continue;
			nlo = Math.max(nlo, (q.lo - p.hi) / dt);
			nhi = Math.min(nhi, (q.hi - p.lo) / dt);
		}
		if (nlo > nhi) break;
		lo = nlo;
		hi = nhi;
		kept.unshift(p);
	}
	const spanMs = kept.length ? kept[kept.length - 1].at - kept[0].at : 0;
	return {
		rate: {
			lo: Math.max(-maxDrift, lo - RATE_MARGIN),
			hi: Math.min(maxDrift, hi + RATE_MARGIN),
			points: kept.length,
			spanMs,
		},
		kept,
	};
}

// 区間の重なり数が最大になる範囲を探す（Marzullo法）
function marzullo(iv: { lo: number; hi: number }[]) {
	const ev = iv.flatMap((x) => [
		{ v: x.lo, d: 1 },
		{ v: x.hi, d: -1 },
	]);
	ev.sort((a, b) => a.v - b.v || b.d - a.d);
	let n = 0;
	let best = 0;
	let lo = 0;
	let hi = 0;
	for (let i = 0; i < ev.length; i++) {
		n += ev[i].d;
		if (n > best) {
			best = n;
			lo = ev[i].v;
			hi = ev[i + 1].v;
		}
	}
	return { count: best, lo, hi };
}

async function resourceEntry(url: string) {
	for (let i = 0; i < 5; i++) {
		const e = performance.getEntriesByName(url, "resource").at(-1) as PerformanceResourceTiming | undefined;
		if (e && e.responseStart > 0) {
			performance.clearResourceTimings();
			return e;
		}
		await new Promise((r) => setTimeout(r, 10));
	}
	return null;
}

async function sampleOnce(src: Source, n: number): Promise<Sample> {
	const base = src.urls[n % src.urls.length];
	const url = new URL(base, location.href);
	url.searchParams.set("_", `${Math.round(mono())}${n}`);
	const href = url.href;
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	try {
		let t0 = mono();
		const res = await fetch(href, { cache: "no-store", signal: ctrl.signal });
		const body = await res.text();
		let t1 = mono();
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const s = src.parse(body);
		if (!Number.isFinite(s)) throw new Error("parse");
		let timed = false;
		if (src.resourceTiming) {
			const e = await resourceEntry(href);
			// requestStart が 0 なのは Timing-Allow-Origin が無いときで、その場合は fetch 前後の時刻で代用する
			if (e && e.requestStart > 0) {
				t0 = performance.timeOrigin + e.requestStart;
				t1 = performance.timeOrigin + e.responseStart;
				timed = true;
			}
		}
		return { lo: s - t1, hi: s + src.resolutionMs - t0, at: t1, rtt: t1 - t0, timed, host: url.host };
	} finally {
		clearTimeout(timer);
	}
}

export class Clock {
	private samples = new Map<string, Sample[]>();
	private errors = new Map<string, string | null>();
	private displayOffset: number | null = null;
	private lastTick = 0;
	estimate: Estimate | null = null;
	history: { at: number; offset: number; lo: number; hi: number }[] = [];
	private ratePoints: RatePoint[] = [];
	rate: Rate;
	lastRoundOk = 0;
	lastSampleAt = new Map<string, number>();
	rounds = 0;
	lastSyncAt: number | null = null;

	constructor(
		private sources: Source[],
		private maxDrift = MAX_DRIFT,
	) {
		this.rate = { lo: -maxDrift, hi: maxDrift, points: 0, spanMs: 0 };
	}

	async round() {
		const start = mono();
		await Promise.all(
			this.sources.map(async (src) => {
				for (let i = 0; i < SAMPLES_PER_ROUND; i++) {
					try {
						const s = await sampleOnce(src, this.rounds * SAMPLES_PER_ROUND + i);
						const list = this.samples.get(src.id) ?? [];
						list.push(s);
						this.samples.set(src.id, list);
						this.errors.set(src.id, null);
						this.lastSampleAt.set(src.id, s.at);
						this.recompute({ requireAgreement: true });
					} catch (e) {
						this.errors.set(src.id, e instanceof Error ? e.message : String(e));
					}
				}
			}),
		);
		this.rounds++;
		this.lastSyncAt = mono();
		this.learnRate(start);
		this.recompute();
		if (this.estimate) this.history.push({ at: this.estimate.at, offset: this.estimate.offset, lo: this.estimate.lo, hi: this.estimate.hi });
		this.history = this.history.filter((h) => this.lastSyncAt! - h.at < KEEP_MS);
	}

	/** この回に取れたサンプルだけで合議した区間を、速さの推定の点として足す */
	private learnRate(start: number) {
		const end = mono();
		const bound = { lo: -this.maxDrift, hi: this.maxDrift };
		const fresh = this.sources
			.map((src) => {
				let pick: { lo: number; hi: number } | null = null;
				for (const s of this.samples.get(src.id) ?? []) {
					if (s.at < start) continue;
					// ここで推定済みの速さを使わないのは、推定した速さが自分の根拠になる循環を避けるため
					const a = age(s, end, bound);
					if (!pick || a.hi - a.lo < pick.hi - pick.lo) pick = a;
				}
				return pick;
			})
			.filter((x) => x !== null);
		this.lastRoundOk = fresh.length;
		if (fresh.length >= 2) {
			const m = marzullo(fresh);
			if (m.count >= 2) this.ratePoints.push({ at: end, lo: m.lo, hi: m.hi });
		}
		this.ratePoints = this.ratePoints.filter((p) => end - p.at < RATE_WINDOW_MS);
		const r = estimateRate(this.ratePoints, this.maxDrift);
		this.rate = r.rate;
		this.ratePoints = r.kept;
	}

	reset() {
		this.samples.clear();
		this.history = [];
		this.ratePoints = [];
		this.rate = { lo: -this.maxDrift, hi: this.maxDrift, points: 0, spanMs: 0 };
		this.estimate = null;
		this.displayOffset = null;
	}

	private best(id: string, now: number) {
		const list = (this.samples.get(id) ?? []).filter((s) => now - s.at < KEEP_MS);
		this.samples.set(id, list);
		let pick: { lo: number; hi: number; s: Sample } | null = null;
		for (const s of list) {
			const a = age(s, now, this.rate);
			if (!pick || a.hi - a.lo < pick.hi - pick.lo) pick = { ...a, s };
		}
		return pick;
	}

	/**
	 * requireAgreement: 問い合わせの途中では、2つ以上の時刻源が一致するまで推定を更新しない。
	 * 1つ目に返ってきた時刻源（たいてい近い自前Worker）だけで確定させると、それが狂っていても気づけないため
	 */
	recompute({ requireAgreement = false } = {}) {
		const now = mono();
		const live = this.sources.map((src) => ({ src, b: this.best(src.id, now) })).filter((x) => x.b);
		if (live.length === 0) {
			this.estimate = null;
			return;
		}
		const m = marzullo(live.map((x) => x.b!));
		if (requireAgreement && m.count < 2) return;
		this.estimate = {
			at: now,
			offset: (m.lo + m.hi) / 2,
			lo: m.lo,
			hi: m.hi,
			agreeing: m.count,
			responding: live.length,
		};
	}

	/** 時刻源ごとの保持中サンプルを、経過時間ぶん広げた区間で返す */
	agedSamples(id: string, now = mono()) {
		return (this.samples.get(id) ?? []).map((s) => ({ ...age(s, now, this.rate), at: s.at, timed: s.timed }));
	}

	sourceStates(): SourceState[] {
		const now = mono();
		return this.sources.map((src) => {
			const b = this.best(src.id, now);
			const err = this.errors.get(src.id) ?? null;
			let status: SourceState["status"] = "pending";
			if (b && this.estimate) {
				status = b.lo <= this.estimate.hi && b.hi >= this.estimate.lo ? "ok" : "falseticker";
			} else if (err) status = "down";
			return {
				id: src.id,
				label: src.label,
				status,
				lo: b?.lo ?? null,
				hi: b?.hi ?? null,
				rtt: b?.s.rtt ?? null,
				timed: b?.s.timed ?? false,
				lastError: err,
			};
		});
	}

	/** 補正後の時刻（Unix ms）。未同期なら null */
	now(at = mono()): number | null {
		this.tick(at);
		return this.displayOffset === null ? null : at + this.displayOffset;
	}

	private tick(at: number) {
		if (!this.estimate) return;
		const target = this.estimate.offset + ((this.rate.lo + this.rate.hi) / 2) * (at - this.estimate.at);
		if (this.displayOffset === null || Math.abs(target - this.displayOffset) > JUMP_THRESHOLD_MS) {
			this.displayOffset = target;
		} else if (at > this.lastTick) {
			const step = ((at - this.lastTick) / 1000) * SLEW_MS_PER_S;
			const d = target - this.displayOffset;
			this.displayOffset += Math.sign(d) * Math.min(Math.abs(d), step);
		}
		this.lastTick = Math.max(this.lastTick, at);
	}
}
