import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PRODUCT_NAME } from "../src/shared/brand.ts";
import { format, type Lang, LANGS, placeholders } from "../src/shared/i18n.ts";
import { OG_IMAGE } from "../src/shared/og-image.ts";
import { OG_LOCALE, SEO, type SeoKey } from "../src/shared/seo/index.ts";
import { displayLength, MAX_DESCRIPTION, MAX_TITLE } from "../src/shared/seo/length.ts";
import { mockSources, save } from "./helpers.ts";

const ALL_OK = { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 };
const CARD_LANGS = ["en", "ja", "zh-CN", "de", "ar", "pt-BR"] as const;
const FAQ = [1, 2, 3, 4] as const;
const ABOUT_KEYS: SeoKey[] = ["h1", "intro", "howHeading", "how1", "how2", "how3", "boundHeading", "boundBody", "faqHeading", ...FAQ.flatMap((n) => [`q${n}`, `a${n}`] as SeoKey[])];

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const seo = (lang: Lang, key: SeoKey) => format(SEO[lang][key], { name: PRODUCT_NAME, languages: LANGS.length });
const canonicalPath = (lang: Lang) => (lang === "en" ? "/" : `/${lang}/`);
const PAGES = [{ path: "/", lang: "en" as Lang }, ...LANGS.map((l) => ({ path: `/${l.tag}/`, lang: l.tag as Lang }))];

function metas(html: string) {
	const out: [string, string][] = [];
	for (const [tag] of html.matchAll(/<meta\b[^>]*>/g)) {
		const key = /\s(?:property|name)="([^"]+)"/.exec(tag)?.[1];
		const content = /\scontent="([^"]*)"/.exec(tag)?.[1];
		if (key && content !== undefined) out.push([key, unescape(content)]);
	}
	return out;
}

