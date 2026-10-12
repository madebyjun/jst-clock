import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { ntpReference } from "./ntp.ts";

type Offsets = Partial<Record<"edge" | "akamai" | "nict" | "timeapi" | "timenow", number | "down" | ((now: number) => number)>>;

const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

/** 各時刻源を「このマシンの時計 + 指定ms」を返すよう差し替える。"down" は接続失敗、関数なら任意の時刻。o は後から書き換えられる */
async function mockSources(page: Page, o: Offsets) {
	const route = async (pattern: string, key: keyof Offsets, body: (t: number) => string, type: string) => {
		await page.route(pattern, (r) => {
			const d = o[key];
			if (d === undefined) return r.fallback();
			if (d === "down") return r.abort("connectionrefused");
			const now = Date.now();
			return r.fulfill({ status: 200, headers: CORS, contentType: type, body: body(typeof d === "function" ? d(now) : now + d) });
		});
	};
	const json = "application/json";
	await route("**/api/time?*", "edge", (t) => JSON.stringify({ t, colo: "TEST" }), json);
	await route("https://time.akamai.com/**", "akamai", (t) => (t / 1000).toFixed(3), "text/plain");
	await route("https://*.nict.go.jp/**", "nict", (t) => JSON.stringify({ id: "mock", it: 0, st: t / 1000, leap: 36, next: 0, step: 1 }), json);
	await route("https://timeapi.io/**", "timeapi", (t) => JSON.stringify({ dateTime: `${new Date(t).toISOString().slice(0, 23)}0000` }), json);
	await route("https://time.now/**", "timenow", (t) => JSON.stringify({ utc_datetime: new Date(t).toISOString() }), json);
}

async function waitRounds(page: Page, n: number) {
	await page.waitForFunction((n) => (window.__clock.state() as { rounds: number }).rounds >= n, n, { timeout: 30_000 });
}

/** ページが推定した「正しい時刻 − システム時計(Date.now)」と、各時刻源の判定 */
async function pageView(page: Page) {
	return page.evaluate(() => {
		const st = window.__clock.state() as {
			estimate: { lo: number; hi: number; agreeing: number; responding: number } | null;
			sources: { id: string; status: string }[];
		};
		const now = window.__clock.now();
		return {
			offsetVsSystem: now === null ? null : now - Date.now(),
			half: st.estimate ? (st.estimate.hi - st.estimate.lo) / 2 : null,
			agreeing: st.estimate?.agreeing ?? 0,
			responding: st.estimate?.responding ?? 0,
			status: Object.fromEntries(st.sources.map((s) => [s.id, s.status])),
			text: document.getElementById("state")!.textContent,
			synced: document.body.dataset.synced,
		};
	});
}

function save(name: string, data: unknown) {
	mkdirSync("artifacts/results", { recursive: true });
	writeFileSync(`artifacts/results/${name}.json`, JSON.stringify(data, null, 2));
}

async function shot(page: Page, name: string) {
	await page.screenshot({ path: `artifacts/screenshots/${test.info().project.name}-${name}.png` });
}

test("全時刻源が一致すれば、その時刻をシステム時計より優先して表示する", async ({ page }) => {
	await mockSources(page, { edge: 200, akamai: 200, nict: 200, timeapi: 200, timenow: 200 });
	await page.goto("/");
	await waitRounds(page, 3);
	const v = await pageView(page);
	expect(v.agreeing).toBe(5);
	expect(v.offsetVsSystem!).toBeGreaterThan(195);
	expect(v.offsetVsSystem!).toBeLessThan(205);
	await expect(page.locator("#dot")).toHaveAttribute("data-level", "ok");
	await shot(page, "agree");
	save(`${test.info().project.name}-agree`, v);
});

test("1つだけ大きくずれた時刻源は除外され、推定に影響しない", async ({ page }) => {
	await mockSources(page, { edge: 200, akamai: 700, nict: 200, timeapi: 200, timenow: 200 });
	await page.goto("/");
	await waitRounds(page, 3);
	const v = await pageView(page);
	expect(v.status.akamai).toBe("falseticker");
	expect(v.agreeing).toBe(4);
	expect(Math.abs(v.offsetVsSystem! - 200)).toBeLessThan(5);
	await expect(page.locator('tr[data-source="akamai"] td').nth(1)).toHaveText("除外");
	await shot(page, "falseticker");
	save(`${test.info().project.name}-falseticker`, v);
});

