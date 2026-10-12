import { execFileSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

function contentDate() {
	const today = new Date().toISOString().slice(0, 10);
	try {
		// ビルド日時にしないのは、文言を変えていないデプロイでも sitemap の lastmod が毎回進み、検索エンジンに信用されなくなるため
		const date = execFileSync("git", ["log", "-1", "--format=%cs", "--", "index.html", "src/shared/messages", "src/shared/seo"], { encoding: "utf8" }).trim();
		return date || today;
	} catch {
		return today;
	}
}

export default defineConfig({
	plugins: [cloudflare()],
	define: { __CONTENT_DATE__: JSON.stringify(contentDate()) },
	server: { port: Number(process.env.PORT) || 5173, strictPort: true },
	preview: { port: Number(process.env.PORT) || 4173, strictPort: true },
});
