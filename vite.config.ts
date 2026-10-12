import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [cloudflare()],
	server: { port: Number(process.env.PORT) || 5173, strictPort: true },
	preview: { port: Number(process.env.PORT) || 4173, strictPort: true },
});
