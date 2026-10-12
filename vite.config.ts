import { execFileSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

function version() {
	try {
		return execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim().toUpperCase();
	} catch {
		return "DEV";
	}
}

export default defineConfig({
	plugins: [cloudflare()],
	define: { __APP_VERSION__: JSON.stringify(version()) },
	server: { port: Number(process.env.PORT) || 5173, strictPort: true },
	preview: { port: Number(process.env.PORT) || 4173, strictPort: true },
});
