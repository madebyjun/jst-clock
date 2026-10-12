import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT) || 4173;
const remote = process.env.BASE_URL;

export default defineConfig({
	testDir: "e2e",
	reporter: [["list"], ["html", { open: "never" }]],
	globalTeardown: "./e2e/report.ts",
	use: { baseURL: remote ?? `http://localhost:${port}` },
	// 背景の流体はヘッドレスChromiumではソフトウェア描画になりCPUを大きく使う。時刻の試験と同時に走らせると往復時間が伸びて時刻の試験が落ちるので、後に回す
	projects: [
		{ name: "desktop", testIgnore: "bg.spec.ts", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", testIgnore: "bg.spec.ts", use: { ...devices["Pixel 7"] } },
		{ name: "desktop-bg", testMatch: "bg.spec.ts", dependencies: ["desktop", "mobile"], use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile-bg", testMatch: "bg.spec.ts", dependencies: ["desktop", "mobile"], use: { ...devices["Pixel 7"] } },
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
