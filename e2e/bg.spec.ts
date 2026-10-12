import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { mockSources } from "./mock.ts";

type BgState = {
	w: number;
	h: number;
	steps: number;
	collisions: number;
	running: boolean;
	frameMs: number;
	bodies: { cx: number; cy: number; area: number; rest: number; minX: number; maxX: number; minY: number; maxY: number }[];
};

const DIR = "artifacts/bg";
const ALL = { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 } as const;

function save(name: string, data: unknown) {
	mkdirSync("artifacts/results", { recursive: true });
	writeFileSync(`artifacts/results/${name}.json`, JSON.stringify(data, null, 2));
}

async function open(page: Page, path = "/") {
	await mockSources(page, { ...ALL });
	await page.goto(path);
	await expect(page.locator("body")).toHaveAttribute("data-synced", "true", { timeout: 30_000 });
}

const bgState = (page: Page) => page.evaluate(() => window.__bg!.state() as BgState);

/** 背景 canvas の生の画素（ぼかし前の低解像度）を返す */
const bgPixels = (page: Page) =>
	page.evaluate(() => {
		const c = document.getElementById("bg") as HTMLCanvasElement;
		return Array.from(c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data);
	});

function diff(a: number[], b: number[]) {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
	return s / a.length;
}

test("背景のぼかした円が描かれ、動き続ける", async ({ page }, info) => {
	await open(page);
	await page.waitForTimeout(1500);
	const a = await bgPixels(page);
	let lit = 0;
	for (let i = 3; i < a.length; i += 4) if (a[i] > 0) lit++;
	expect(lit / (a.length / 4)).toBeGreaterThan(0.1);
	await page.waitForTimeout(500);
	const b = await bgPixels(page);
	expect(diff(a, b)).toBeGreaterThan(0.05);
	await expect(page.locator("#bg")).toHaveCSS("pointer-events", "none");
	mkdirSync(DIR, { recursive: true });
	await page.waitForTimeout(2500);
	await page.screenshot({ path: `${DIR}/B-softbody-${info.project.name}.png` });
});

test("動きを減らす設定では静止画を1枚だけ描く", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await open(page);
	const a = await bgPixels(page);
	expect(a.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
	await page.waitForTimeout(500);
	const b = await bgPixels(page);
	expect(diff(a, b)).toBe(0);
	const s = await bgState(page);
	expect(s.running).toBe(false);
	expect(s.steps).toBe(0);
});

test("?bg=off で背景を作らない", async ({ page }) => {
	await open(page, "/?bg=off");
	await expect(page.locator("#bg")).toHaveCount(0);
	await expect(page.locator("#bg-grain")).toHaveCount(0);
	expect(await page.evaluate(() => window.__bg === undefined)).toBe(true);
});

test("数字の明るさは、背景のどこよりも十分に明るい（輝度比9:1以上）", async ({ page }, info) => {
	// 背景を止めて、数字ありの画面と、本体を隠した背景だけの画面を同じ背景で比べる
	await page.emulateMedia({ reducedMotion: "reduce" });
	await open(page);
	const box = (await page.locator("#time").boundingBox())!;
	const withText = (await page.screenshot()).toString("base64");
	await page.locator("main").evaluate((m) => (m.style.visibility = "hidden"));
	const bgOnly = (await page.screenshot()).toString("base64");
	const r = await page.evaluate(
		async ({ withText, bgOnly, box }) => {
			const dpr = devicePixelRatio;
			const read = async (b64: string) => {
				const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
				const c = new OffscreenCanvas(bmp.width, bmp.height);
				const g = c.getContext("2d")!;
				g.drawImage(bmp, 0, 0);
				return g.getImageData(0, 0, bmp.width, bmp.height);
			};
			const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
			const lum = (d: Uint8ClampedArray, i: number) => 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
			const a = await read(withText);
			const b = await read(bgOnly);
			let fg = 0;
			for (let y = Math.floor(box.y * dpr); y < (box.y + box.height) * dpr; y++)
				for (let x = Math.floor(box.x * dpr); x < (box.x + box.width) * dpr; x++) fg = Math.max(fg, lum(a.data, (y * a.width + x) * 4));
			let bg = 0;
			let behind = 0;
			for (let y = 0; y < b.height; y++)
				for (let x = 0; x < b.width; x++) {
					const l = lum(b.data, (y * b.width + x) * 4);
					bg = Math.max(bg, l);
					if (x >= box.x * dpr && x < (box.x + box.width) * dpr && y >= box.y * dpr && y < (box.y + box.height) * dpr) behind = Math.max(behind, l);
				}
			return { fg, bgMax: bg, bgBehindTime: behind, ratioWorst: (fg + 0.05) / (bg + 0.05), ratioBehind: (fg + 0.05) / (behind + 0.05) };
		},
		{ withText, bgOnly, box },
	);
	save(`${info.project.name}-bg-contrast`, r);
	expect(r.ratioWorst).toBeGreaterThanOrEqual(9);
});

test("10秒動かしても円は画面内に収まり、面積は静止時の±30%以内で、物理の刻みは表示と独立に120/秒", async ({ page }, info) => {
	test.setTimeout(60_000);
	await open(page);
	await page.waitForTimeout(10_000);
	const s1 = await bgState(page);
	const t1 = await page.evaluate(() => performance.now());
	await page.waitForTimeout(2000);
	const s2 = await bgState(page);
	const t2 = await page.evaluate(() => performance.now());
	const stepsPerSec = (s2.steps - s1.steps) / ((t2 - t1) / 1000);
	for (const s of [s1, s2]) {
		for (const b of s.bodies) {
			expect(b.minX).toBeGreaterThanOrEqual(0);
			expect(b.minY).toBeGreaterThanOrEqual(0);
			expect(b.maxX).toBeLessThanOrEqual(s.w);
			expect(b.maxY).toBeLessThanOrEqual(s.h);
			expect(Math.abs(b.area / b.rest - 1)).toBeLessThan(0.3);
		}
	}
	expect(stepsPerSec).toBeGreaterThan(108);
	expect(stepsPerSec).toBeLessThan(132);
	expect(s2.collisions).toBeGreaterThan(0);

	// rAF が止まらない環境でも、非表示の通知で自分から止まること
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	const h1 = await bgState(page);
	await page.waitForTimeout(500);
	const h2 = await bgState(page);
	expect(h2.running).toBe(false);
	expect(h2.steps).toBe(h1.steps);

	save(`${info.project.name}-bg-physics`, {
		stepsPerSec,
		collisionsIn12s: s2.collisions,
		frameMsAvg: s2.frameMs,
		areaRatios: s2.bodies.map((b) => +(b.area / b.rest).toFixed(3)),
	});
});

test("録画: 背景の動きを数秒撮って残す", async ({ browser, baseURL }, info) => {
	test.skip(info.project.name !== "desktop", "録画は1本で十分");
	test.setTimeout(60_000);
	const size = { width: 1280, height: 720 };
	const dir = `${DIR}/video-tmp`;
	const ctx = await browser.newContext({ baseURL, viewport: size, recordVideo: { dir, size } });
	const page = await ctx.newPage();
	await open(page);
	await page.waitForTimeout(7000);
	await page.close();
	await page.video()!.saveAs(`${DIR}/B-softbody-desktop.webm`);
	await ctx.close();
});