function pngSize(buf: Buffer) {
	expect(buf.subarray(1, 4).toString("latin1")).toBe("PNG");
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("翻訳した検索用の文言が全言語で揃い、検索結果で切れない長さに収まる", async ({}, info) => {
	test.skip(info.project.name !== "desktop", "ブラウザを使わない検査なので1回で十分");
	const problems: string[] = [];
	const rows: Record<string, unknown> = {};
	for (const { tag } of LANGS) {
		for (const key of Object.keys(SEO.en) as SeoKey[]) {
			if (!SEO[tag][key]?.trim()) problems.push(`${tag}: empty ${key}`);
			else if (placeholders(SEO[tag][key]).join() !== placeholders(SEO.en[key]).join()) problems.push(`${tag}: placeholders differ in ${key}`);
		}
		const title = displayLength(seo(tag, "title"));
		const description = displayLength(seo(tag, "description"));
		if (title > MAX_TITLE) problems.push(`${tag}: title ${title}`);
		if (description > MAX_DESCRIPTION) problems.push(`${tag}: description ${description}`);
		if (tag !== "en" && seo(tag, "intro") === seo("en", "intro")) problems.push(`${tag}: intro is English`);
		rows[tag] = { title, description, text: seo(tag, "title") };
	}
	save("seo-lengths", { maxTitle: MAX_TITLE, maxDescription: MAX_DESCRIPTION, rows, problems });
	expect(problems).toEqual([]);
});

test("JavaScript なしで全言語のページに、タイトル・説明・OGP・Twitter カード・canonical・相互の hreflang・構造化データ・解説が入っている", async ({ request }, info) => {
	test.skip(info.project.name !== "desktop", "HTTP だけの検査なので1回で十分");
	const rows: Record<string, unknown>[] = [];
	let origin = "";
	const hreflangSets = new Set<string>();
	for (const { path, lang } of PAGES) {
		const res = await request.get(path, { maxRedirects: 0 });
		expect(res.status(), path).toBe(200);
		expect(res.headers()["cache-control"], path).toBe("public, max-age=0, must-revalidate");
		expect(res.headers()["x-robots-tag"], path).toBeUndefined();
		const html = await res.text();
		const m = metas(html);
		const one = (key: string) => {
			const found = m.filter(([k]) => k === key);
			expect(found.length, `${path} ${key}`).toBe(1);
			return found[0][1];
		};

		const title = unescape(/<title[^>]*>([^<]*)<\/title>/.exec(html)![1]);
		const description = one("description");
		expect(title, path).toBe(seo(lang, "title"));
		expect(description, path).toBe(seo(lang, "description"));
		expect(displayLength(title), path).toBeLessThanOrEqual(MAX_TITLE);
		expect(displayLength(description), path).toBeLessThanOrEqual(MAX_DESCRIPTION);
		expect(html, path).not.toMatch(/name="robots"[^>]*noindex/);

		const canonical = new URL(/<link rel="canonical" href="([^"]+)">/.exec(html)![1]);
		origin ||= canonical.origin;
		expect(canonical.origin, path).toBe(origin);
		expect(canonical.pathname, path).toBe(canonicalPath(lang));

		const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((x) => [x[1], x[2]] as const);
		const byLang = new Map(alternates);
		expect(byLang.size, `${path} duplicate hreflang`).toBe(alternates.length);
		expect([...byLang.keys()].sort(), path).toEqual([...LANGS.map((l) => l.tag), "x-default"].sort());
		expect(byLang.get(lang), `${path} self-reference`).toBe(canonical.href);
		expect(new URL(byLang.get("x-default")!).pathname, path).toBe("/");
		hreflangSets.add(JSON.stringify(alternates));

		expect(one("og:type"), path).toBe("website");
		expect(one("og:site_name"), path).toBe(PRODUCT_NAME);
		expect(one("og:title"), path).toBe(title);
		expect(one("og:description"), path).toBe(description);
		expect(one("og:url"), path).toBe(canonical.href);
		expect(one("og:locale"), path).toBe(OG_LOCALE[lang]);
		expect(m.filter(([k]) => k === "og:locale:alternate").map(([, v]) => v).sort(), path).toEqual(LANGS.filter((l) => l.tag !== lang).map((l) => OG_LOCALE[l.tag]).sort());
		expect(one("og:image"), path).toBe(origin + OG_IMAGE.path);
		expect(one("og:image:width"), path).toBe(String(OG_IMAGE.width));
		expect(one("og:image:height"), path).toBe(String(OG_IMAGE.height));
		expect(one("og:image:type"), path).toBe("image/png");
		expect(one("og:image:alt"), path).toBe(seo(lang, "ogImageAlt"));
		expect(one("twitter:card"), path).toBe("summary_large_image");
		expect(one("twitter:title"), path).toBe(title);
		expect(one("twitter:description"), path).toBe(description);
		expect(one("twitter:image"), path).toBe(origin + OG_IMAGE.path);
		expect(one("theme-color"), path).toBe("#050607");
		for (const rel of ['rel="icon" href="/favicon.svg"', 'rel="icon" href="/favicon.ico"', 'rel="apple-touch-icon"', 'rel="manifest"']) expect(html, `${path} ${rel}`).toContain(rel);

		const ld = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)];
		expect(ld.length, path).toBe(1);
		const data = JSON.parse(ld[0][1]);
		expect(data["@context"]).toBe("https://schema.org");
		const node = (type: string) => data["@graph"].find((n: { "@type": string }) => n["@type"] === type);
		expect(node("WebSite"), path).toMatchObject({ name: PRODUCT_NAME, url: `${origin}/`, inLanguage: lang });
		expect(node("WebApplication"), path).toMatchObject({
			name: PRODUCT_NAME,
			url: canonical.href,
			description,
			inLanguage: lang,
			applicationCategory: "UtilitiesApplication",
			isAccessibleForFree: true,
			offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
		});
		const faq = node("FAQPage");
		expect(faq.inLanguage, path).toBe(lang);
		expect(faq.mainEntity, path).toEqual(FAQ.map((n) => ({ "@type": "Question", name: seo(lang, `q${n}`), acceptedAnswer: { "@type": "Answer", text: seo(lang, `a${n}`) } })));

		const about = /<article class="about"[^>]*>([\s\S]*?)<\/article>/.exec(html)![1];
		for (const key of ABOUT_KEYS) {
			const filled = new RegExp(`data-seo="${key}">([^<]*)<`).exec(about);
			expect(filled && unescape(filled[1]), `${path} ${key}`).toBe(seo(lang, key));
		}
		expect((html.match(/<h1\b/g) ?? []).length, path).toBe(1);
		rows.push({ path, lang, canonical: canonical.pathname, title, titleLength: displayLength(title), descriptionLength: displayLength(description), hreflang: alternates.length, faq: faq.mainEntity.length });
	}
	expect(hreflangSets.size, "every page carries the same hreflang set").toBe(1);
	save("seo-pages", { origin, pages: rows.length, rows });
});

