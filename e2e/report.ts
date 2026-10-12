import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

/** E2Eの各結果を、あとから読み返して再現できる1枚のMarkdownにまとめる */
export default function report() {
	const dir = "artifacts/results";
	if (!existsSync(dir)) return;
	const results = Object.fromEntries(
		readdirSync(dir)
			.filter((f) => f.endsWith(".json"))
			.map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))]),
	);
	const lines = [
		"# E2E レポート",
		"",
		`- 生成: ${new Date().toISOString()}`,
		`- 再現: \`${process.env.BASE_URL ? `BASE_URL=${process.env.BASE_URL} ` : ""}pnpm test:e2e\``,
		"",
	];
	const net = results["real-network"];
	if (net) {
		lines.push(
			"## 実ネットワーク精度",
			"",
			`- 対象: ${net.baseURL}`,
			`- ページの推定（正しい時刻 − システム時計）: ${net.page.offsetVsSystem.toFixed(1)} ms（誤差上限 ±${net.page.half.toFixed(1)} ms、${net.page.responding}つ中${net.page.agreeing}つ一致）`,
			`- NTP基準（${net.ntp.best.server}、遅延最小）: ${net.ntp.best.offset.toFixed(1)} ms（±${net.ntp.best.half.toFixed(1)} ms）`,
			`- 差: **${net.diffMs.toFixed(1)} ms**（許容 ±${net.boundMs.toFixed(1)} ms）→ ${net.pass ? "合格" : "不合格"}`,
			"",
			"| 時刻源 | 判定 |",
			"|---|---|",
			...Object.entries(net.page.status).map(([k, v]) => `| ${k} | ${v} |`),
			"",
			"| NTPサーバー | オフセット (ms) | 遅延 (ms) |",
			"|---|---|---|",
			...net.ntp.all.map((n: { server: string; offset: number; delay: number }) => `| ${n.server} | ${n.offset.toFixed(1)} | ${n.delay.toFixed(1)} |`),
			"",
		);
	}
	lines.push("## 各試験の生データ", "");
	for (const [k, v] of Object.entries(results)) {
		if (k === "real-network") continue;
		lines.push(`### ${k}`, "", "```json", JSON.stringify(v, null, 2), "```", "");
	}
	lines.push("スクリーンショット: `artifacts/screenshots/`、言語ごと: `artifacts/i18n/`", "");
	writeFileSync("artifacts/e2e-report.md", lines.join("\n"));
}
