import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { type BrowserContextOptions, expect, type Page, test } from "@playwright/test";
import { mockSources, waitRounds } from "./mock.ts";

const ALL_OK = { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 } as const;
const DIR = "artifacts/bg";
// ヘッドレスChromiumの WebGL はソフトウェア描画で、既定では静止背景になる。流体そのものを確かめるため強制する
const FLUID = "/?bg=force";
// --bg (#050607) そのものの相対輝度。これより十分明るければインクが残っている
const BASE_LUM = 0.0017;

type Stats = { mode: string; meanLum: number; maxLum: number; hash: number; frameMs: number; simW?: number; simH?: number; steps?: number };

const stats = (page: Page): Promise<Stats> => page.evaluate(() => window.__bg!.stats());

async function waitMode(page: Page, mode: string) {
	await page.waitForFunction((m) => window.__bg?.stats().mode === m, mode, { timeout: 15_000 });
}

function save(name: string, data: unknown) {
	mkdirSync("artifacts/results", { recursive: true });
	writeFileSync(`artifacts/results/${name}.json`, JSON.stringify(data, null, 2));
}

const device = () => test.info().project.name.replace(/-bg$/, "");

const hideMain = (page: Page) => page.addStyleTag({ content: "main { visibility: hidden !important; }" });

/** スクリーンショットのPNGをページ内で復号し、各画素の相対輝度を返す（Node側にPNGの復号器を足さないため） */
async function lumOf(page: Page, png: Buffer) {
	return page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
		const c = new OffscreenCanvas(bmp.width, bmp.height);
		const g = c.getContext("2d")!;
		g.drawImage(bmp, 0, 0);
		const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
		const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
		const out: number[] = [];
		for (let i = 0; i < d.length; i += 4) out.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
		return out;
	}, png.toString("base64"));
}

test("背景のキャンバスが時計の後ろにあり、インクが見えている", async ({ page }) => {
	await mockSources(page, ALL_OK);
	await page.goto(FLUID);
	await waitMode(page, "fluid");
	const canvas = page.locator("#bg canvas");
	await expect(canvas).toBeVisible();
	const layer = await page.evaluate(() => {
		const bg = getComputedStyle(document.getElementById("bg")!);
		const r = document.getElementById("bg")!.getBoundingClientRect();
		return { z: bg.zIndex, pe: bg.pointerEvents, pos: bg.position, covers: r.width >= innerWidth - 1 && r.height >= innerHeight - 1 };
	});
	expect(layer).toEqual({ z: "-1", pe: "none", pos: "fixed", covers: true });
	const s = await stats(page);
	expect(s.meanLum).toBeGreaterThan(BASE_LUM * 1.5);
});

test("背景は動いている", async ({ page }) => {
	await mockSources(page, ALL_OK);
	await page.goto(FLUID);
	await waitMode(page, "fluid");
	await hideMain(page);
	const a = await page.screenshot();
	await page.waitForTimeout(500);
	const b = await page.screenshot();
	expect(a.equals(b)).toBe(false);
});

test("動きを減らす設定では、背景は1枚の静止画になる", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await mockSources(page, ALL_OK);
	await page.goto(FLUID);
	await waitMode(page, "still");
	await hideMain(page);
	const a = await page.screenshot();
	await page.waitForTimeout(500);
	const b = await page.screenshot();
	expect(a.equals(b)).toBe(true);
	expect((await stats(page)).meanLum).toBeGreaterThan(BASE_LUM * 1.5);
});

test("GPUで描けない環境では、静止背景にして明るすぎない", async ({ page }) => {
	await mockSources(page, ALL_OK);
	await page.goto("/");
	await page.waitForFunction(() => window.__bg && window.__bg.stats().mode !== "off");
	const s = await stats(page);
	save(`bg-${device()}-default`, s);
	// 実GPUのある環境で走らせたときは流体になる。どちらでも明るさの上限は同じ
	expect(["static", "fluid"]).toContain(s.mode);
	await expect(page.locator("#bg canvas")).toBeVisible();
	expect(s.meanLum).toBeGreaterThan(BASE_LUM * 1.5);
	expect(s.maxLum).toBeLessThan(0.035);
});