test("OG画像は 1200×630 の PNG で、内容ハッシュ入りのURLで長くキャッシュされる。ファビコンとマニフェストも返る", async ({ request }, info) => {
	test.skip(info.project.name !== "desktop", "HTTP だけの検査なので1回で十分");
	expect(OG_IMAGE.path).toMatch(/^\/og\/card-[0-9a-f]{10}\.png$/);
	const res = await request.get(OG_IMAGE.path);
	expect(res.status()).toBe(200);
	expect(res.headers()["content-type"]).toBe("image/png");
	expect(res.headers()["cache-control"]).toContain("immutable");
	const body = await res.body();
	expect(pngSize(body)).toEqual({ width: 1200, height: 630 });
	expect(body.length).toBeLessThan(300_000);
	mkdirSync("artifacts/seo", { recursive: true });
	writeFileSync("artifacts/seo/og-image.png", body);

	const icons: Record<string, unknown> = {};
	for (const [path, type, size] of [
		["/favicon.svg", "image/svg+xml", null],
		["/favicon.ico", "image/", null],
		["/favicon-32.png", "image/png", 32],
		["/apple-touch-icon.png", "image/png", 180],
		["/icon-192.png", "image/png", 192],
		["/icon-512.png", "image/png", 512],
	] as const) {
		const r = await request.get(path);
		expect(r.status(), path).toBe(200);
		expect(r.headers()["content-type"], path).toContain(type);
		if (size) expect(pngSize(await r.body()), path).toEqual({ width: size, height: size });
		icons[path] = { type: r.headers()["content-type"], cache: r.headers()["cache-control"] };
	}
	const manifest = await request.get("/site.webmanifest");
	expect(manifest.status()).toBe(200);
	const mf = await manifest.json();
	expect(mf).toMatchObject({ name: PRODUCT_NAME, start_url: "/", display: "standalone" });
	for (const icon of mf.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);

	const assets = await request.get((await (await request.get("/")).text()).match(/src="(\/assets\/[^"]+\.js)"/)![1]);
	expect(assets.headers()["cache-control"]).toContain("immutable");
	save("seo-assets", { ogImage: { path: OG_IMAGE.path, bytes: body.length, cache: res.headers()["cache-control"] }, icons, manifest: mf, jsCache: assets.headers()["cache-control"] });
});

