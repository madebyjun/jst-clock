import { PRODUCT_NAME } from "./shared/brand.ts";
import { DEFAULT_LANG, I18N_ATTRS, type Lang, LANGS, dirOf, findLang, format, langPath } from "./shared/i18n.ts";
import { type MessageKey, MESSAGES } from "./shared/messages/index.ts";
import { OG_IMAGE } from "./shared/og-image.ts";
import { OG_LOCALE, SEO, type SeoKey } from "./shared/seo/index.ts";

declare const __CONTENT_DATE__: string;

const NOINDEX = { "X-Robots-Tag": "noindex" };

function time(request: Request) {
	// Workers の Date.now() はリクエスト到着時点で固定され I/O まで進まないが、ここでは I/O 前に読むので到着時刻そのものになる
	const t = Date.now();
	return Response.json(
		{ t, colo: request.cf?.colo ?? null },
		{
			headers: {
				"Cache-Control": "no-store",
				"Timing-Allow-Origin": "*",
				...NOINDEX,
			},
		},
	);
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escapeXml = (s: string) => escapeAttr(s).replace(/>/g, "&gt;");
const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/** /en/ を正規のURLにしないのは、/ と同じ内容なので、両方を示すと重複として評価が割れるため */
const canonicalPath = (lang: Lang) => (lang === DEFAULT_LANG ? "/" : langPath(lang));

const siteOrigin = (url: URL, env: Env) => (env.SITE_ORIGIN || url.origin).replace(/\/$/, "");

function seo(lang: Lang) {
	const m = SEO[lang];
	return (key: SeoKey) => format(m[key], { name: PRODUCT_NAME, languages: LANGS.length });
}

const FAQ = [1, 2, 3, 4] as const;

function structuredData(lang: Lang, origin: string) {
	const s = seo(lang);
	const url = origin + canonicalPath(lang);
	return {
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "WebSite", "@id": `${origin}/#website`, url: `${origin}/`, name: PRODUCT_NAME, inLanguage: lang },
			{
				"@type": "WebApplication",
				"@id": `${url}#app`,
				name: PRODUCT_NAME,
				url,
				description: s("description"),
				inLanguage: lang,
				applicationCategory: "UtilitiesApplication",
				operatingSystem: "Any",
				browserRequirements: "Requires JavaScript",
				isAccessibleForFree: true,
				image: origin + OG_IMAGE.path,
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
				isPartOf: { "@id": `${origin}/#website` },
			},
			{
				"@type": "FAQPage",
				"@id": `${url}#faq`,
				inLanguage: lang,
				mainEntity: FAQ.map((n) => ({
					"@type": "Question",
					name: s(`q${n}`),
					acceptedAnswer: { "@type": "Answer", text: s(`a${n}`) },
				})),
			},
		],
	};
}

function headTags(lang: Lang, origin: string) {
	const s = seo(lang);
	const abs = (path: string) => escapeAttr(origin + path);
	const meta = (attr: "property" | "name", key: string, value: string | number) => `<meta ${attr}="${key}" content="${escapeAttr(String(value))}">`;
	const url = abs(canonicalPath(lang));
	return [
		`<link rel="canonical" href="${url}">`,
		...LANGS.map((l) => `<link rel="alternate" hreflang="${l.tag}" href="${abs(canonicalPath(l.tag))}">`),
		`<link rel="alternate" hreflang="x-default" href="${abs("/")}">`,
		meta("property", "og:type", "website"),
		meta("property", "og:site_name", PRODUCT_NAME),
		meta("property", "og:title", s("title")),
		meta("property", "og:description", s("description")),
		`<meta property="og:url" content="${url}">`,
		meta("property", "og:locale", OG_LOCALE[lang]),
		...LANGS.filter((l) => l.tag !== lang).map((l) => meta("property", "og:locale:alternate", OG_LOCALE[l.tag])),
		`<meta property="og:image" content="${abs(OG_IMAGE.path)}">`,
		meta("property", "og:image:type", OG_IMAGE.type),
		meta("property", "og:image:width", OG_IMAGE.width),
		meta("property", "og:image:height", OG_IMAGE.height),
		meta("property", "og:image:alt", s("ogImageAlt")),
		meta("name", "twitter:card", "summary_large_image"),
		meta("name", "twitter:title", s("title")),
		meta("name", "twitter:description", s("description")),
		`<meta name="twitter:image" content="${abs(OG_IMAGE.path)}">`,
		meta("name", "twitter:image:alt", s("ogImageAlt")),
		`<script type="application/ld+json">${json(structuredData(lang, origin))}</script>`,
	].join("");
}

