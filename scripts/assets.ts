import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { PRODUCT_NAME } from "../src/shared/brand.ts";

const OG = { width: 1200, height: 630 };
const browser = await chromium.launch();

async function render(html: string, width: number, height: number) {
	const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
	await page.setContent(html, { waitUntil: "load" });
	const png = await page.screenshot({ type: "png" });
	await page.close();
	return png;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const og = await render(readFileSync("scripts/og.html", "utf8").replaceAll("{name}", escape(PRODUCT_NAME)), OG.width, OG.height);
const hash = createHash("sha256").update(og).digest("hex").slice(0, 10);
mkdirSync("public/og", { recursive: true });
for (const f of readdirSync("public/og")) rmSync(`public/og/${f}`);
const ogPath = `/og/card-${hash}.png`;
writeFileSync(`public${ogPath}`, og);
writeFileSync(
	"src/shared/og-image.ts",
	`// scripts/assets.ts が生成する。手で書き換えない\nexport const OG_IMAGE = { path: "${ogPath}", width: ${OG.width}, height: ${OG.height}, type: "image/png" } as const;\n`,
);

// 透明な角のまま書き出さないのは、apple-touch-icon やマニフェストのアイコンは OS が自前で角を丸め、透明部分が白や黒の縁として出るため
const svg = readFileSync("public/favicon.svg", "utf8");
const icon = (size: number) => render(`<body style="margin:0;background:#050607"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${size}" height="${size}" style="display:block"></body>`, size, size);
const sizes = { "favicon-32.png": 32, "apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512 };
const pngs: Record<string, Buffer> = {};
for (const [name, size] of Object.entries(sizes)) writeFileSync(`public/${name}`, (pngs[name] = await icon(size)));

// .ico を別のツールで作らないのは、ICO は PNG をそのまま1枚包めるので、6+16バイトのヘッダーを足すだけで足りるため
const png32 = pngs["favicon-32.png"];
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6);
ico.writeUInt8(32, 7);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png32.length, 14);
ico.writeUInt32LE(22, 18);
writeFileSync("public/favicon.ico", Buffer.concat([ico, png32]));

await browser.close();
console.log(`OG image: public${ogPath} (${og.length} bytes)`);
