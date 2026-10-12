import { bindings, defineConfig } from "cf/config";
import { LANGS, langPath } from "./src/shared/i18n.ts";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "jst-clock",
		compatibilityDate: "2026-10-01",
		entrypoint,
		env: {
			ASSETS: bindings.assets(),
			// リクエストのオリジンだけで決めないのは、独自ドメインを付けた後に workers.dev 側も別のページとして登録されるのを防ぐため。空のあいだはリクエストのオリジンを使う
			SITE_ORIGIN: bindings.text(""),
		},
		assets: {
			notFoundHandling: "none",
			// "/*" にしないのは、JS・CSS まで Worker を通すと起動のたびに無駄な呼び出しが増えるため。HTML を返すパスだけを Worker に回す
			runWorkerFirst: ["/", ...LANGS.map((l) => langPath(l.tag)), "/robots.txt", "/sitemap.xml", "/site.webmanifest"],
		},
	},
});
