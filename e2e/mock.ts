import type { Page } from "@playwright/test";

export type Offsets = Partial<Record<"edge" | "akamai" | "nict" | "timeapi" | "timenow", number | "down" | ((now: number) => number)>>;

const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

/** 各時刻源を「このマシンの時計 + 指定ms」を返すよう差し替える。"down" は接続失敗、関数なら任意の時刻。o は後から書き換えられる */
export async function mockSources(page: Page, o: Offsets) {
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

export async function waitRounds(page: Page, n: number) {
	await page.waitForFunction((n) => (window.__clock.state() as { rounds: number }).rounds >= n, n, { timeout: 30_000 });
}
