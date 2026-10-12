import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { mockSources, save, waitRounds } from "./helpers.ts";

const DIR = "artifacts/timecode";
const ALL_OK = { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 };

test.use({ locale: "ja-JP", timezoneId: "Asia/Tokyo" });

async function open(page: Page, query = "?code=1") {
	await mockSources(page, ALL_OK);
	await page.goto(`/ja/${query}`);
	await waitRounds(page, 1);
}

type Decoded = {
	frame: number;
	pts: number | null;
	status: string;
	n: number | null;
	n_hi: number | null;
	frac: number | null;
	n_t: number | null;
	t_ms: number | null;
	t_est_ms: number | null;
	qr: string;
};

/** tools/decode-timecode.ts を CLI として実行し、CSV を読む */
function decode(files: string[], csvPath: string, extra: string[] = []): Decoded[] {
	execFileSync(process.execPath, ["tools/decode-timecode.ts", ...files, "--out", csvPath, ...extra], { stdio: ["ignore", "ignore", "inherit"] });
	const [head, ...lines] = readFileSync(csvPath, "utf8").trim().split("\n");
	const cols = head.split(",");
	return lines.map((line) => {
		const cells: string[] = [];
		let cur = "";
		let quoted = false;
		for (const ch of line) {
			if (ch === '"') quoted = !quoted;
			else if (ch === "," && !quoted) {
				cells.push(cur);
				cur = "";
			} else cur += ch;
		}
		cells.push(cur);
		const o = Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
		const num = (v: string) => (v === "" ? null : Number(v));
		return {
			frame: Number(o.frame),
			pts: num(o.pts),
			status: o.status,
			n: num(o.n),
			n_hi: num(o.n_hi),
			frac: num(o.frac),
			n_t: num(o.n_t),
			t_ms: num(o.t_ms),
			t_est_ms: num(o.t_est_ms),
			qr: o.qr,
		};
	});
}

const confirmed = (r: Decoded) => (r.status === "ok" || r.status === "mixed") && r.t_ms !== null;

test("決まった時刻を描かせたスクリーンショットから、デコーダがその時刻と番号をそのまま返す", async ({ page }, info) => {
	await open(page);
	const base = 1_760_000_000_000;
	const cases = [
		{ t: base, n: 1 },
		{ t: base + 123, n: 65_535 },
		{ t: base + 2 ** 28 - 1, n: 65_536 },
		{ t: base + 999_999.7, n: 70_000 },
		{ t: Date.now(), n: 12_345 },
		{ t: base + 0x0aaaaaa, n: 0x5555 },
	];
	const files: string[] = [];
	mkdirSync(DIR, { recursive: true });
	for (const [i, c] of cases.entries()) {
		await page.evaluate(({ t, n }) => window.__timecode.renderAt(t, n), c);
		const f = `${DIR}/${info.project.name}-exact-${i}.png`;
		await page.screenshot({ path: f });
		files.push(f);
	}
	const rows = decode(files, `${DIR}/${info.project.name}-exact.csv`);
	const result = cases.map((c, i) => ({ want: { t: Math.floor(c.t), n: c.n }, got: { status: rows[i].status, t: rows[i].t_ms, n: rows[i].n_t } }));
	save(`${info.project.name}-timecode-exact`, result);
	for (const r of result) {
		expect(r.got.status).toBe("ok");
		expect(r.got.t).toBe(r.want.t);
		expect(r.got.n).toBe(r.want.n);
	}
});

type Composite = { name: string; frames: number[]; kind: "srgb" | "linear" | "tear"; weights?: number[]; split?: number };