test("外部の時刻源が全部落ちても自前のWorkerだけで表示し、照合できていないと警告する", async ({ page }) => {
	await mockSources(page, { akamai: "down", nict: "down", timeapi: "down", timenow: "down" });
	await page.goto("/");
	await waitRounds(page, 1);
	await expect(page.locator("body")).toHaveAttribute("data-synced", "true");
	const v = await pageView(page);
	expect(v.agreeing).toBe(1);
	expect(v.text).toContain("照合できていません");
	await expect(page.locator("#dot")).toHaveAttribute("data-level", "warn");
	await shot(page, "edge-only");
	save(`${test.info().project.name}-edge-only`, v);
});

test("全時刻源が落ちたら、端末の時計を正しい時刻のように見せない", async ({ page }) => {
	await mockSources(page, { edge: "down", akamai: "down", nict: "down", timeapi: "down", timenow: "down" });
	await page.goto("/");
	await waitRounds(page, 1);
	await expect(page.locator("body")).toHaveAttribute("data-synced", "false");
	const v = await pageView(page);
	expect(v.offsetVsSystem).toBeNull();
	await expect(page.locator("#time")).toHaveText("--:--:--.---");
	await expect(page.locator("#state")).toHaveText("どの時刻源にも接続できません");
	await shot(page, "all-down");
});

test("表示時刻は単調に進み、桁の位置は動かない", async ({ page }) => {
	await mockSources(page, { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 });
	await page.goto("/");
	await waitRounds(page, 3);
	const r = await page.evaluate(async () => {
		const xs: { drift: number; t: number; left: number[] }[] = [];
		const slots = [...document.querySelectorAll("#time > span")] as HTMLElement[];
		for (let i = 0; i < 40; i++) {
			const p = performance.timeOrigin + performance.now();
			const t = window.__clock.now(p)!;
			xs.push({ drift: t - p, t, left: slots.map((s) => s.getBoundingClientRect().left) });
			await new Promise((r) => setTimeout(r, 53));
		}
		return {
			driftRange: Math.max(...xs.map((x) => x.drift)) - Math.min(...xs.map((x) => x.drift)),
			monotonic: xs.every((x, i) => i === 0 || x.t > xs[i - 1].t),
			layoutStable: xs.every((x) => x.left.every((l, j) => Math.abs(l - xs[0].left[j]) < 0.01)),
			overflow: document.documentElement.scrollWidth - innerWidth,
		};
	});
	expect(r.monotonic).toBe(true);
	expect(r.driftRange).toBeLessThan(2);
	expect(r.layoutStable).toBe(true);
	expect(r.overflow).toBeLessThanOrEqual(0);
	save(`${test.info().project.name}-stability`, r);
});

test("実際の時刻源で同期した結果が、NTPで別に測った正しい時刻と誤差上限内で一致する", async ({ page }, info) => {
	test.skip(!!process.env.OFFLINE, "OFFLINE=1 のときはネットワーク試験をしない");
	test.skip(info.project.name !== "desktop", "ネットワーク試験は1回で十分");
	test.setTimeout(120_000);
	await page.goto("/");
	await waitRounds(page, 3);
	const ntpBefore = await ntpReference();
	const v = await pageView(page);
	const ntpAfter = await ntpReference();
	const ntp = [...ntpBefore, ...ntpAfter].reduce((a, b) => (b.delay < a.delay ? b : a));
	const diff = v.offsetVsSystem! - ntp.offset;
	const bound = v.half! + ntp.half + 2;
	await shot(page, "real-network");
	const report = {
		at: new Date().toISOString(),
		baseURL: info.project.use.baseURL,
		page: v,
		ntp: { best: ntp, all: [...ntpBefore, ...ntpAfter] },
		diffMs: diff,
		boundMs: bound,
		pass: Math.abs(diff) <= bound,
	};
	save("real-network", report);
	expect(v.agreeing).toBeGreaterThanOrEqual(2);
	expect(Math.abs(diff)).toBeLessThanOrEqual(bound);
});

