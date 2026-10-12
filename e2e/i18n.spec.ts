import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { PRODUCT_NAME } from "../src/shared/brand.ts";
import { dirOf, format, LANGS, placeholders } from "../src/shared/i18n.ts";
import { MESSAGES } from "../src/shared/messages/index.ts";
import { mockSources, save, waitRounds } from "./helpers.ts";

const ALL_OK = { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 };
const RTL = LANGS.filter((l) => dirOf(l.tag) === "rtl").map((l) => l.tag);
const SCREENSHOT_LANGS = ["ja", "en", "ar", "de", "zh-CN"] as const;

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const text = (key: string, lang: keyof typeof MESSAGES) => format(MESSAGES[lang][key as keyof (typeof MESSAGES)["en"]], { name: PRODUCT_NAME });

test("全言語のメッセージに、英語と同じキーがあり、空でなく、差し込みの名前が一致する", async ({}, info) => {
	test.skip(info.project.name !== "desktop", "ブラウザを使わない検査なので1回で十分");
	const keys = Object.keys(MESSAGES.en).sort();
	const problems: string[] = [];
	for (const { tag } of LANGS) {
		const m = MESSAGES[tag] as Record<string, string>;
		const own = Object.keys(m).sort();
		for (const k of keys) {
			if (!(k in m)) problems.push(`${tag}: missing ${k}`);
			else if (!m[k].trim()) problems.push(`${tag}: empty ${k}`);
			else if (placeholders(m[k]).join() !== placeholders(MESSAGES.en[k as keyof typeof MESSAGES.en]).join()) problems.push(`${tag}: placeholders differ in ${k}`);
		}
		for (const k of own) if (!keys.includes(k)) problems.push(`${tag}: unknown key ${k}`);
		if (tag !== "en" && own.filter((k) => m[k] === (MESSAGES.en as Record<string, string>)[k]).length > keys.length / 4) {
			problems.push(`${tag}: too many strings identical to English`);
		}
	}
	save("i18n-messages", { languages: LANGS.map((l) => l.tag), count: LANGS.length, rtl: RTL, keys: keys.length, problems });
	expect(problems).toEqual([]);
	expect(LANGS.length).toBeGreaterThanOrEqual(30);
	expect(RTL).toEqual(expect.arrayContaining(["ar", "he", "fa", "ur"]));
});

test("JavaScript なしで各言語のURLを取得すると、翻訳済みの HTML と lang・dir・hreflang・canonical が返る", async ({ request }, info) => {
	test.skip(info.project.name !== "desktop", "HTTP だけの検査なので1回で十分");
	const rows: Record<string, unknown>[] = [];
	for (const { path, lang } of [{ path: "/", lang: "en" as const }, ...LANGS.map((l) => ({ path: `/${l.tag}/`, lang: l.tag }))]) {
		const res = await request.get(path, { maxRedirects: 0 });
		expect(res.status(), path).toBe(200);
		const html = await res.text();
		const htmlTag = /<html[^>]*>/.exec(html)![0];
		expect(htmlTag, path).toContain(`lang="${lang}"`);
		expect(htmlTag, path).toContain(`dir="${dirOf(lang)}"`);
		expect(unescape(/<title[^>]*>([^<]*)<\/title>/.exec(html)![1]), path).toBe(text("title", lang));
		expect(unescape(/<meta name="description"[^>]*content="([^"]*)"/.exec(html)![1]), path).toBe(text("description", lang));
		const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], new URL(m[2]).pathname]);
		expect(alternates, path).toEqual([...LANGS.map((l) => [l.tag, `/${l.tag}/`]), ["x-default", "/"]]);
		expect(new URL(/<link rel="canonical" href="([^"]+)">/.exec(html)![1]).pathname, path).toBe(path);
		const filled = [...html.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)];
		expect(filled.length, path).toBeGreaterThan(20);
		for (const [, key, value] of filled) expect(unescape(value), `${path} ${key}`).toBe(text(key, lang));
		rows.push({ path, lang, dir: dirOf(lang), title: text("title", lang), alternates: alternates.length, translatedElements: filled.length });
	}

	const unknown = await request.get("/xx/", { maxRedirects: 0 });
	const upper = await request.get("/JA/?min", { maxRedirects: 0 });
	const noSlash = await request.get("/pt-br", { maxRedirects: 0 });
	expect(unknown.status()).toBe(404);
	expect(upper.status()).toBe(301);
	expect(new URL(upper.headers().location!).pathname + new URL(upper.headers().location!).search).toBe("/ja/?min");
	expect(noSlash.status()).toBe(301);
	expect(new URL(noSlash.headers().location!).pathname).toBe("/pt-BR/");

	const page = await (await request.get("/ja/")).text();
	const script = /<script type="module"[^>]*src="([^"]+)"/.exec(page)![1];
	const js = await request.get(script);
	expect(js.status()).toBe(200);
	expect(js.headers()["content-type"]).toContain("javascript");
	save("i18n-crawler", { rows, unknown: unknown.status(), upper: [upper.status(), upper.headers().location], noSlash: [noSlash.status(), noSlash.headers().location], script: [script, js.status()] });
});