test("連続するフレームが混ざった・上下に分かれた画像から、写っていない時刻を返さない", async ({ page }, info) => {
	test.setTimeout(180_000);
	await open(page);
	// 0x...000 から始めると、Codex の反例（127→144→160 の多数決が176）と同じ下位ビットになる
	const base = 1_760_000_000_000 - (1_760_000_000_000 % 4096);
	const seqs = [
		{ n: 1000, t: [base + 127, base + 144, base + 160] },
		{ n: 0x7ffe, t: [base + 4079, base + 4096, base + 4112] },
		{ n: 254, t: [base + 1_000_000, base + 1_000_017, base + 1_000_033] },
	];
	const comps: Composite[] = [];
	for (const a of [0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1]) {
		comps.push({ name: `srgb-${a}`, frames: [0, 1], kind: "srgb", weights: [1 - a, a] });
		comps.push({ name: `linear-${a}`, frames: [0, 1], kind: "linear", weights: [1 - a, a] });
	}
	for (const s of [0.25, 0.35, 0.45, 0.5, 0.55, 0.65, 0.75]) comps.push({ name: `tear-${s}`, frames: [0, 1], kind: "tear", split: s });
	for (const w of [
		[1 / 3, 1 / 3, 1 / 3],
		[0.4, 0.4, 0.2],
		[0.2, 0.4, 0.4],
		[0.25, 0.5, 0.25],
		[0.45, 0.4, 0.15],
		[0.15, 0.4, 0.45],
	]) {
		for (const kind of ["srgb", "linear"] as const) comps.push({ name: `three-${kind}-${w.map((x) => x.toFixed(2)).join("-")}`, frames: [0, 1, 2], kind, weights: w });
	}

	mkdirSync(`${DIR}/blend`, { recursive: true });
	const files: string[] = [];
	const meta: { seq: number; comp: Composite; frames: { n: number; t: number }[] }[] = [];
	for (const [si, seq] of seqs.entries()) {
		const frames = seq.t.map((t, i) => ({ n: seq.n + i, t }));
		const anchor = frames[0];
		for (const comp of comps) {
			await page.evaluate(
				({ frames, comp, anchor }) => {
					const strip = document.querySelector<HTMLCanvasElement>("#timecode .tc-strip")!;
					const ctx = strip.getContext("2d")!;
					const imgs = comp.frames.map((i) => {
						window.__timecode.renderAt(frames[i].t, frames[i].n, anchor);
						return ctx.getImageData(0, 0, strip.width, strip.height).data;
					});
					const out = ctx.createImageData(strip.width, strip.height);
					const lin = (v: number) => (v / 255) ** 2.2;
					for (let p = 0; p < out.data.length; p++) {
						if ((p & 3) === 3) {
							out.data[p] = 255;
							continue;
						}
						if (comp.kind === "tear") {
							const y = Math.floor(p / 4 / strip.width);
							out.data[p] = imgs[y < strip.height * comp.split! ? 0 : 1][p];
						} else if (comp.kind === "srgb") {
							out.data[p] = Math.round(imgs.reduce((s, img, k) => s + img[p] * comp.weights![k], 0));
						} else {
							out.data[p] = Math.round(imgs.reduce((s, img, k) => s + lin(img[p]) * comp.weights![k], 0) ** (1 / 2.2) * 255);
						}
					}
					ctx.putImageData(out, 0, 0);
				},
				{ frames, comp, anchor },
			);
			const f = `${DIR}/blend/${info.project.name}-${si}-${comp.name}.png`;
			await page.locator("#timecode").screenshot({ path: f });
			files.push(f);
			meta.push({ seq: si, comp, frames: comp.frames.map((i) => frames[i]) });
		}
	}
	const rows = decode(files, `${DIR}/${info.project.name}-blend.csv`);
	let wrong = 0;
	let readable = 0;
	let mustRead = 0;
	const detail = rows.map((r, i) => {
		const m = meta[i];
		const ns = m.frames.map((f) => f.n);
		const ok = confirmed(r)
			? m.frames.some((f) => f.n === r.n_t && Math.floor(f.t) === r.t_ms)
			: r.n === null || (ns.includes(r.n) && (r.n_hi === null || ns.includes(r.n_hi)));
		if (!ok) wrong++;
		if (confirmed(r)) readable++;
		// 2枚の混ざりで一方が8割以上なら、差動セルは必ず多い方に読めるはず
		const w = m.comp.weights;
		const dominant = m.frames.length === 2 && w && Math.max(...w) >= 0.8 ? m.frames[w[0] > w[1] ? 0 : 1] : null;
		if (dominant) {
			mustRead++;
			expect(confirmed(r), `${m.comp.name} は確定するはず`).toBe(true);
			expect(r.t_ms).toBe(Math.floor(dominant.t));
		}
		return { file: files[i], comp: m.comp.name, status: r.status, n: r.n, n_hi: r.n_hi, frac: r.frac, n_t: r.n_t, t: r.t_ms, ok };
	});
	const summary = { images: rows.length, wrongConfirmedOrCandidates: wrong, confirmed: readable, mustRead, byStatus: count(rows.map((r) => r.status)) };
	save(`${info.project.name}-timecode-blend`, { summary, detail: detail.filter((d) => !d.ok || d.comp.startsWith("three") || d.comp.includes("0.5")) });
	expect(wrong).toBe(0);
	expect(mustRead).toBeGreaterThan(0);
});

