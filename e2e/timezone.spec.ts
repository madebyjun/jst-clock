import { expect, type Page, test } from "@playwright/test";
import { mockSources, type Offsets, save, shot, waitRounds } from "./helpers.ts";

test.use({ locale: "en-US", timezoneId: "Asia/Tokyo" });

const hms = (tz: string, t: number) =>
	new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(t);

// ページと同じ formatToParts からの逆算で基準を作らないのは、同じ誤りを試験側でも再現して見逃すため
function offsetLabel(tz: string, t: number) {
	const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(t).find((p) => p.type === "timeZoneName")!.value;
	const m = /^GMT(?:([+-])(\d\d):(\d\d))?$/.exec(name)!;
	return m[1] ? `UTC${m[1] === "-" ? "−" : "+"}${m[2]}:${m[3]}` : "UTC+00:00";
}

type Sample = { text: string; t: number; offset: string };

async function sample(page: Page, n: number, everyMs: number): Promise<Sample[]> {
	return page.evaluate(
		async ({ n, everyMs }) => {
			const out: { text: string; t: number; offset: string }[] = [];
			for (let i = 0; i < n; i++) {
				await new Promise((r) => requestAnimationFrame(r));
				out.push({
					text: document.getElementById("time")!.textContent!,
					t: window.__clock.now(performance.timeOrigin + performance.now())!,
					offset: document.getElementById("date-offset")!.textContent!,
				});
				await new Promise((r) => setTimeout(r, everyMs));
			}
			return out;
		},
		{ n, everyMs },
	);
}

// 読んだ瞬間ちょうどの時刻とだけ比べないのは、表示が次のフレームの表示時刻（描画補正込み）を描いているため
function check(tz: string, samples: Sample[]) {
	return samples.map((s) => {
		const shown = s.text.slice(0, 8);
		const candidates = [-150, 0, 150].map((d) => hms(tz, s.t + d));
		const offsets = [-150, 0, 150].map((d) => offsetLabel(tz, s.t + d));
		return { ...s, shown, expected: hms(tz, s.t), ok: candidates.includes(shown) && offsets.includes(s.offset) };
	});
}

async function setTimeZone(page: Page, tz: string) {
	const input = page.locator("#tz");
	await input.fill(tz);
	await input.press("Enter");
	await expect(page.locator("body")).toHaveAttribute("data-tz", tz);
}

test("タイムゾーンを切り替えると、その地域の時刻と UTC オフセットを表示する", async ({ page }) => {
	await mockSources(page, { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 });
	await page.goto("/en/");
	await waitRounds(page, 1);
	const results: Record<string, ReturnType<typeof check>> = {};
	for (const tz of ["Asia/Tokyo", "America/New_York", "Asia/Kathmandu", "Australia/Lord_Howe", "UTC"]) {
		await setTimeZone(page, tz);
		results[tz] = check(tz, await sample(page, 5, 120));
		expect(results[tz].every((r) => r.ok), JSON.stringify(results[tz])).toBe(true);
	}
	await setTimeZone(page, "Asia/Kathmandu");
	await shot(page, "tz-kathmandu");
	save(`${test.info().project.name}-tz-switch`, results);
});

for (const c of [
	{ name: "spring-forward", at: Date.UTC(2026, 2, 8, 7), before: "01:59:5", after: "03:00:0", offsets: ["UTC−05:00", "UTC−04:00"] },
	{ name: "fall-back", at: Date.UTC(2026, 10, 1, 6), before: "01:59:5", after: "01:00:0", offsets: ["UTC−04:00", "UTC−05:00"] },
]) {
	test(`夏時間の切り替わり（America/New_York ${c.name}）をまたいでも、試験側で求めた時刻と一致する`, async ({ page }) => {
		const tz = "America/New_York";
		const start = Date.now();
		const leadMs = 6_000;
		const truth = (now: number) => c.at - leadMs + (now - start);
		const o: Offsets = { edge: truth, akamai: truth, nict: truth, timeapi: truth, timenow: truth };
		await mockSources(page, o);
		await page.goto(`/en/?tz=${tz}`);
		await waitRounds(page, 1);
		const samples = check(tz, await sample(page, Math.ceil((start + leadMs + 3_000 - Date.now()) / 200), 200));
		const shown = samples.map((s) => s.shown);
		expect(samples.every((s) => s.ok), JSON.stringify(samples)).toBe(true);
		expect(shown.some((s) => s.startsWith(c.before))).toBe(true);
		expect(shown.some((s) => s.startsWith(c.after))).toBe(true);
		expect(new Set(samples.map((s) => s.offset))).toEqual(new Set(c.offsets));
		save(`${test.info().project.name}-tz-dst-${c.name}`, { transition: new Date(c.at).toISOString(), samples });
	});
}

test("存在しないタイムゾーンを URL で渡しても、例外を出さず端末のタイムゾーンで表示する", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await mockSources(page, { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 });
	await page.goto("/en/?tz=Invalid/Zone");
	await waitRounds(page, 1);
	await expect(page.locator("body")).toHaveAttribute("data-synced", "true");
	await expect(page.locator("#tz")).toHaveValue("Asia/Tokyo");
	const samples = check("Asia/Tokyo", await sample(page, 3, 100));
	expect(samples.every((s) => s.ok), JSON.stringify(samples)).toBe(true);

	await page.locator("#tz").fill("Not/AZone");
	await page.locator("#tz").press("Enter");
	await expect(page.locator("#tz")).toHaveValue("Asia/Tokyo");
	expect(errors).toEqual([]);
	save(`${test.info().project.name}-tz-invalid`, { samples, errors });
});
