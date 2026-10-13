import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { confirmed, type Decoded, decode, mockSources, save, waitRounds } from "./helpers.ts";

const DIR = "artifacts/timecode";
const ALL_OK = { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 };

test.use({ locale: "ja-JP", timezoneId: "Asia/Tokyo" });

async function open(page: Page, query = "?code=1") {
	await mockSources(page, ALL_OK);
	await page.goto(`/ja/${query}`);
	await waitRounds(page, 1);
}


test("決まった時刻を描かせたスクリーンショットから、デコーダがその時刻と番号をそのまま返す（v2 と旧形式 v1）", async ({ page }, info) => {
	await open(page);
	const hold = await page.evaluate(() => window.__timecode.hold());
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
	const wants: { format: 1 | 2; t: number; n: number }[] = [];
	mkdirSync(DIR, { recursive: true });
	for (const format of [2, 1] as const) {
		for (const [i, c] of cases.entries()) {
			await page.evaluate(({ t, n, format }) => window.__timecode.renderAt(t, n, undefined, format), { ...c, format });
			const f = `${DIR}/${info.project.name}-exact-v${format}-${i}.png`;
			await page.screenshot({ path: f });
			files.push(f);
			// v2 の行0は描画番号ではなく時刻の目盛り floor(t / hold)
			wants.push({ format, t: Math.floor(c.t), n: format === 2 ? Math.floor(c.t / hold) : c.n });
		}
	}
	const rows = decode(files, `${DIR}/${info.project.name}-exact.csv`);
	const result = wants.map((want, i) => ({ want, got: { status: rows[i].status, format: rows[i].format, t: rows[i].t_ms, n: rows[i].n_t } }));
	save(`${info.project.name}-timecode-exact`, result);
	for (const r of result) {
		expect(r.got.status).toBe("ok");
		expect(r.got.format).toBe(r.want.format);
		expect(r.got.t).toBe(r.want.t);
		expect(r.got.n).toBe(r.want.n);
	}
});

type Composite = { name: string; frames: number[]; kind: "srgb" | "linear" | "tear"; weights?: number[]; split?: number };

