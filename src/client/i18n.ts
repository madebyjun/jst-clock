import { PRODUCT_NAME } from "../shared/brand.ts";
import { DEFAULT_LANG, findLang, format, I18N_ATTRS, type Lang, langPath, matchLang } from "../shared/i18n.ts";
import en, { type MessageKey, type Messages } from "../shared/messages/en.ts";
import { settings } from "./settings.ts";

function injected(): Partial<Messages> {
	try {
		return JSON.parse(document.getElementById("i18n")?.textContent || "{}");
	} catch {
		return {};
	}
}

export const lang: Lang = findLang(document.documentElement.lang) ?? DEFAULT_LANG;
const messages: Messages = { ...en, ...injected() };

export function msg(key: MessageKey, vars: Record<string, string | number> = {}) {
	return format(messages[key] ?? en[key], { name: PRODUCT_NAME, ...vars });
}

export function applyStatic(root: ParentNode = document) {
	for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) el.textContent = msg(el.dataset.i18n as MessageKey);
	for (const [data, attr] of Object.entries(I18N_ATTRS)) {
		for (const el of root.querySelectorAll(`[${data}]`)) el.setAttribute(attr, msg(el.getAttribute(data) as MessageKey));
	}
}

export const browserLang = () => matchLang(navigator.languages?.length ? navigator.languages : [navigator.language]);

export function pathFor(target: Lang, search = location.search) {
	return `${target === DEFAULT_LANG && !settings.get("lang") ? "/" : langPath(target)}${search}${location.hash}`;
}

function redirect() {
	if (location.pathname !== "/") return false;
	const target = settings.get("lang") ?? browserLang();
	if (target === lang) return false;
	location.replace(pathFor(target));
	return true;
}

export const redirecting = redirect();