test("?bg=off で背景を作らない", async ({ page }) => {
	await mockSources(page, ALL_OK);
	await page.goto("/?bg=off");
	await waitRounds(page, 1);
	await expect(page.locator("#bg")).toHaveCount(0);
	expect(await page.evaluate(() => window.__bg === undefined)).toBe(true);
});

test("数字と、その真後ろの背景の輝度比が 7:1 を大きく上回る", async ({ page }) => {
	await mockSources(page, ALL_OK);
	await page.goto(FLUID);
	await waitRounds(page, 1);
	await waitMode(page, "fluid");
	await page.waitForTimeout(3000);
	const box = (await page.locator("#time").boundingBox())!;
	const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, page.viewportSize()!.width - box.x), height: box.height };

	const digits = await lumOf(page, await page.screenshot({ clip }));
	const fg = digits.sort((a, b) => a - b)[Math.floor(digits.length * 0.995)];

	const hidden = await page.addStyleTag({ content: "#time { visibility: hidden !important; }" });
	let bgMax = 0;
	for (let i = 0; i < 3; i++) {
		const behind = await lumOf(page, await page.screenshot({ clip }));
		for (const l of behind) if (l > bgMax) bgMax = l;
		await page.waitForTimeout(300);
	}
	await hidden.evaluate((el) => (el as HTMLElement).remove());
	const ratio = (fg + 0.05) / (bgMax + 0.05);
	save(`bg-${device()}-contrast`, { fg, bgMax, ratio });
	expect(ratio).toBeGreaterThan(10);
});

test("15秒動かしても、インクが消え切らず、飽和もしない", async ({ page }) => {
	test.setTimeout(60_000);
	await mockSources(page, ALL_OK);
	await page.goto(FLUID);
	await waitMode(page, "fluid");
	const first = await stats(page);
	await page.waitForTimeout(15_000);
	const s = await stats(page);
	const frame = await page.evaluate(() => window.__bg!.bench(60));
	save(`bg-${device()}-longrun`, { first, after15s: s, benchMsPerFrame: frame });
	expect(s.mode).toBe("fluid");
	expect(s.steps! - first.steps!).toBeGreaterThan(60 * 5);
	expect(s.hash).not.toBe(first.hash);
	expect(s.meanLum).toBeGreaterThan(BASE_LUM * 1.5);
	expect(s.meanLum).toBeLessThan(0.02);
	expect(s.maxLum).toBeLessThan(0.035);
});

test("撮影した見た目を残す（スクリーンショットと動画）", async ({ browser }, info) => {
	test.setTimeout(60_000);
	mkdirSync(DIR, { recursive: true });
	const u = info.project.use;
	const size = u.viewport ?? { width: 1280, height: 720 };
	const opts: BrowserContextOptions = {
		baseURL: u.baseURL,
		viewport: u.viewport,
		userAgent: u.userAgent,
		deviceScaleFactor: u.deviceScaleFactor,
		isMobile: u.isMobile,
		hasTouch: u.hasTouch,
		recordVideo: { dir: `${DIR}/tmp-${device()}`, size },
	};
	const ctx = await browser.newContext(opts);
	const page = await ctx.newPage();
	await mockSources(page, ALL_OK);
	await page.goto(FLUID);
	await waitRounds(page, 3);
	await waitMode(page, "fluid");
	await page.waitForTimeout(7000);
	await page.screenshot({ path: `${DIR}/C-ink-${device()}.png` });
	await ctx.close();
	await page.video()!.saveAs(`${DIR}/C-ink-${device()}.webm`);
	rmSync(`${DIR}/tmp-${device()}`, { recursive: true, force: true });
});
