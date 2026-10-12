import { expect, type Page, test } from "@playwright/test";
import { mockSources, save, waitRounds } from "./helpers.ts";

const STORAGE_KEY = "ms-clock:settings";
const ALL_OK = { edge: 0, akamai: 0, nict: 0, timeapi: 0, timenow: 0 };

test.use({ locale: "en-US", timezoneId: "Asia/Tokyo" });

async function view(page: Page) {
	return page.evaluate((key) => {
		const box = (n: string) => (document.querySelector(`#settings [name="${n}"]`) as HTMLInputElement).checked;
		let stored: string | null = null;
		try {
			stored = localStorage.getItem(key);
		} catch {}
		return {
			path: location.pathname,
			search: location.search,
			lang: document.documentElement.lang,
			animation: document.documentElement.dataset.animation,
			min: document.body.classList.contains("min"),
			tz: (document.getElementById("tz") as HTMLInputElement).value,
			shownTz: document.body.dataset.tz,
			frame: document.getElementById("frame")!.textContent,
			boxes: { animation: box("animation"), code: box("code"), details: box("details") },
			lag: (document.querySelector('#settings [name="lag"]') as HTMLInputElement).value,
			stored,
		};
	}, STORAGE_KEY);
}

async function setTimeZone(page: Page, tz: string) {
	const input = page.locator("#tz");
	await input.fill(tz);
	await input.press("Enter");
	await expect(page.locator("body")).toHaveAttribute("data-tz", tz);
}

test("設定はキーボードで開閉でき、再読み込み後も残り、リセットで端末の既定に戻る", async ({ page }) => {
	await mockSources(page, ALL_OK);
	await page.goto("/ja/");
	await waitRounds(page, 1);
	const initial = await view(page);

	await page.locator("#open-settings").focus();
	await page.keyboard.press("Enter");
	const dialog = page.locator("#settings");
	await expect(dialog).toBeVisible();
	await dialog.locator('[name="animation"]').uncheck();
	await dialog.locator('[name="code"]').check();
	await dialog.locator('[name="details"]').uncheck();
	await dialog.locator('[name="lag"]').fill("25");
	await dialog.locator('[name="lag"]').press("Tab");
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(page.locator("#open-settings")).toBeFocused();
	await setTimeZone(page, "America/New_York");

	await page.reload();
	await waitRounds(page, 1);
	await expect(page.locator("#frame")).toContainText("+ 25 ms");
	const persisted = await view(page);
	expect(persisted).toMatchObject({
		path: "/ja/",
		animation: "off",
		min: true,
		tz: "America/New_York",
		shownTz: "America/New_York",
		boxes: { animation: false, code: true, details: false },
		lag: "25",
	});
	expect(JSON.parse(persisted.stored!)).toEqual({ animation: false, code: true, details: false, lag: 25, tz: "America/New_York" });

	await page.locator("#open-settings").click();
	await Promise.all([page.waitForURL((u) => u.pathname === "/"), page.locator("#reset").click()]);
	await waitRounds(page, 1);
	const reset = await view(page);
	expect(reset).toMatchObject({
		path: "/",
		lang: "en",
		animation: "on",
		min: false,
		tz: "Asia/Tokyo",
		shownTz: "Asia/Tokyo",
		boxes: { animation: true, code: false, details: true },
		lag: "0",
		stored: null,
	});
	expect(reset.frame).not.toContain("+");
	save(`${test.info().project.name}-settings-persist-reset`, { initial, persisted, reset });
});

test("URLの指定はその表示だけに効き、保存されない", async ({ page }) => {
	await mockSources(page, ALL_OK);
	await page.goto("/en/?min&lag=40&tz=Asia/Kathmandu");
	await waitRounds(page, 1);
	const withParams = await view(page);
	expect(withParams).toMatchObject({ min: true, tz: "Asia/Kathmandu", shownTz: "Asia/Kathmandu", stored: null });
	expect(withParams.frame).toContain("+ 40 ms");
	await page.goto("/en/");
	await waitRounds(page, 1);
	const without = await view(page);
	expect(without).toMatchObject({ min: false, tz: "Asia/Tokyo", stored: null });
	save(`${test.info().project.name}-settings-url-overrides`, { withParams, without });
});

test("動きを減らす設定の端末ではアニメーションが既定で切れ、OSの設定変更にも追従する", async ({ page }) => {
	await mockSources(page, ALL_OK);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/en/");
	await waitRounds(page, 1);
	const reduced = await view(page);
	expect(reduced.animation).toBe("off");
	expect(reduced.boxes.animation).toBe(false);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await expect(page.locator("html")).toHaveAttribute("data-animation", "on");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(page.locator("html")).toHaveAttribute("data-animation", "off");
	await page.locator("#open-settings").click();
	await page.locator('#settings [name="animation"]').check();
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-animation", "on");
	save(`${test.info().project.name}-settings-reduced-motion`, { reduced, explicitOnAfterReload: "on" });
});

test("保存領域が使えなくても時計は動き、その場の設定変更も効く", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await page.addInitScript(() => {
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new DOMException("blocked", "SecurityError");
			},
		});
	});
	await mockSources(page, ALL_OK);
	await page.goto("/en/");
	await waitRounds(page, 1);
	await expect(page.locator("body")).toHaveAttribute("data-synced", "true");
	await page.locator("#open-settings").click();
	await page.locator('#settings [name="details"]').uncheck();
	await expect(page.locator("body")).toHaveClass(/\bmin\b/);
	await page.keyboard.press("Escape");
	await setTimeZone(page, "Europe/London");
	expect(errors).toEqual([]);
	save(`${test.info().project.name}-settings-storage-blocked`, { errors, view: await view(page) });
});

test("保存された値が壊れていても、壊れた項目だけ既定値に戻る", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await page.addInitScript((key) => {
		localStorage.setItem(key, JSON.stringify({ tz: "Mars/Olympus_Mons", lag: "abc", details: false, lang: "xx" }));
	}, STORAGE_KEY);
	await mockSources(page, ALL_OK);
	await page.goto("/en/");
	await waitRounds(page, 1);
	const v = await view(page);
	expect(v).toMatchObject({ tz: "Asia/Tokyo", shownTz: "Asia/Tokyo", min: true, lag: "0" });
	expect(errors).toEqual([]);
	save(`${test.info().project.name}-settings-corrupt`, v);
});