function count(xs: string[]) {
	const o: Record<string, number> = {};
	for (const x of xs) o[x] = (o[x] ?? 0) + 1;
	return o;
}

test("実際のページを録画した映像から、ページが描いた時刻が単調・連続に読める", async ({ browser }, info) => {
		test.setTimeout(120_000);
		const use = info.project.use;
		// test.use({ video }) は describe の中では使えず、ファイル全体を録画にすると他の試験が遅くなるので、この試験だけ文脈を作る
		const context = await browser.newContext({
			viewport: use.viewport,
			deviceScaleFactor: use.deviceScaleFactor,
			isMobile: use.isMobile,
			hasTouch: use.hasTouch,
			userAgent: use.userAgent,
			baseURL: use.baseURL,
			locale: "ja-JP",
			timezoneId: "Asia/Tokyo",
			recordVideo: { dir: test.info().outputPath("video"), size: use.viewport ?? undefined },
		});
		const page = await context.newPage();
		await open(page);
		await page.waitForFunction(() => window.__timecode.log().length > 30);
		const startLen = await page.evaluate(() => window.__timecode.log().length);
		await page.waitForTimeout(5_000);
		// 数字と時刻帯が同じ値を描いていること（同じ rAF で同じ値を使う）
		const digits = await page.evaluate(
			() =>
				new Promise<{ text: string; t: number | null }>((resolve) =>
					requestAnimationFrame(() =>
						setTimeout(() => {
							const log = window.__timecode.log();
							resolve({ text: document.getElementById("time")!.textContent!, t: log[log.length - 1].t });
						}),
					),
				),
		);
		const log = await page.evaluate(() => window.__timecode.log());
		const video = page.video()!;
		await context.close();
		mkdirSync(DIR, { recursive: true });
		const webm = `${DIR}/${info.project.name}-live.webm`;
		await video.saveAs(webm);
		const rows = decode([webm], `${DIR}/${info.project.name}-live.csv`);
		writeFileSync(`${DIR}/${info.project.name}-live-drawlog.json`, JSON.stringify(log));

		const jst = new Date(digits.t! + 9 * 3600_000);
		const pad = (v: number, w = 2) => String(v).padStart(w, "0");
		expect(digits.text).toBe(`${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}.${pad(jst.getUTCMilliseconds(), 3)}`);

		const drawn = new Map(log.map((e) => [e.n, e.t]));
		const got = rows.filter(confirmed);
		const first = rows.findIndex(confirmed);
		const last = rows.findLastIndex(confirmed);
		const span = rows.slice(first, last + 1);
		const mismatched = got.filter((r) => drawn.has(r.n_t!) && drawn.get(r.n_t!) !== r.t_ms);
		const unknown = got.filter((r) => !drawn.has(r.n_t!));
		let backwards = 0;
		const residual: number[] = [];
		for (let i = 1; i < got.length; i++) if (got[i].t_ms! < got[i - 1].t_ms! || got[i].n_t! < got[i - 1].n_t!) backwards++;
		// 文脈を閉じる間はページが描かなくなり、録画は最後の絵を繰り返すので、最後に絵が変わったフレームまでで比べる
		const lastChange = got.findLastIndex((r, i) => i > 0 && r.n_t !== got[i - 1].n_t);
		for (const r of got.slice(0, lastChange + 1)) residual.push(r.t_ms! - r.pts! * 1000);
		const sorted = [...residual].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)];
		const dev = residual.map((r) => r - median);
		const synced = log.filter((e) => e.t !== null);
		const frameMs = (synced[synced.length - 1].t! - synced[0].t!) / (synced[synced.length - 1].n - synced[0].n);
		const pageStep = Math.max(...synced.slice(1).map((e, i) => (e.t! - synced[i].t!) / (e.n - synced[i].n)));
		const maxGapMs = Math.max(...got.slice(1).map((r, i) => r.t_ms! - got[i].t_ms!));
		const result = {
			videoFrames: rows.length,
			framesWithCode: span.length,
			confirmed: got.length,
			readRate: got.length / span.length,
			byStatus: count(rows.map((r) => r.status)),
			mismatchedWithDrawLog: mismatched.length,
			notInDrawLog: unknown.length,
			backwards,
			displayFrameMs: frameMs,
			residualVsPtsMs: { min: Math.min(...dev), max: Math.max(...dev), frames: dev.length },
			maxGapBetweenConfirmedMs: maxGapMs,
			maxPageDrawStepMs: pageStep,
			drawLogFrom: startLen,
			digits,
		};
		save(`${info.project.name}-timecode-live`, result);
		expect(got.length).toBeGreaterThan(50);
		// 選んだタイムゾーン（Asia/Tokyo）のオフセットがQRに載っている
		expect(got.some((r) => / Z540 /.test(r.qr))).toBe(true);
		expect(result.readRate).toBeGreaterThan(0.9);
		expect(mismatched.length).toBe(0);
		expect(unknown.length).toBe(0);
		expect(backwards).toBe(0);
		// ページ自身は毎フレーム途切れずに描いている（録画の隙間はページではなく取り込み側の取りこぼし）
		expect(pageStep).toBeLessThan(frameMs * 3);
		// 録画は約25fpsで、並列実行中は取り込みが数百ms止まることがある。1表示フレーム + 録画の揺らぎ（300ms）以内
		expect(frameMs).toBeGreaterThan(4);
		expect(frameMs).toBeLessThan(60);
		expect(Math.max(-result.residualVsPtsMs.min, result.residualVsPtsMs.max)).toBeLessThanOrEqual(frameMs + 300);
		expect(maxGapMs).toBeLessThan(500);
});

