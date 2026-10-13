import { expect, test } from "@playwright/test";
import { save } from "./helpers.ts";

const CANONICAL = "https://milliclock.com";

test("www と workers.dev のホスト名で来た要求は正規ドメインへ 301 で転送し、時刻APIとローカルは転送しない", async ({ request }, info) => {
	test.skip(info.project.name !== "desktop", "HTTP だけの試験なので1回で十分");
	test.skip(!!process.env.BASE_URL, "Host を差し替える試験はローカルのプレビューでだけ行う");
	const rows: { host: string; path: string; status: number; location: string | null }[] = [];
	const get = async (host: string, path: string) => {
		const res = await request.get(path, { headers: { host }, maxRedirects: 0 });
		rows.push({ host, path, status: res.status(), location: res.headers().location ?? null });
		return res;
	};
	for (const host of ["www.milliclock.com", "jst-clock.safes-plurals-08.workers.dev"]) {
		for (const path of ["/", "/ja/?code=1", "/sitemap.xml"]) {
			const res = await get(host, path);
			expect(res.status(), `${host}${path}`).toBe(301);
			expect(res.headers().location, `${host}${path}`).toBe(CANONICAL + path);
		}
		const api = await get(host, "/api/time");
		expect(api.status(), `${host}/api/time`).toBe(200);
	}
	const local = await get(new URL(info.project.use.baseURL!).host, "/ja/");
	expect(local.status()).toBe(200);
	const html = await local.text();
	expect(html).toContain(`<link rel="canonical" href="${CANONICAL}/ja/">`);
	save("domain-redirects", rows);
});
