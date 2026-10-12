import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const DIR = "artifacts/bg";
const PREFIX = "A-metaball";
const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

/** 背景の試験では時刻源の正しさは見ないので、全部をこのマシンの時計で返して外へ出ないようにする */
async function mockSources(page: Page) {
	const json = "application/json";
	const routes: [string, (t: number) => string, string][] = [
		["**/api/time?*", (t) => JSON.stringify({ t, colo: "TEST" }), json],
		["https://time.akamai.com/**", (t) => (t / 1000).toFixed(3), "text/plain"],
		["https://*.nict.go.jp/**", (t) => JSON.stringify({ id: "mock", it: 0, st: t / 1000, leap: 36, next: 0, step: 1 }), json],
		["https://timeapi.io/**", (t) => JSON.stringify({ dateTime: `${new Date(t).toISOString().slice(0, 23)}0000` }), json],
		["https://time.now/**", (t) => JSON.stringify({ utc_datetime: new Date(t).toISOString() }), json],
	];
	for (const [pattern, body, type] of routes) {
		await page.route(pattern, (r) => r.fulfill({ status: 200, headers: CORS, contentType: type, body: body(Date.now()) }));
	}
}

async function open(page: Page, path = "/") {
	await mockSources(page);
	await page.goto(path);
	await page.waitForFunction(() => (window.__clock.state() as { rounds: number }).rounds >= 3, null, { timeout: 30_000 });
	// 背景は最初の同期が済んでから始まる
	if (path.includes("bg=off")) await page.waitForTimeout(300);
	else await page.waitForFunction(() => (window.__bg?.frames ?? 0) >= 1, null, { timeout: 10_000 });
}

/** 背景キャンバスの画素を縮小して読み、比較用の指紋と明るさの統計を返す */
async function canvasStats(page: Page) {
	return page.evaluate(() => {
		const src = document.getElementById("bg") as HTMLCanvasElement;
		const c = document.createElement("canvas");
		c.width = src.width;
		c.height = src.height;
		const g = c.getContext("2d")!;
		g.drawImage(src, 0, 0);
		const d = g.getImageData(0, 0, c.width, c.height).data;
		let min = 255;
		let max = 0;
		let hash = 0;
		for (let i = 0; i < d.length; i += 4) {
			const v = d[i] + d[i + 1] + d[i + 2];
			min = Math.min(min, d[i + 1]);
			max = Math.max(max, d[i + 1]);
			hash = (Math.imul(hash, 31) + v) | 0;
		}
		return { min, max, hash, w: c.width, h: c.height };
	});
}

/** スクリーンショット(PNG)をページ内で画素に戻し、相対輝度の分布を返す */
async function luminances(page: Page, png: Buffer) {
	return page.evaluate(async (b64) => {
		const img = new Image();
		img.src = `data:image/png;base64,${b64}`;
		await img.decode();
		const c = document.createElement("canvas");
		c.width = img.width;
		c.height = img.height;
		const g = c.getContext("2d")!;
		g.drawImage(img, 0, 0);
		const d = g.getImageData(0, 0, c.width, c.height).data;
		const lin = (v: number) => {
			const s = v / 255;
			return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		};
		const out: number[] = [];
		for (let i = 0; i < d.length; i += 4) out.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
		return out.sort((a, b) => a - b);
	}, png.toString("base64"));
}

function save(name: string, data: unknown) {
	mkdirSync(DIR, { recursive: true });
	writeFileSync(`${DIR}/${PREFIX}-${name}.json`, JSON.stringify(data, null, 2));
}

test("背景のキャンバスが時計の後ろにあり、何かが描かれている", async ({ page }) => {
	await open(page);
	const bg = page.locator("canvas#bg");
	await expect(bg).toHaveCount(1);
	const style = await bg.evaluate((el) => {
		const s = getComputedStyle(el);
		return { position: s.position, z: s.zIndex, pointer: s.pointerEvents };
	});
	expect(style).toEqual({ position: "fixed", z: "-1", pointer: "none" });
	const s = await canvasStats(page);
	expect(s.max - s.min).toBeGreaterThan(15);
	await page.waitForTimeout(1500);
	const info = await page.evaluate(() => window.__bg);
	expect(info?.mode).not.toBe("off");
	mkdirSync(DIR, { recursive: true });
	await page.screenshot({ path: `${DIR}/${PREFIX}-${test.info().project.name}.png` });
	save(`${test.info().project.name}-canvas`, { ...s, ...info, viewport: page.viewportSize() });
});

test("背景は動き続ける", async ({ page }) => {
	await open(page);
	const a = await canvasStats(page);
	await page.waitForTimeout(500);
	const b = await canvasStats(page);
	expect(a.hash).not.toBe(b.hash);
});

test("動きを減らす設定では1枚だけ描いて止まる", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await open(page);
	const a = await canvasStats(page);
	await page.waitForTimeout(500);
	const b = await canvasStats(page);
	expect(a.max - a.min).toBeGreaterThan(15);
	expect(a.hash).toBe(b.hash);
	const frames = await page.evaluate(() => window.__bg!.frames);
	expect(frames).toBe(1);
});

test("?bg=off で背景を作らない", async ({ page }) => {
	await open(page, "/?bg=off");
	await expect(page.locator("#bg, #bg-grain")).toHaveCount(0);
});

test("背景があっても、数字と背景のコントラスト比は7:1を大きく上回る", async ({ page }) => {
	await open(page);
	const time = page.locator("#time");
	const samples: { fg: number; bgMax: number; ratio: number }[] = [];
	// 液滴は動くので何度か撮り、最も悪い組で判定する。表の行が埋まると位置が変わるので、毎回要素そのものを撮る
	for (let i = 0; i < 4; i++) {
		await page.evaluate(() => {
			const st = document.createElement("style");
			st.id = "hide-time";
			st.textContent = "#time { color: transparent !important; }";
			document.head.append(st);
		});
		const bg = await luminances(page, await time.screenshot());
		await page.evaluate(() => document.getElementById("hide-time")?.remove());
		const all = await luminances(page, await time.screenshot());
		const fg = all[Math.floor(all.length * 0.995)];
		const bgMax = bg[bg.length - 1];
		samples.push({ fg, bgMax, ratio: (fg + 0.05) / (bgMax + 0.05) });
		await page.waitForTimeout(400);
	}
	const ratio = Math.min(...samples.map((x) => x.ratio));
	save(`${test.info().project.name}-contrast`, { ratio, samples });
	expect(ratio).toBeGreaterThan(9);
});

async function record(browser: import("@playwright/test").Browser, name: string, hideClock: boolean) {
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: `${DIR}/video-tmp`, size: { width: 1280, height: 720 } } });
	const page = await context.newPage();
	await open(page);
	if (hideClock) await page.addStyleTag({ content: "main { visibility: hidden; }" });
	await page.waitForTimeout(8000);
	const stats = await page.evaluate(() => window.__bg);
	const video = page.video()!;
	await context.close();
	renameSync(await video.path(), `${DIR}/${PREFIX}-${name}.webm`);
	save(name, stats);
	return stats!;
}

test("映像の記録（目視用）", async ({ browser }, info) => {
	test.skip(info.project.name !== "desktop", "映像は1本で十分");
	test.setTimeout(60_000);
	const stats = await record(browser, "desktop", false);
	expect(stats.frames).toBeGreaterThan(30);
	// 合体とちぎれ方を見比べやすいよう、時計を隠した映像も残す
	const bgOnly = await record(browser, "desktop-bg-only", true);
	expect(bgOnly.merges + bgOnly.pinches).toBeGreaterThan(0);
});