test("既定（設定もURLもなし）では時刻帯もQRも描かない", async ({ page }, info) => {
	await open(page, "");
	await page.waitForTimeout(500);
	await expect(page.locator("#timecode")).toBeHidden();
	expect(await page.evaluate(() => ({ enabled: window.__timecode.enabled(), drawn: window.__timecode.log().length }))).toEqual({ enabled: false, drawn: 0 });
	mkdirSync(DIR, { recursive: true });
	const f = `${DIR}/${info.project.name}-off.png`;
	await page.screenshot({ path: f });
	const [r] = decode([f], `${DIR}/${info.project.name}-off.csv`);
	expect(r.status).toBe("nocode");
	save(`${info.project.name}-timecode-off`, { status: r.status });
});

test("時刻帯は数字に重ならず、横にはみ出さない", async ({ page }, info) => {
	await open(page);
	await page.waitForFunction(() => window.__timecode.log().length > 5);
	const r = await page.evaluate(() => {
		const box = (el: Element) => el.getBoundingClientRect();
		const time = box(document.getElementById("time")!);
		const parts = [...document.querySelectorAll("#timecode canvas")].map(box);
		const overlap = parts.some((b) => b.left < time.right && b.right > time.left && b.top < time.bottom && b.bottom > time.top);
		const dpr = devicePixelRatio;
		const strip = document.querySelector<HTMLCanvasElement>("#timecode .tc-strip")!;
		return {
			overlap,
			overflow: document.documentElement.scrollWidth - innerWidth,
			rightmost: Math.max(...parts.map((b) => b.right)),
			innerWidth,
			moduleDevicePx: strip.width / 40,
			// レイアウトは 1/64 CSS px 単位に丸められるので、devicePixelRatio が整数でない端末では厳密には一致しない
			bitmapMatchesCss: Math.abs(strip.getBoundingClientRect().width * dpr - strip.width) < 0.1,
			time: { top: time.top, bottom: time.bottom },
			parts: parts.map((b) => ({ left: b.left, top: b.top, width: b.width, height: b.height })),
		};
	});
	await page.screenshot({ path: `${DIR}/${info.project.name}-layout.png`, fullPage: true });
	save(`${info.project.name}-timecode-layout`, r);
	expect(r.overlap).toBe(false);
	expect(r.overflow).toBeLessThanOrEqual(0);
	expect(r.rightmost).toBeLessThanOrEqual(r.innerWidth);
	expect(Number.isInteger(r.moduleDevicePx)).toBe(true);
	expect(r.bitmapMatchesCss).toBe(true);
	expect(r.moduleDevicePx).toBeGreaterThanOrEqual(20);
});

