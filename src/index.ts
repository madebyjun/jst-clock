import { PRODUCT_NAME } from "./shared/brand.ts";
import { DEFAULT_LANG, I18N_ATTRS, type Lang, LANGS, dirOf, findLang, format, langPath } from "./shared/i18n.ts";
import { type MessageKey, MESSAGES } from "./shared/messages/index.ts";

function time(request: Request) {
	// Workers の Date.now() はリクエスト到着時点で固定され I/O まで進まないが、ここでは I/O 前に読むので到着時刻そのものになる
	const t = Date.now();
	return Response.json(
		{ t, colo: request.cf?.colo ?? null },
		{
			headers: {
				"Cache-Control": "no-store",
				"Timing-Allow-Origin": "*",
			},
		},
	);
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function page(url: URL, lang: Lang, canonical: string, env: Env) {
	const asset = await env.ASSETS.fetch(new URL("/", url));
	if (!asset.ok) return asset;
	const messages = MESSAGES[lang];
	const t = (key: string | null) => format(messages[key as MessageKey] ?? key ?? "", { name: PRODUCT_NAME });
	const href = (path: string) => escapeAttr(new URL(path, url.origin).href);
	const head = [
		`<link rel="canonical" href="${href(canonical)}">`,
		...LANGS.map((l) => `<link rel="alternate" hreflang="${l.tag}" href="${href(langPath(l.tag))}">`),
		`<link rel="alternate" hreflang="x-default" href="${href("/")}">`,
		`<script type="application/json" id="i18n">${JSON.stringify(messages).replace(/</g, "\\u003c")}</script>`,
	].join("");

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

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === "/api/time") return time(request);
		if (url.pathname === "/") return page(url, DEFAULT_LANG, "/", env);
		const m = /^\/([^/]+)(\/?)$/.exec(url.pathname);
		const lang = m && findLang(m[1]);
		if (m && lang) {
			if (m[1] !== lang || !m[2]) return Response.redirect(new URL(langPath(lang) + url.search, url.origin).href, 301);
			return page(url, lang, langPath(lang), env);
		}
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