test("robots.txt はクロールを許し sitemap を示し、sitemap は全言語と相互の alternate を含む。/api/time は noindex", async ({ request, page }, info) => {
	test.skip(info.project.name !== "desktop", "HTTP だけの検査なので1回で十分");
	const robots = await request.get("/robots.txt");
	expect(robots.status()).toBe(200);
	expect(robots.headers()["content-type"]).toContain("text/plain");
	const robotsText = await robots.text();
	expect(robotsText).toMatch(/^User-agent: \*$/m);
	expect(robotsText).toMatch(/^Allow: \/$/m);
	expect(robotsText).not.toMatch(/^Disallow: \/\S*$/m);
	const sitemapUrl = /^Sitemap: (\S+)$/m.exec(robotsText)![1];
	expect(new URL(sitemapUrl).pathname).toBe("/sitemap.xml");

	const sm = await request.get("/sitemap.xml");
	expect(sm.status()).toBe(200);
	expect(sm.headers()["content-type"]).toContain("xml");
	const xml = await sm.text();
	await page.goto("about:blank");
	const parsed = await page.evaluate((xml) => {
		const doc = new DOMParser().parseFromString(xml, "application/xml");
		if (doc.querySelector("parsererror")) return null;
		const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
		return [...doc.getElementsByTagNameNS(NS, "url")].map((u) => ({
			loc: u.getElementsByTagNameNS(NS, "loc")[0].textContent!,
			lastmod: u.getElementsByTagNameNS(NS, "lastmod")[0].textContent!,
			alternates: [...u.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "link")].map((l) => [l.getAttribute("hreflang")!, l.getAttribute("href")!]),
		}));
	}, xml);
	expect(parsed, "sitemap is well-formed XML").not.toBeNull();
	const origin = new URL(sitemapUrl).origin;
	expect(parsed!.map((u) => u.loc).sort()).toEqual(LANGS.map((l) => origin + canonicalPath(l.tag)).sort());
	const expectedAlternates = [...LANGS.map((l) => [l.tag, origin + canonicalPath(l.tag)]), ["x-default", `${origin}/`]];
	for (const u of parsed!) {
		expect(u.lastmod, u.loc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(u.alternates, u.loc).toEqual(expectedAlternates);
		expect((await request.get(new URL(u.loc).pathname, { maxRedirects: 0 })).status(), u.loc).toBe(200);
	}

	const api = await request.get("/api/time?probe");
	expect(api.headers()["x-robots-tag"]).toBe("noindex");
	const missing = await request.get("/no-such-page");
	expect(missing.status()).toBe(404);
	save("seo-robots-sitemap", { robots: robotsText, urls: parsed!.length, lastmod: parsed![0].lastmod, apiTime: api.headers()["x-robots-tag"], notFound: [missing.status(), missing.headers()["x-robots-tag"]] });
});

type Shift = PerformanceEntry & { value: number; hadRecentInput: boolean; sources: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] };