function trackNavigations(page: Page) {
	const navs: string[] = [];
	page.on("framenavigated", (f) => {
		if (f === page.mainFrame()) navs.push(new URL(f.url()).pathname);
	});
	return navs;
}

test.describe("日本語のブラウザ", () => {
	test.use({ locale: "ja-JP" });

	test("/ を開くと /ja/ へ1回だけ移り、言語を選んだ後はその選択を守る", async ({ page }) => {
		await mockSources(page, ALL_OK);
		const navs = trackNavigations(page);
		await page.goto("/?interval=60000");
		await page.waitForURL("**/ja/?interval=60000");
		await page.waitForTimeout(1500);
		const first = [...navs];
		expect(first).toEqual(["/", "/ja/"]);
		await expect(page.locator("html")).toHaveAttribute("lang", "ja");

		await Promise.all([page.waitForURL("**/en/?interval=60000"), page.locator("#lang").selectOption("en")]);
		navs.length = 0;
		await page.goto("/");
		await page.waitForTimeout(1500);
		expect(navs).toEqual(["/"]);
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		save(`${test.info().project.name}-i18n-redirect-ja`, { first, afterChoosingEnglish: [...navs] });
	});
});

test("英語のブラウザで / を開いても移らない", async ({ page }) => {
	await mockSources(page, ALL_OK);
	const navs = trackNavigations(page);
	await page.goto("/");
	await page.waitForTimeout(1500);
	expect(navs).toEqual(["/"]);
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	save(`${test.info().project.name}-i18n-redirect-en`, { navs });
});

test("右から左の言語でも時刻の桁は左から右に並び、横にはみ出さない", async ({ page }) => {
	await mockSources(page, ALL_OK);
	const results: Record<string, unknown> = {};
	for (const lang of RTL) {
		await page.goto(`/${lang}/`);
		await waitRounds(page, 1);
		await expect(page.locator("body")).toHaveAttribute("data-synced", "true");
		const r = await page.evaluate(() => {
			const slots = [...document.querySelectorAll("#time > span")].map((s) => s.getBoundingClientRect());
			return {
				dir: document.documentElement.dir,
				text: document.getElementById("time")!.textContent,
				ltrOrder: slots.every((s, i) => i === 0 || s.left >= slots[i - 1].right - 0.5),
				overflow: document.documentElement.scrollWidth - innerWidth,
			};
		});
		expect(r.dir).toBe("rtl");
		expect(r.text).toMatch(/^\d\d:\d\d:\d\d\.\d\d\d$/);
		expect(r.ltrOrder, lang).toBe(true);
		expect(r.overflow, lang).toBeLessThanOrEqual(0);
		results[lang] = r;
	}
	save(`${test.info().project.name}-i18n-rtl`, results);
});

test("どの言語でも横にはみ出さず、言語ごとのスクリーンショットを残す", async ({ page }, info) => {
	test.setTimeout(120_000);
	await mockSources(page, ALL_OK);
	mkdirSync("artifacts/i18n", { recursive: true });
	const overflow: Record<string, number> = {};
	for (const { tag } of LANGS) {
		await page.goto(`/${tag}/`);
		await expect(page.locator("#state")).toHaveText(text("querying", tag));
		overflow[tag] = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
	}
	expect(Object.entries(overflow).filter(([, v]) => v > 0)).toEqual([]);
	for (const tag of SCREENSHOT_LANGS) {
		await page.goto(`/${tag}/?tz=Asia/Tokyo`);
		await waitRounds(page, 3);
		await page.waitForTimeout(300);
		await page.screenshot({ path: `artifacts/i18n/${info.project.name}-${tag}.png` });
		if (tag === "ja" || tag === "ar") {
			await page.locator("#open-settings").click();
			await page.screenshot({ path: `artifacts/i18n/${info.project.name}-${tag}-settings.png` });
		}
	}
	save(`${info.project.name}-i18n-overflow`, { overflow, screenshots: SCREENSHOT_LANGS.map((t) => `artifacts/i18n/${info.project.name}-${t}.png`) });
});