async function page(url: URL, lang: Lang, env: Env) {
	const asset = await env.ASSETS.fetch(new URL("/", url));
	if (!asset.ok) return asset;
	const messages = MESSAGES[lang];
	const t = (key: string | null) => format(messages[key as MessageKey] ?? key ?? "", { name: PRODUCT_NAME });
	const s = seo(lang);
	const head = headTags(lang, siteOrigin(url, env)) + `<script type="application/json" id="i18n">${json(messages)}</script>`;

	let rewriter = new HTMLRewriter()
		.on("html", {
			element(e) {
				e.setAttribute("lang", lang);
				e.setAttribute("dir", dirOf(lang));
			},
		})
		.on("head", {
			element(e) {
				e.append(head, { html: true });
			},
		})
		.on("[data-i18n]", {
			element(e) {
				e.setInnerContent(t(e.getAttribute("data-i18n")));
			},
		})
		// 解説を data-i18n に混ぜないのは、ブラウザ側にも翻訳を JSON で送ることになり、画面に要らない長文で全ページが重くなるため
		.on("[data-seo]", {
			element(e) {
				e.setInnerContent(s(e.getAttribute("data-seo") as SeoKey));
			},
		})
		.on("[data-seo-content]", {
			element(e) {
				e.setAttribute("content", s(e.getAttribute("data-seo-content") as SeoKey));
			},
		});
	for (const [data, attr] of Object.entries(I18N_ATTRS)) {
		rewriter = rewriter.on(`[${data}]`, {
			element(e) {
				e.setAttribute(attr, t(e.getAttribute(data)));
			},
		});
	}
	const res = rewriter.transform(asset);
	const headers = new Headers(res.headers);
	// 静的ファイルの ETag をそのまま返さないのは、翻訳だけを変えてデプロイしても index.html が同じなら 304 で古い翻訳が残るため
	headers.delete("ETag");
	headers.set("Content-Language", lang);
	headers.set("Cache-Control", "public, max-age=0, must-revalidate");
	return new Response(res.body, { status: res.status, headers });
}

function robots(origin: string) {
	// /api/time を Disallow しないのは、クロールを禁じると X-Robots-Tag: noindex を読めず、他から張られたリンクだけでURLが登録されうるため
	return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, {
		headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
	});
}

function sitemap(origin: string) {
	const alternates = [...LANGS.map((l) => [l.tag, canonicalPath(l.tag)]), ["x-default", "/"]]
		.map(([tag, path]) => `<xhtml:link rel="alternate" hreflang="${tag}" href="${escapeXml(origin + path)}"/>`)
		.join("");
	const urls = LANGS.map((l) => `<url><loc>${escapeXml(origin + canonicalPath(l.tag))}</loc><lastmod>${__CONTENT_DATE__}</lastmod>${alternates}</url>`);
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
	return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

function manifest() {
	const icon = (src: string, size: number) => ({ src, sizes: `${size}x${size}`, type: "image/png" });
	return Response.json(
		{
			name: PRODUCT_NAME,
			short_name: PRODUCT_NAME,
			description: seo(DEFAULT_LANG)("description"),
			start_url: "/",
			display: "standalone",
			background_color: "#050607",
			theme_color: "#050607",
			icons: [icon("/icon-192.png", 192), icon("/icon-512.png", 512), { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
		},
		{ headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" } },
	);
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === "/api/time") return time(request);
		// 正規のドメイン以外は「どのホストでも」ではなく名指しで転送する。ローカルのプレビューや試験まで本番へ飛ばさないため
		if (env.SITE_ORIGIN && (url.hostname.startsWith("www.") || url.hostname.endsWith(".workers.dev"))) {
			return Response.redirect(env.SITE_ORIGIN.replace(/\/$/, "") + url.pathname + url.search, 301);
		}
		if (url.pathname === "/robots.txt") return robots(siteOrigin(url, env));
		if (url.pathname === "/sitemap.xml") return sitemap(siteOrigin(url, env));
		if (url.pathname === "/site.webmanifest") return manifest();
		if (url.pathname === "/") return page(url, DEFAULT_LANG, env);
		const m = /^\/([^/]+)(\/?)$/.exec(url.pathname);
		const lang = m && findLang(m[1]);
		if (m && lang) {
			if (m[1] !== lang || !m[2]) return Response.redirect(new URL(langPath(lang) + url.search, url.origin).href, 301);
			return page(url, lang, env);
		}
		return new Response("Not found", { status: 404, headers: NOINDEX });
	},
} satisfies ExportedHandler<Env>;