test("解説は最初の画面より下にあり、JS 実行後も各言語のまま、?min では出ず、時刻・進捗バー・解説の位置がずれない", async ({ page, browser }, info) => {
	const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent, baseURL } = info.project.use;
	const noJs = await browser.newContext({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent, baseURL, javaScriptEnabled: false });
	const staticPage = await noJs.newPage();
	const tops = (p: typeof page) => p.evaluate(() => ["time", "bar"].map((id) => Math.round(document.getElementById(id)!.getBoundingClientRect().top * 10) / 10));
	await mockSources(page, ALL_OK);
	await page.addInitScript(() => {
		const w = window as unknown as { __cls: number; __moved: string[] };
		w.__cls = 0;
		w.__moved = [];
		new PerformanceObserver((list) => {
			for (const e of list.getEntries() as Shift[]) {
				if (e.hadRecentInput) continue;
				w.__cls += e.value;
				for (const { node, previousRect: a, currentRect: b } of e.sources) {
					const el = node instanceof Element ? node : node?.parentElement;
					const hit = el?.closest("#time, #bar, .about");
					if (hit) w.__moved.push(`${hit.id || hit.className} ${Math.round(e.startTime)}ms y ${a.y.toFixed(1)}→${b.y.toFixed(1)} h ${a.height.toFixed(1)}→${b.height.toFixed(1)} date-h ${document.getElementById("date")?.getBoundingClientRect().height.toFixed(1)} "${document.getElementById("date")?.textContent}"`);
				}
			}
		}).observe({ type: "layout-shift", buffered: true });
	});
	const results: Record<string, unknown> = {};
	for (const lang of ["ja", "ar", "en"] as const) {
		await staticPage.goto(canonicalPath(lang));
		const before = await tops(staticPage);
		await page.goto(canonicalPath(lang));
		await expect(page.locator("body")).toHaveAttribute("data-synced", "true", { timeout: 15_000 });
		await page.waitForTimeout(1000);
		const r = await page.evaluate(() => ({
			aboutTop: document.querySelector(".about")!.getBoundingClientRect().top,
			timeBottom: document.getElementById("time")!.getBoundingClientRect().bottom,
			viewport: innerHeight,
			h1: document.querySelector(".about h1")!.textContent,
			cls: (window as unknown as { __cls: number }).__cls,
			moved: (window as unknown as { __moved: string[] }).__moved,
			overflow: document.documentElement.scrollWidth - innerWidth,
		}));
		const after = await tops(page);
		results[lang] = { ...r, timeAndBarTop: { beforeJs: before, afterSync: after } };
		save(`${info.project.name}-seo-about`, results);
		expect(r.aboutTop, lang).toBeGreaterThanOrEqual(r.viewport - 1);
		expect(r.timeBottom, lang).toBeLessThan(r.viewport);
		expect(r.h1, lang).toBe(seo(lang, "h1"));
		expect(after, `${lang}: #time and #bar must not move once JS fills the date and digits`).toEqual(before);
		expect(r.moved, lang).toEqual([]);
		expect(r.overflow, lang).toBeLessThanOrEqual(0);
	}
	await page.goto("/ja/?min");
	await expect(page.locator(".about")).toBeHidden();
	mkdirSync("artifacts/seo", { recursive: true });
	await page.goto("/ja/");
	await page.locator(".about").scrollIntoViewIfNeeded();
	await page.locator(".about").screenshot({ path: `artifacts/seo/${info.project.name}-about-ja.png` });
	save(`${info.project.name}-seo-about`, results);
	await noJs.close();
});

test("SNS のリンクプレビューを模したカードを言語ごとに描き、成果物として残す", async ({ page, request }, info) => {
	test.skip(info.project.name !== "desktop", "1回で十分");
	mkdirSync("artifacts/seo", { recursive: true });
	const image = (await (await request.get(OG_IMAGE.path)).body()).toString("base64");
	const cards: Record<string, unknown> = {};
	await page.setViewportSize({ width: 560, height: 520 });
	for (const lang of CARD_LANGS) {
		const html = await (await request.get(canonicalPath(lang))).text();
		const m = new Map(metas(html));
		const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
		await page.setContent(`<body style="margin:0;padding:20px;background:#f0f2f5;font-family:system-ui,sans-serif">
			<div dir="auto" style="width:500px;border:1px solid #dadde1;border-radius:12px;overflow:hidden;background:#fff">
				<img src="data:image/png;base64,${image}" style="display:block;width:500px;height:${Math.round((500 * OG_IMAGE.height) / OG_IMAGE.width)}px" alt="${esc(m.get("og:image:alt")!)}">
				<div style="padding:10px 14px">
					<div style="color:#65676b;font-size:12px;text-transform:uppercase">${esc(new URL(m.get("og:url")!).host)}</div>
					<div style="font-weight:600;font-size:16px;margin:4px 0;color:#050505">${esc(m.get("og:title")!)}</div>
					<div style="color:#65676b;font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(m.get("og:description")!)}</div>
				</div>
			</div></body>`);
		await page.locator("body > div").screenshot({ path: `artifacts/seo/card-${lang}.png` });
		cards[lang] = { title: m.get("og:title"), description: m.get("og:description"), url: m.get("og:url"), image: m.get("og:image") };
	}
	save("seo-cards", { screenshots: CARD_LANGS.map((l) => `artifacts/seo/card-${l}.png`), cards });
});