test("連続するフレームが混ざった・上下に分かれた画像から、写っていない時刻を確定させず、範囲は写った値を覆う", async ({ page }, info) => {
	test.setTimeout(240_000);
	await open(page);
	const hold = await page.evaluate(() => window.__timecode.hold());
	// 0x...000 から始めると、Codex の反例（127→144→160 の多数決が176）と同じ下位ビットになる
	const base = 1_760_000_000_000 - (1_760_000_000_000 % 4096);
	// v2 は行0が floor(t / hold) なので、連続する値は保持時間ずつ離れた時刻（q = 0x7fff→0x8000 の繰り上がりを含む）
	const q0 = 0x7ffe;
	const seqs = [
		{ format: 1 as const, n: 1000, t: [base + 127, base + 144, base + 160] },
		{ format: 1 as const, n: 0x7ffe, t: [base + 4079, base + 4096, base + 4112] },
		{ format: 2 as const, n: 0, t: [0, 1, 2].map((k) => (Math.floor(base / hold / N16) * N16 + q0 + k) * hold + 3) },
		{ format: 2 as const, n: 0, t: [0, 1, 2].map((k) => Math.floor(base / hold) * hold + k * hold + 7) },
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
		const frames = seq.t.map((t, i) => ({ n: seq.format === 2 ? Math.floor(t / hold) : seq.n + i, t }));
		const anchor = frames[0];
		const format = seq.format;
		for (const comp of comps) {
			await page.evaluate(
				({ frames, comp, anchor, format }) => {
					const strip = document.querySelector<HTMLCanvasElement>("#timecode .tc-strip")!;
					const ctx = strip.getContext("2d")!;
					const imgs = comp.frames.map((i) => {
						window.__timecode.renderAt(frames[i].t, frames[i].n, anchor, format);
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
				{ frames, comp, anchor, format },
			);
			const f = `${DIR}/blend/${info.project.name}-${si}-${comp.name}.png`;
			await page.locator("#timecode").screenshot({ path: f });
			files.push(f);
			meta.push({ seq: si, comp, frames: comp.frames.map((i) => frames[i]) });
		}
	}
	const rows = decode(files, `${DIR}/${info.project.name}-blend.csv`);
	let wrong = 0;
	let missed = 0;
	let readable = 0;
	let mustRead = 0;
	const detail = rows.map((r, i) => {
		const m = meta[i];
		const ns = m.frames.map((f) => f.n);
		const lo = r.n;
		const hi = r.n_hi ?? r.n;
		const inRange = (n: number) => lo !== null && hi !== null && n >= lo && n <= hi;
		// 範囲は写った可能性のある値を覆う区間（写っていない値も含みうる）。少なくとも1つは写った値を含むこと
		const ok = confirmed(r) ? m.frames.some((f) => f.n === r.n_t && Math.floor(f.t) === r.t_ms) : lo === null || ns.some(inRange);
		if (!ok) wrong++;
		// 寄与が3割以上の値は範囲（または確定値）に入っていること
		const heavy = m.comp.weights ? m.frames.filter((_, k) => m.comp.weights![k] >= 0.3) : [];
		const covered = heavy.every((f) => inRange(f.n));
		if (lo !== null && !covered) missed++;
		if (confirmed(r)) readable++;
		// 2枚の混ざりで一方が8割以上なら、差動セルは必ず多い方に読めるはず
		const w = m.comp.weights;
		const dominant = m.frames.length === 2 && w && Math.max(...w) >= 0.8 ? m.frames[w[0] > w[1] ? 0 : 1] : null;
		if (dominant) {
			mustRead++;
			expect(confirmed(r), `${m.comp.name} は確定するはず`).toBe(true);
			expect(r.t_ms).toBe(Math.floor(dominant.t));
		}
		return { file: files[i], comp: m.comp.name, format: r.format, status: r.status, n: r.n, n_hi: r.n_hi, frac: r.frac, n_t: r.n_t, t: r.t_ms, ok, covered };
	});
	const summary = { images: rows.length, wrongConfirmedOrRange: wrong, heavyValueMissed: missed, confirmed: readable, mustRead, byStatus: count(rows.map((r) => r.status)) };
	save(`${info.project.name}-timecode-blend`, { summary, detail: detail.filter((d) => !d.ok || !d.covered || d.comp.startsWith("three") || d.comp.includes("0.5")) });
	expect(wrong).toBe(0);
	expect(missed).toBe(0);
	expect(mustRead).toBeGreaterThan(0);
});

const N16 = 2 ** 16;

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
		await page.waitForFunction(() => window.__timecode.log().length > 5);
		const startLen = await page.evaluate(() => window.__timecode.log().length);
		await page.waitForTimeout(5_000);
		// 時刻帯を描き直したフレームでは、数字と時刻帯が同じ値を描いていること（同じ rAF で同じ値を使う）
		const digits = await page.evaluate(
			() =>
				new Promise<{ text: string; t: number | null }>((resolve) => {
					const start = window.__timecode.log().length;
					const poll = () =>
						requestAnimationFrame(() =>
							setTimeout(() => {
								const log = window.__timecode.log();
								if (log.length === start) return poll();
								resolve({ text: document.getElementById("time")!.textContent!, t: log[log.length - 1].t });
							}),
						);
					poll();
				}),
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
		const hold = await (async () => Number(/ G(\d+) /.exec(got[0].qr)![1]))();
		const synced = log.filter((e) => e.t !== null);
		const frameMs = Number(/ F([\d.]+) /.exec(got[got.length - 1].qr)![1]);
		// 値は保持時間の区切りをまたいだ最初のフレームで描き直すので、t₀ は必ず [q·H, (q+1)·H) に入る
		const pageStep = Math.max(...synced.map((e) => e.t! - e.n * hold));
		// rAF が保持時間より長く止まれば区切りを飛ばすのは仕様（q は時刻の目盛り）。飛ばしたのは、描画の間隔が H を超えたときだけであること
		const skips = synced.slice(1).flatMap((e, i) => (e.n !== synced[i].n + 1 ? [{ from: synced[i], to: e, gapMs: e.t! - synced[i].t! }] : []));
		const skipped = skips.length;
		const unexplainedSkips = skips.filter((k) => k.gapMs <= hold).length;
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
			holdMs: hold,
			maxRedrawLateMs: pageStep,
			skippedValues: skipped,
			skips,
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
		expect(Math.min(...synced.map((e) => e.t! - e.n * hold))).toBeGreaterThanOrEqual(0);
		expect(pageStep).toBeLessThan(hold);
		expect(unexplainedSkips).toBe(0);
		// 録画は約25fpsで、並列実行中は取り込みが数百ms止まることがある。保持時間 + 1表示フレーム + 録画の揺らぎ（300ms）以内
		expect(frameMs).toBeGreaterThan(4);
		expect(frameMs).toBeLessThan(60);
		expect(Math.max(-result.residualVsPtsMs.min, result.residualVsPtsMs.max)).toBeLessThanOrEqual(hold + frameMs + 300);
		expect(maxGapMs).toBeLessThan(hold + 500);
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
	const hold = await page.evaluate(() => window.__timecode.hold());
	const result = rows.map((r, i) => ({ status: r.status, t: r.t_ms, n: r.n_t, want: { t: frames[i].t, n: Math.floor(frames[i].t / hold) } }));
	save(`${info.project.name}-timecode-shift`, result);
	expect(rows).toHaveLength(frames.length);
	for (const r of result) {
		expect(r.status).toBe("ok");
		expect(r.t).toBe(r.want.t);
		expect(r.n).toBe(r.want.n);
	}
});

test("表示用の回転（0/90/180/270°）が付いた映像も、再生したときの向きで読み、--corners もその向きの座標で効く", async ({ page }, info) => {
	await open(page);
	const want = { t: 1_760_000_123_456, n: 4242 };
	await page.evaluate(({ t, n }) => window.__timecode.renderAt(t, n), want);
	const dir = `${DIR}/rotation-${info.project.name}`;
	mkdirSync(dir, { recursive: true });
	const png = `${dir}/upright.png`;
	await page.screenshot({ path: png });
	// 白枠の外周の四隅（スクショのデバイスピクセル）。静寂域の2モジュールぶん内側
	const corners = await page.evaluate(() => {
		const strip = document.querySelector<HTMLCanvasElement>("#timecode .tc-strip")!;
		const r = strip.getBoundingClientRect();
		const dpr = devicePixelRatio;
		const m = strip.width / 40;
		const x0 = Math.round(r.left * dpr) + 2 * m;
		const y0 = Math.round(r.top * dpr) + 2 * m;
		const x1 = x0 + 36 * m;
		const y1 = y0 + 6 * m;
		return [x0, y0, x1, y0, x1, y1, x0, y1].join(",");
	});
	const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
	const ffprobe = process.env.FFPROBE ?? "ffprobe";
	// 保存する絵を逆向きに回しておき、表示用の回転タグで元の向きに戻る映像を作る（スマホの縦撮りと同じ構造）
	const cases = [
		{ rotation: 0, filter: "null" },
		{ rotation: 90, filter: "transpose=clock" },
		{ rotation: 180, filter: "hflip,vflip" },
		{ rotation: 270, filter: "transpose=cclock" },
	];
	const result = [];
	for (const c of cases) {
		const stored = `${dir}/stored-${c.rotation}.mp4`;
		const video = `${DIR}/${info.project.name}-rotation-${c.rotation}.mp4`;
		execFileSync(ffmpeg, ["-v", "error", "-y", "-loop", "1", "-i", png, "-vf", c.filter, "-frames:v", "3", "-c:v", "libx264rgb", "-crf", "0", stored]);
		execFileSync(ffmpeg, ["-v", "error", "-y", "-display_rotation", String(c.rotation), "-i", stored, "-c", "copy", video]);
		const dims = execFileSync(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", video]).toString().trim().split(",").slice(0, 2).join("x");
		const auto = decode([video], `${DIR}/${info.project.name}-rotation-${c.rotation}.csv`);
		const manual = decode([video], `${DIR}/${info.project.name}-rotation-${c.rotation}-corners.csv`, ["--corners", corners]);
		result.push({ rotation: c.rotation, storedDims: dims, auto: auto.map((r) => r.status), manual: manual.map((r) => r.status) });
		const hold = await page.evaluate(() => window.__timecode.hold());
		for (const r of [...auto, ...manual]) {
			expect(r.status, `${c.rotation}°`).toBe("ok");
			expect(r.t_ms).toBe(want.t);
			expect(r.n_t).toBe(Math.floor(want.t / hold));
		}
	}
	save(`${info.project.name}-timecode-rotation`, { corners, result });
	// 90/270° では保存された幅と高さが表示と入れ替わっていること（試験が回転の経路を通っていることの確認）
	expect(result[1].storedDims).toBe(result[3].storedDims);
	expect(result[1].storedDims).not.toBe(result[0].storedDims);
});

type Smear = { format: 1 | 2; exposure: number; capture: number; values: { n: number; t: number; start: number }[] };

test("応答の遅いパネルと長い露光で3値以上がにじんでも、誤った確定値を出さず、範囲で主な値を覆う", async ({ page }, info) => {
	test.setTimeout(240_000);
	await open(page);
	const hold = await page.evaluate(() => window.__timecode.hold());
	// 上昇と下降で時定数が違う一次応答（液晶は暗くなる方が遅いことが多い）。3τ でほぼ落ち着く
	const TAU_RISE = 8;
	const TAU_FALL = 20;
	const base = Math.floor(1_760_000_000_000 / hold) * hold;
	const v2 = Array.from({ length: 5 }, (_, k) => ({ n: Math.floor((base + k * hold + 3) / hold), t: base + k * hold + 3, start: k * hold }));
	const frame = 1000 / 120;
	const v1 = Array.from({ length: 16 }, (_, k) => ({ n: 9000 + k, t: base + Math.round(k * frame), start: k * frame }));
	const cases: Smear[] = [];
	for (const exposure of [4, 1000 / 60, 1000 / 30]) {
		for (const phase of [-10, 0, 5, 10, 20, 30, 45, 60, 80, 99]) cases.push({ format: 2, exposure, capture: 2 * hold + phase, values: v2 });
		for (const k of [9, 10, 11, 12]) for (const off of [0, frame / 2]) cases.push({ format: 1, exposure, capture: k * frame + off, values: v1 });
	}
	mkdirSync(`${DIR}/smear`, { recursive: true });
	const files: string[] = [];
	for (const [i, c] of cases.entries()) {
		await page.evaluate(
			({ c, TAU_RISE, TAU_FALL }) => {
				const strip = document.querySelector<HTMLCanvasElement>("#timecode .tc-strip")!;
				const ctx = strip.getContext("2d")!;
				const m = strip.width / 40;
				const anchor = { n: c.values[0].n, t: c.values[0].t };
				// 各値のモジュールの白黒（線形光で 0 か 1）
				const targets = c.values.map((v) => {
					window.__timecode.renderAt(v.t, v.n, anchor, c.format);
					const px = ctx.getImageData(0, 0, strip.width, strip.height).data;
					return Array.from({ length: 6 }, (_, y) => Array.from({ length: 36 }, (_, x) => px[(Math.floor((2 + y + 0.5) * m) * strip.width + Math.floor((2 + x + 0.5) * m)) * 4] > 128 ? 1 : 0));
				});
				const dt = 0.25;
				const active = (t: number) => c.values.reduce((k, v, i) => (v.start <= t ? i : k), 0);
				for (let y = 0; y < 6; y++) {
					for (let x = 0; x < 36; x++) {
						let level = targets[0][y][x];
						let sum = 0;
						let samples = 0;
						for (let t = 0; t <= c.capture; t += dt) {
							const target = targets[active(t)][y][x];
							const tau = target > level ? TAU_RISE : TAU_FALL;
							level += (target - level) * (1 - Math.exp(-dt / tau));
							if (t > c.capture - c.exposure) {
								sum += level;
								samples++;
							}
						}
						const v = Math.round(255 * (sum / samples) ** (1 / 2.2));
						ctx.fillStyle = `rgb(${v},${v},${v})`;
						ctx.fillRect((2 + x) * m, (2 + y) * m, m, m);
					}
				}
			},
			{ c, TAU_RISE, TAU_FALL },
		);
		const f = `${DIR}/smear/${info.project.name}-${String(i).padStart(3, "0")}-v${c.format}-e${c.exposure.toFixed(0)}-c${c.capture.toFixed(1)}.png`;
		await page.locator("#timecode").screenshot({ path: f });
		files.push(f);
	}
	const rows = decode(files, `${DIR}/${info.project.name}-smear.csv`);
	const lag = (TAU_RISE + TAU_FALL) / 2;
	let wrong = 0;
	let dominantMissed = 0;
	let withValue = 0;
	const detail = rows.map((r, i) => {
		const c = cases[i];
		// 露光の間に目標になっていた値と、その少し前まで目標だった値（応答の尾が残る）
		const shownAt = (k: number) => {
			const end = c.values[k + 1]?.start ?? Number.POSITIVE_INFINITY;
			return c.values[k].start <= c.capture && end >= c.capture - c.exposure - 3 * TAU_FALL;
		};
		const present = c.values.filter((_, k) => shownAt(k)).map((v) => v.n);
		// 応答の遅れぶんずらした露光の窓で、いちばん長く目標だった値
		const overlap = (k: number) => {
			const end = c.values[k + 1]?.start ?? Number.POSITIVE_INFINITY;
			return Math.max(0, Math.min(end, c.capture - lag) - Math.max(c.values[k].start, c.capture - c.exposure - lag));
		};
		const dominant = c.values.reduce((best, _, k) => (overlap(k) > overlap(best) ? k : best), 0);
		const lo = r.n;
		const hi = r.n_hi ?? r.n;
		const ok = confirmed(r) ? present.includes(r.n_t!) && c.values.some((v) => v.n === r.n_t && Math.floor(v.t) === r.t_ms) : lo === null || present.some((n) => n >= lo && n <= hi!);
		if (!ok) wrong++;
		if (lo !== null) {
			withValue++;
			if (!(c.values[dominant].n >= lo && c.values[dominant].n <= hi!)) dominantMissed++;
		}
		return { file: files[i], format: c.format, exposure: c.exposure, capture: c.capture, status: r.status, n: lo, n_hi: r.n_hi, n_t: r.n_t, present, dominant: c.values[dominant].n, ok };
	});
	const summary = { images: rows.length, byStatus: count(rows.map((r) => r.status)), wrong, withValue, dominantMissed, dominantCoverage: (withValue - dominantMissed) / withValue };
	save(`${info.project.name}-timecode-smear`, { tauRise: TAU_RISE, tauFall: TAU_FALL, hold, summary, detail });
	expect(wrong).toBe(0);
	expect(withValue / rows.length).toBeGreaterThan(0.9);
	expect(summary.dominantCoverage).toBeGreaterThan(0.9);
	// v2 では、露光と応答が落ち着いた位相（切り替わりから 3τ + 露光以上あと）は1つの値に確定する
	const settled = detail.filter((d) => d.format === 2 && ((d.capture % hold) + hold) % hold >= 3 * TAU_FALL + d.exposure);
	expect(settled.length).toBeGreaterThan(0);
	for (const d of settled) expect(d.status, d.file).toBe("ok");
});

/** 実機の映像（利用者の撮影物なので git には入れない）。TIMECODE_REAL_VIDEOS にパスを : 区切りで渡すか、artifacts/real-camera/videos/ に置く */
function realVideos() {
	const env = process.env.TIMECODE_REAL_VIDEOS;
	if (env) return env.split(":").filter((f) => existsSync(f));
	const dir = "artifacts/real-camera/videos";
	return existsSync(dir) ? readdirSync(dir).filter((f) => /\.(mov|mp4|mkv|webm)$/i.test(f)).map((f) => `${dir}/${f}`) : [];
}

test("実機の映像（120Hz の液晶を iPhone で撮影）から、ほぼ全フレームで値か範囲を読み、QR と矛盾しない", async ({}, info) => {
	const videos = realVideos();
	test.skip(videos.length === 0, "実機の映像がない（TIMECODE_REAL_VIDEOS か artifacts/real-camera/videos/ に置くと実行する）");
	test.skip(info.project.name !== "desktop", "映像のデコードは端末の種類に依存しないので1回で十分");
	test.setTimeout(900_000);
	mkdirSync("artifacts/real-camera", { recursive: true });
	const results = [];
	for (const video of videos) {
		const name = basename(video).replace(/\.[^.]+$/, "");
		const rows = decode([video], `artifacts/real-camera/after-${name}.csv`);
		const usable = rows.filter((r) => (r.status === "ok" || r.status === "mixed" || r.status === "range") && r.n !== null);
		const timed = usable.filter((r) => r.t_ms !== null || r.t_lo_ms !== null);
		// 各フレームの番号の範囲は、そのとき見えている QR のアンカーより前ではなく、次に現れるアンカーより後ではない（にじみの分 8 の余裕）
		const anchorN = (r: Decoded) => Number(/ N(\d+) /.exec(r.qr)?.[1] ?? Number.NaN);
		let contradictions = 0;
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			if (!usable.includes(r)) continue;
			const now = anchorN(r);
			const next = rows.slice(i + 1).map(anchorN).find((n) => n > now);
			if ((r.n_hi ?? r.n!) < now - 8 || (next !== undefined && r.n! > next + 8)) contradictions++;
		}
		let backwards = 0;
		let prevLo = Number.NEGATIVE_INFINITY;
		for (const r of usable) {
			if ((r.n_hi ?? r.n!) < prevLo - 8) backwards++;
			prevLo = Math.max(prevLo, r.n!);
		}
		const widths = usable.map((r) => (r.n_hi ?? r.n!) - r.n! + 1).sort((a, b) => a - b);
		results.push({
			video,
			frames: rows.length,
			byStatus: count(rows.map((r) => r.status)),
			usableRate: usable.length / rows.length,
			timedRate: timed.length / rows.length,
			medianRangeWidth: widths[Math.floor(widths.length / 2)],
			contradictions,
			backwards,
		});
	}
	save("real-camera", results);
	for (const r of results) {
		expect(r.usableRate, r.video).toBeGreaterThan(0.9);
		expect(r.timedRate, r.video).toBeGreaterThan(0.9);
		expect(r.contradictions, r.video).toBe(0);
		expect(r.backwards, r.video).toBe(0);
	}
});

test("v1 の範囲を後の QR アンカーで埋めたあとも、そのフレームの QR と矛盾する範囲は捨てる（Codex の再現）", async ({ page }, info) => {
	await open(page);
	const base = 1_760_000_000_000;
	const dir = `${DIR}/v1-anchor-${info.project.name}`;
	mkdirSync(dir, { recursive: true });
	const shots = [
		{ name: "anchor60", frames: [{ n: 60, t: base + 500 }], anchor: { n: 60, t: base + 500 }, flip: false },
		// 64 と 65 が半々に混ざり、行0のビット8だけを確信を持って誤読した（白黒を入れ替えた）フレーム。QR はまだ n=60 のアンカー
		{ name: "smear-flip", frames: [{ n: 64, t: base + 567 }, { n: 65, t: base + 575 }], anchor: { n: 60, t: base + 500 }, flip: true },
		{ name: "anchor440", frames: [{ n: 440, t: base + 4000 }], anchor: { n: 440, t: base + 4000 }, flip: false },
		{ name: "anchor450", frames: [{ n: 450, t: base + 4500 }], anchor: { n: 450, t: base + 4500 }, flip: false },
	];
	for (const [i, s] of shots.entries()) {
		await page.evaluate((s) => {
			const strip = document.querySelector<HTMLCanvasElement>("#timecode .tc-strip")!;
			const ctx = strip.getContext("2d")!;
			const imgs = s.frames.map((f) => {
				window.__timecode.renderAt(f.t, f.n, s.anchor, 1);
				return ctx.getImageData(0, 0, strip.width, strip.height);
			});
			const out = imgs[0];
			for (let p = 0; p < out.data.length; p++) out.data[p] = Math.round(imgs.reduce((sum, img) => sum + img.data[p], 0) / imgs.length);
			ctx.putImageData(out, 0, 0);
			if (s.flip) {
				// 行0（モジュール行2+1）のビット8 は上位から7番目の組。左右のセルの色を入れ替える
				const m = strip.width / 40;
				const y = (2 + 1) * m;
				const xl = (2 + 3 + 2 * 7) * m;
				const left = ctx.getImageData(xl, y, m, m);
				const right = ctx.getImageData(xl + m, y, m, m);
				ctx.putImageData(right, xl, y);
				ctx.putImageData(left, xl + m, y);
			}
		}, s);
		await page.screenshot({ path: `${dir}/${String(i).padStart(2, "0")}.png` });
	}
	const video = `${DIR}/${info.project.name}-v1-anchor.mkv`;
	execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-y", "-framerate", "10", "-i", `${dir}/%02d.png`, "-c:v", "ffv1", "-pix_fmt", "gray", video]);
	const rows = decode([video], `${DIR}/${info.project.name}-v1-anchor.csv`, ["--qr-every", "1"]);
	save(`${info.project.name}-timecode-v1-anchor`, rows.map((r) => ({ status: r.status, n: r.n, n_hi: r.n_hi, t_lo: r.t_lo_ms, t_hi: r.t_hi_ms, t_est: r.t_est_ms, qr: r.qr })));
	const smear = rows[1];
	// 誤読したビットのせいで番号は 446〜447 のように遠くへ飛ぶ。そのとき見えている QR（T = base+500）から 2 秒を超える範囲は出さない
	expect(smear.n).not.toBeNull();
	expect(smear.status).toBe("inconsistent");
	expect(smear.t_lo_ms).toBeNull();
	expect(smear.t_hi_ms).toBeNull();
	expect(smear.t_est_ms).toBeNull();
	for (const r of rows) if (r.t_hi_ms !== null) expect(r.t_lo_ms!).toBeLessThanOrEqual(/ T(\d+) /.exec(r.qr) ? Number(/ T(\d+) /.exec(r.qr)![1]) + 2000 : Number.POSITIVE_INFINITY);
});

test("v2 で QR が読めず --around が2時間ずれていても、CRC で確かめた時刻から q の上位を決める（Codex の再現）", async ({ page }, info) => {
	await open(page);
	const hold = await page.evaluate(() => window.__timecode.hold());
	const t = 1_760_000_000_123;
	await page.evaluate((t) => {
		window.__timecode.renderAt(t, 1);
		document.querySelector<HTMLCanvasElement>("#timecode .tc-qr")!.style.visibility = "hidden";
	}, t);
	mkdirSync(DIR, { recursive: true });
	const f = `${DIR}/${info.project.name}-v2-around.png`;
	await page.screenshot({ path: f });
	const [r] = decode([f], `${DIR}/${info.project.name}-v2-around.csv`, ["--around", String(t - 2 * 3600_000)]);
	save(`${info.project.name}-timecode-v2-around`, r);
	expect(r.qr).toBe("");
	expect(r.status).toBe("ok");
	expect(r.t_ms).toBe(t);
	expect(r.n_t).toBe(Math.floor(t / hold));
	expect(r.n).toBe(Math.floor(t / hold));
	expect(r.t_lo_ms!).toBeLessThanOrEqual(t);
	expect(r.t_hi_ms!).toBeGreaterThan(t);
});

test("未同期の値がにじんだフレームには、時刻の範囲を付けない（端末の時計を正しい時刻として返さない、Codex の再現）", async ({ page }, info) => {
	await open(page);
	const hold = await page.evaluate(() => window.__timecode.hold());
	const base = Math.floor(1_760_000_000_000 / hold) * hold;
	// 時刻源が全部止まり、端末の時計が60秒進んでいる。未同期の行0は補正前の端末の時計 floor(at / hold)
	const device = base + 60_000;
	const dir = `${DIR}/unsynced-${info.project.name}`;
	mkdirSync(dir, { recursive: true });
	await page.evaluate(
		({ device, hold }) => {
			const strip = document.querySelector<HTMLCanvasElement>("#timecode .tc-strip")!;
			const ctx = strip.getContext("2d")!;
			const imgs = [0, 1].map((k) => {
				window.__timecode.renderAt(null, 1, { n: 1, t: null }, 2, device + k * hold + 3);
				return ctx.getImageData(0, 0, strip.width, strip.height);
			});
			const out = imgs[0];
			for (let p = 0; p < out.data.length; p++) out.data[p] = Math.round((imgs[0].data[p] + imgs[1].data[p]) / 2);
			ctx.putImageData(out, 0, 0);
		},
		{ device, hold },
	);
	await page.screenshot({ path: `${dir}/00.png` });
	// 同期できたあとの、正しい QR アンカー
	await page.evaluate((base) => window.__timecode.renderAt(base + 500, 50, { n: 50, t: base + 500 }), base);
	await page.screenshot({ path: `${dir}/01.png` });
	const video = `${DIR}/${info.project.name}-unsynced.mkv`;
	execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-y", "-framerate", "10", "-i", `${dir}/%02d.png`, "-c:v", "ffv1", "-pix_fmt", "gray", video]);
	const results = [];
	for (const [name, extra] of [
		["no-around", ["--qr-every", "1"]],
		["around", ["--qr-every", "1", "--around", String(base)]],
	] as const) {
		const rows = decode([video], `${DIR}/${info.project.name}-unsynced-${name}.csv`, [...extra]);
		results.push({ name, rows: rows.map((r) => ({ status: r.status, n: r.n, n_hi: r.n_hi, t: r.t_ms, t_lo: r.t_lo_ms, t_hi: r.t_hi_ms, t_est: r.t_est_ms, qr: r.qr })) });
		const [smear, valid] = rows;
		expect(smear.qr).toMatch(/ T- /);
		expect(smear.status, name).toBe("unsynced");
		expect(smear.t_ms).toBeNull();
		expect(smear.t_lo_ms).toBeNull();
		expect(smear.t_hi_ms).toBeNull();
		expect(smear.t_est_ms).toBeNull();
		expect(valid.status).toBe("ok");
		expect(valid.t_ms).toBe(base + 500);
	}
	save(`${info.project.name}-timecode-unsynced`, results);
});

test("決まった時刻の列で描くと、保持時間の区切りごとに1回だけ描き直し、描画が止まったときだけ区切りを飛ばす", async ({ page }, info) => {
	await open(page);
	const hold = await page.evaluate(() => window.__timecode.hold());
	const base = Math.floor(1_760_000_000_000 / hold) * hold;
	const frame = 1000 / 120;
	const steady = Array.from({ length: 240 }, (_, k) => base + 1 + k * frame);
	// 途中で 250ms 止まる（保持時間の区切りを2つ以上またぐ）
	const stalled = [...steady.slice(0, 50), ...steady.slice(80)];
	const r = await page.evaluate(({ steady, stalled, frame }) => ({ steady: window.__timecode.drive(steady, frame), stalled: window.__timecode.drive(stalled, frame) }), { steady, stalled, frame });
	const check = (log: { n: number; t: number | null }[]) => ({
		values: log.length,
		skips: log.slice(1).filter((e, i) => e.n !== log[i].n + 1).map((e, i) => ({ to: e.n, gapMs: e.t! - log[log.indexOf(e) - 1].t! })),
		late: Math.max(...log.map((e) => e.t! - e.n * hold)),
		first: log.every((e) => Math.floor(e.t! / hold) === e.n),
	});
	const result = { steady: check(r.steady), stalled: check(r.stalled) };
	save(`${info.project.name}-timecode-drive`, result);
	// 止まらなければ、区切りを1つも飛ばさず、各値は区切りをまたいだ最初のフレーム（1フレーム以内）で描かれる
	expect(result.steady.skips).toEqual([]);
	expect(result.steady.values).toBe(Math.floor(steady.at(-1)! / hold) - Math.floor(steady[0] / hold) + 1);
	expect(result.steady.late).toBeLessThan(frame);
	expect(result.steady.first).toBe(true);
	// 止まったときは飛ばしてよいが、飛ばしたのは止まった間だけ
	expect(result.stalled.skips.length).toBeGreaterThan(0);
	for (const k of result.stalled.skips) expect(k.gapMs).toBeGreaterThan(hold);
	expect(result.stalled.first).toBe(true);
});
