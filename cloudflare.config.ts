import { defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "jst-clock",
		compatibilityDate: "2026-10-01",
		entrypoint,
		assets: {
			notFoundHandling: "none",
		},
	},
});
