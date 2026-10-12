import { mkdirSync, writeFileSync } from "node:fs";
import { type Page, test } from "@playwright/test";

export type Offsets = Partial<Record<"edge" | "akamai" | "nict" | "timeapi" | "timenow", number | "down" | ((now: number) => number)>>;

const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

/** delayAfterStamp: 時刻を決めてから応答するまでの待ち。往復の非対称を作るため */
let delayAfterStamp = 0;
export function setDelayAfterStamp(ms: number) {
	delayAfterStamp = ms;
}

/** 各時刻源を「このマシンの時計 + 指定ms」を返すよう差し替える。"down" は接続失敗、関数なら任意の時刻。o は後から書き換えられる */
export async function mockSources(page: Page, o: Offsets) {
	const route = async (pattern: string, key: keyof Offsets, body: (t: number) => string, type: string) => {
		await page.route(pattern, async (r) => {
			const d = o[key];
			if (d === undefined) return r.fallback();
			if (d === "down") return r.abort("connectionrefused");
			const now = Date.now();
			if (delayAfterStamp) await new Promise((res) => setTimeout(res, delayAfterStamp));
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

export async function waitRounds(page: Page, n: number) {
	await page.waitForFunction((n) => (window.__clock.state() as { rounds: number }).rounds >= n, n, { timeout: 30_000 });
}

export function save(name: string, data: unknown) {
	mkdirSync("artifacts/results", { recursive: true });
	writeFileSync(`artifacts/results/${name}.json`, JSON.stringify(data, null, 2));
}

export async function shot(page: Page, name: string) {
	await page.screenshot({ path: `artifacts/screenshots/${test.info().project.name}-${name}.png` });
}