test("端末の時計の速さを学習し、時刻源が全部落ちてもその速さで正しい時刻を保つ", async ({ page }) => {
	test.setTimeout(90_000);
	// 5000ppm は実在の水晶より極端だが、短時間の試験で速さの推定を確かめるため。maxdrift を合わせて広げる
	const eps = 5000e-6;
	const t0 = Date.now();
	const truth = (now: number) => now + 200 + eps * (now - t0);
	const o: Offsets = { edge: truth, akamai: truth, nict: truth, timeapi: truth, timenow: truth };
	await mockSources(page, o);
	await page.goto("/?interval=1000&maxdrift=20000");
	await waitRounds(page, 20);
	const rate = await page.evaluate(() => (window.__clock.state() as { rate: { lo: number; hi: number; points: number } }).rate);
	expect(rate.lo).toBeLessThanOrEqual(eps);
	expect(rate.hi).toBeGreaterThanOrEqual(eps);
	expect(rate.hi - rate.lo).toBeLessThan(1000e-6);

	for (const k of Object.keys(o) as (keyof Offsets)[]) o[k] = "down";
	await page.waitForTimeout(10_000);
	await expect(page.locator("#state")).toHaveText("時刻源に接続できず、端末の時計の速さから推定中");
	const v = await page.evaluate(() => {
		const st = window.__clock.state() as { estimate: { lo: number; hi: number } };
		return { now: window.__clock.now()!, sys: Date.now(), half: (st.estimate.hi - st.estimate.lo) / 2 };
	});
	const err = v.now - truth(v.sys);
	// 速さを学習していなければ 5000ppm × 10秒 = 50ms ずれる
	expect(Math.abs(err)).toBeLessThan(10);
	expect(Math.abs(err)).toBeLessThanOrEqual(v.half + 2);
	await shot(page, "holdover");
	save(`${test.info().project.name}-holdover`, { rate, err, half: v.half, withoutRateWouldBeMs: eps * 10_000 });
});

type Kept = { rounds: number; history: number; points: number; suspends: number };

/** 画面を隠す・戻す。skewMs を渡すと、戻す直前に Date.now だけを進めて「performance.now が止まっていたスリープ」と同じ状況にする */
async function setHidden(page: Page, hidden: boolean, skewMs = 0): Promise<Kept> {
	return page.evaluate(
		({ hidden, skewMs }) => {
			if (skewMs) {
				const real = Date.now.bind(Date);
				Date.now = () => real() + skewMs;
			}
			Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
			Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
			document.dispatchEvent(new Event("visibilitychange"));
			const st = window.__clock.state() as { rounds: number; history: number; rate: { points: number }; suspends: number };
			return { rounds: st.rounds, history: st.history, points: st.rate.points, suspends: st.suspends };
		},
		{ hidden, skewMs },
	);
}

async function kept(page: Page): Promise<Kept> {
	return page.evaluate(() => {
		const st = window.__clock.state() as { rounds: number; history: number; rate: { points: number }; suspends: number };
		return { rounds: st.rounds, history: st.history, points: st.rate.points, suspends: st.suspends };
	});
}

test("スリープせずにタブを切り替えて戻っても、履歴と速さの推定を残し、すぐ問い合わせ直す", async ({ page }) => {
	await mockSources(page, { edge: 200, akamai: 200, nict: 200, timeapi: 200, timenow: 200 });
	await page.goto("/");
	await waitRounds(page, 3);
	const before = await kept(page);
	await setHidden(page, true);
	await page.waitForTimeout(2_000);
	const shownAt = Date.now();
	const atShow = await setHidden(page, false);
	await waitRounds(page, before.rounds + 1);
	const roundMs = Date.now() - shownAt;
	const after = await kept(page);
	expect(atShow.history).toBeGreaterThanOrEqual(before.history);
	expect(atShow.points).toBeGreaterThanOrEqual(before.points);
	expect(after.history).toBeGreaterThanOrEqual(before.history);
	expect(after.history).toBeGreaterThanOrEqual(2);
	expect(after.points).toBeGreaterThanOrEqual(before.points);
	expect(after.suspends).toBe(0);
	await shot(page, "tab-return");
	save(`${test.info().project.name}-tab-return`, { before, atShow, after, roundMs });
});

test("スリープから戻ったときだけリセットし、数秒以内に推移グラフを描ける履歴を集め直す", async ({ page }) => {
	await mockSources(page, { edge: 200, akamai: 200, nict: 200, timeapi: 200, timenow: 200 });
	await page.goto("/");
	await waitRounds(page, 3);
	const before = await kept(page);
	await setHidden(page, true);
	const shownAt = Date.now();
	const atShow = await setHidden(page, false, 5_000);
	expect(atShow.suspends).toBe(1);
	expect(atShow.history).toBe(0);
	expect(atShow.points).toBe(0);
	await page.waitForFunction(() => (window.__clock.state() as { history: number }).history >= 2, null, { timeout: 5_000 });
	const refillMs = Date.now() - shownAt;
	await waitRounds(page, before.rounds + 3);
	const after = await kept(page);
	expect(after.suspends).toBe(1);
	expect(after.history).toBeGreaterThanOrEqual(2);
	await expect(page.locator("#dot")).toHaveAttribute("data-level", "ok");
	await shot(page, "suspend-return");
	save(`${test.info().project.name}-suspend-return`, { before, atShow, after, refillMs });
});
