import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Page, test } from "@playwright/test";

type Reply = number | ((now: number) => number);
/** { offset, delayAfterStampMs } はその時刻源だけ応答を遅らせ、区間を広げる */
export type Offsets = Partial<Record<"edge" | "akamai" | "nict" | "timeapi" | "timenow", Reply | "down" | { offset: Reply; delayAfterStampMs: number }>>;

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
			const reply = typeof d === "object" ? d.offset : d;
			const wait = typeof d === "object" ? d.delayAfterStampMs : delayAfterStamp;
			if (wait) await new Promise((res) => setTimeout(res, wait));
			return r.fulfill({ status: 200, headers: CORS, contentType: type, body: body(typeof reply === "function" ? reply(now) : now + reply) });
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

/** 実行ごとに上書きせず残す。不定期にしか起きない失敗を、起きた回の材料で調べるため */
export function saveUnique(dir: string, data: unknown) {
	mkdirSync(`artifacts/results/${dir}`, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	writeFileSync(`artifacts/results/${dir}/${stamp}-${process.pid}.json`, JSON.stringify(data, null, 2));
}

export async function shot(page: Page, name: string) {
	await page.screenshot({ path: `artifacts/screenshots/${test.info().project.name}-${name}.png` });
}

export type Decoded = {
	frame: number;
	pts: number | null;
	status: string;
	format: number | null;
	hold_ms: number | null;
	n: number | null;
	n_hi: number | null;
	frac: number | null;
	n_t: number | null;
	t_ms: number | null;
	t_lo_ms: number | null;
	t_hi_ms: number | null;
	t_est_ms: number | null;
	qr: string;
};

/** tools/decode-timecode.ts を CLI として実行し、CSV を読む */
export function decode(files: string[], csvPath: string, extra: string[] = []): Decoded[] {
	execFileSync(process.execPath, ["tools/decode-timecode.ts", ...files, "--out", csvPath, ...extra], { stdio: ["ignore", "ignore", "inherit"] });
	const [head, ...lines] = readFileSync(csvPath, "utf8").trim().split("\n");
	const cols = head.split(",");
	return lines.map((line) => {
		const cells: string[] = [];
		let cur = "";
		let quoted = false;
		for (const ch of line) {
			if (ch === '"') quoted = !quoted;
			else if (ch === "," && !quoted) {
				cells.push(cur);
				cur = "";
			} else cur += ch;
		}
		cells.push(cur);
		const o = Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
		const num = (v: string) => (v === "" ? null : Number(v));
		return {
			frame: Number(o.frame),
			pts: num(o.pts),
			status: o.status,
			format: num(o.format),
			hold_ms: num(o.hold_ms),
			n: num(o.n),
			n_hi: num(o.n_hi),
			frac: num(o.frac),
			n_t: num(o.n_t),
			t_ms: num(o.t_ms),
			t_lo_ms: num(o.t_lo_ms),
			t_hi_ms: num(o.t_hi_ms),
			t_est_ms: num(o.t_est_ms),
			qr: o.qr,
		};
	});
}

export const confirmed = (r: Decoded) => (r.status === "ok" || r.status === "mixed") && r.t_ms !== null;