test("設定のスイッチで時刻帯を出し入れでき、再読み込み後も残る。?code=0 はその表示の間だけ消す", async ({ page }, info) => {
	await open(page, "");
	const code = page.locator("#timecode");
	const box = page.locator('#settings [name="code"]');
	await expect(code).toBeHidden();

	await page.locator("#open-settings").click();
	await box.check();
	await page.keyboard.press("Escape");
	await expect(code).toBeVisible();
	await page.waitForFunction(() => window.__timecode.log().length > 5);

	await page.reload();
	await waitRounds(page, 1);
	await expect(code).toBeVisible();
	await page.waitForFunction(() => window.__timecode.enabled() && window.__timecode.log().length > 5);
	await expect(page.locator("body")).toHaveAttribute("data-synced", "true");
	// QR は500msごとにしか作り直さないので、起動直後の未同期の QR（T-）が残っていると時刻の上位ビットを補えない
	await page.waitForFunction(() => /^JC1 \S+ T\d/.test(window.__timecode.qr() ?? ""));
	mkdirSync(DIR, { recursive: true });
	const f = `${DIR}/${info.project.name}-setting-on.png`;
	await page.screenshot({ path: f });
	const [r] = decode([f], `${DIR}/${info.project.name}-setting-on.csv`);
	expect(confirmed(r), `status=${r.status}`).toBe(true);

	await page.goto("/ja/?code=0");
	await waitRounds(page, 1);
	await expect(code).toBeHidden();
	const stored = await page.evaluate(() => localStorage.getItem("ms-clock:settings"));

	await page.goto("/ja/");
	await waitRounds(page, 1);
	await expect(code).toBeVisible();
	await page.locator("#open-settings").click();
	await expect(box).toBeChecked();
	await box.uncheck();
	await page.keyboard.press("Escape");
	await expect(code).toBeHidden();
	const offLen = await page.evaluate(() => window.__timecode.log().length);
	await page.waitForTimeout(300);
	expect(await page.evaluate(() => window.__timecode.log().length)).toBe(offLen);

	await page.reload();
	await waitRounds(page, 1);
	await expect(code).toBeHidden();
	save(`${info.project.name}-timecode-setting`, { decodedAfterReload: r.status, storedWhileOverridden: stored });
	expect(JSON.parse(stored!)).toMatchObject({ code: true });
});

test("撮影の途中で時刻帯の位置がずれても、ずれた後のフレームを位置を探し直して読む", async ({ page }, info) => {
	await open(page);
	const base = 1_760_000_000_000;
	const anchor = { n: 500, t: base };
	const frames = Array.from({ length: 6 }, (_, i) => ({ n: 500 + i, t: base + i * 17 }));
	const dir = `${DIR}/shift-${info.project.name}`;
	mkdirSync(dir, { recursive: true });
	for (const [i, f] of frames.entries()) {
		// 2枚目から 10 デバイスピクセル右へ（Codex の再現と同じく、モジュールの半分ほど）
		await page.evaluate(
			({ f, anchor, shifted }) => {
				const strip = document.querySelector<HTMLCanvasElement>("#timecode .tc-strip")!;
				strip.style.transform = shifted ? `translateX(${10 / devicePixelRatio}px)` : "";
				window.__timecode.renderAt(f.t, f.n, anchor);
			},
			{ f, anchor, shifted: i >= 1 },
		);
		await page.screenshot({ path: `${dir}/${String(i).padStart(2, "0")}.png` });
	}
	// 画像を別々に読むと毎回位置を探すので、無劣化（FFV1）の1本の映像にして、前のフレームの位置を引き継ぐ経路を通す
	const video = `${DIR}/${info.project.name}-shift.mkv`;
	execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-y", "-framerate", "10", "-i", `${dir}/%02d.png`, "-c:v", "ffv1", "-pix_fmt", "gray", video]);
	const rows = decode([video], `${DIR}/${info.project.name}-shift.csv`);
	const result = rows.map((r, i) => ({ status: r.status, t: r.t_ms, n: r.n_t, want: frames[i] }));
	save(`${info.project.name}-timecode-shift`, result);
	expect(rows).toHaveLength(frames.length);
	for (const r of result) {
		expect(r.status).toBe("ok");
		expect(r.t).toBe(r.want.t);
		expect(r.n).toBe(r.want.n);
	}
});
