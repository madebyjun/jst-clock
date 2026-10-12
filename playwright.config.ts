import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT) || 4173;
const remote = process.env.BASE_URL;

export default defineConfig({
	testDir: "e2e",
	reporter: [["list"], ["html", { open: "never" }]],
	globalTeardown: "./e2e/report.ts",
	use: { baseURL: remote ?? `http://localhost:${port}` },
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],
	webServer: remote
		? undefined
		: {
				command: `pnpm build && PORT=${port} pnpm vite preview`,
				url: `http://localhost:${port}/`,
				reuseExistingServer: false,
				timeout: 120_000,
			},
});
