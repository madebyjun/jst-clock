import { LANGS, type Lang, langPath } from "../shared/i18n.ts";
import { browserLang, lang, pathFor } from "./i18n.ts";
import { OVERRIDE_PARAMS, type SettingKey, settings, timeZones } from "./settings.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function setupTimeZone() {
	const input = $<HTMLInputElement>("tz");
	const list = $<HTMLDataListElement>("tz-list");
	const zones = timeZones();
	const known = new Set(zones);
	list.replaceChildren(
		...zones.map((z) => {
			const o = document.createElement("option");
			o.value = z;
			return o;
		}),
	);
	const show = () => {
		input.value = settings.get("tz");
	};
	show();
	settings.subscribe("tz", show);
	input.addEventListener("focus", () => input.select());
	input.addEventListener("input", () => {
		if (known.has(input.value)) settings.set("tz", input.value);
	});
	input.addEventListener("change", () => {
		const v = input.value.trim();
		if (v === settings.get("tz") || !settings.set("tz", v)) show();
	});
	input.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			show();
			input.blur();
		}
	});
}

function setupLanguage() {
	const select = $<HTMLSelectElement>("lang");
	select.replaceChildren(
		...LANGS.map((l) => {
			const o = document.createElement("option");
			o.value = l.tag;
			o.lang = l.tag;
			o.textContent = l.name;
			return o;
		}),
	);
	select.value = lang;
	select.addEventListener("change", () => {
		const target = select.value as Lang;
		settings.set("lang", target);
		location.assign(`${langPath(target)}${location.search}${location.hash}`);
	});
}

function setupPanel() {
	const dialog = $<HTMLDialogElement>("settings");
	const form = dialog.querySelector("form")!;
	const boxes = ["animation", "code", "details"] as const;
	const lag = form.elements.namedItem("lag") as HTMLInputElement;
	const sync = () => {
		for (const k of boxes) (form.elements.namedItem(k) as HTMLInputElement).checked = settings.get(k);
		lag.value = String(settings.get("lag"));
	};
	sync();
	for (const k of [...boxes, "lag"] satisfies SettingKey[]) settings.subscribe(k, sync);
	for (const k of boxes) {
		const box = form.elements.namedItem(k) as HTMLInputElement;
		box.addEventListener("change", () => settings.set(k, box.checked));
	}
	lag.addEventListener("change", () => {
		if (lag.value === "" || !settings.set("lag", Number(lag.value))) sync();
	});
	$("open-settings").addEventListener("click", () => {
		sync();
		dialog.showModal();
	});
	$("reset").addEventListener("click", () => {
		settings.reset();
		const params = new URLSearchParams(location.search);
		for (const p of OVERRIDE_PARAMS) params.delete(p);
		const search = params.toString() ? `?${params}` : "";
		const target = browserLang();
		if (target !== lang) {
			location.assign(pathFor(target, search));
			return;
		}
		history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
		sync();
	});
}

export function setupControls() {
	setupTimeZone();
	setupLanguage();
	setupPanel();
}
