export const LANGS = [
	{ tag: "en", name: "English" },
	{ tag: "ja", name: "日本語" },
	{ tag: "zh-CN", name: "简体中文" },
	{ tag: "zh-TW", name: "繁體中文" },
	{ tag: "ko", name: "한국어" },
	{ tag: "es", name: "Español" },
	{ tag: "fr", name: "Français" },
	{ tag: "de", name: "Deutsch" },
	{ tag: "it", name: "Italiano" },
	{ tag: "pt-BR", name: "Português (Brasil)" },
	{ tag: "pt-PT", name: "Português (Portugal)" },
	{ tag: "ru", name: "Русский" },
	{ tag: "uk", name: "Українська" },
	{ tag: "pl", name: "Polski" },
	{ tag: "nl", name: "Nederlands" },
	{ tag: "sv", name: "Svenska" },
	{ tag: "da", name: "Dansk" },
	{ tag: "nb", name: "Norsk bokmål" },
	{ tag: "fi", name: "Suomi" },
	{ tag: "cs", name: "Čeština" },
	{ tag: "sk", name: "Slovenčina" },
	{ tag: "hu", name: "Magyar" },
	{ tag: "ro", name: "Română" },
	{ tag: "bg", name: "Български" },
	{ tag: "el", name: "Ελληνικά" },
	{ tag: "tr", name: "Türkçe" },
	{ tag: "id", name: "Bahasa Indonesia" },
	{ tag: "vi", name: "Tiếng Việt" },
	{ tag: "th", name: "ไทย" },
	{ tag: "hi", name: "हिन्दी" },
	{ tag: "bn", name: "বাংলা" },
	{ tag: "ar", name: "العربية", rtl: true },
	{ tag: "he", name: "עברית", rtl: true },
	{ tag: "fa", name: "فارسی", rtl: true },
	{ tag: "ur", name: "اردو", rtl: true },
] as const satisfies readonly { tag: string; name: string; rtl?: boolean }[];

export type Lang = (typeof LANGS)[number]["tag"];
export const DEFAULT_LANG: Lang = "en";

const byLower = new Map<string, Lang>(LANGS.map((l) => [l.tag.toLowerCase(), l.tag]));

export function findLang(tag: string): Lang | null {
	return byLower.get(tag.toLowerCase()) ?? null;
}

export function dirOf(lang: Lang): "rtl" | "ltr" {
	return LANGS.some((l) => l.tag === lang && "rtl" in l) ? "rtl" : "ltr";
}

export const langPath = (lang: Lang) => `/${lang}/`;

const ALIASES: Record<string, Lang> = {
	"zh-hant": "zh-TW",
	"zh-hk": "zh-TW",
	"zh-mo": "zh-TW",
	zh: "zh-CN",
	pt: "pt-BR",
	no: "nb",
	nn: "nb",
	iw: "he",
	in: "id",
};

export function matchLang(prefs: readonly string[]): Lang {
	for (const pref of prefs) {
		const parts = pref.toLowerCase().split(/[-_]/);
		for (let n = parts.length; n >= 1; n--) {
			const key = parts.slice(0, n).join("-");
			const hit = byLower.get(key) ?? ALIASES[key];
			if (hit) return hit;
		}
	}
	return DEFAULT_LANG;
}

export const I18N_ATTRS = {
	"data-i18n-label": "aria-label",
	"data-i18n-placeholder": "placeholder",
	"data-i18n-content": "content",
} as const;

export function format(template: string, vars: Record<string, string | number> = {}) {
	return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function placeholders(template: string) {
	return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
