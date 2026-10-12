import { findLang, type Lang } from "../shared/i18n.ts";

export type Settings = {
	animation: boolean;
	code: boolean;
	details: boolean;
	lag: number;
	tz: string;
	lang: Lang | null;
};
export type SettingKey = keyof Settings;
type Listener<K extends SettingKey> = (value: Settings[K]) => void;

const STORAGE_KEY = "ms-clock:settings";
const LAG_LIMIT_MS = 1000;
export const OVERRIDE_PARAMS = ["tz", "min", "lag", "code"] as const;

export function isValidTimeZone(tz: unknown): tz is string {
	if (typeof tz !== "string" || !tz) return false;
	try {
		new Intl.DateTimeFormat("en", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

export function systemTimeZone() {
	try {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (isValidTimeZone(tz)) return tz;
	} catch {}
	return "UTC";
}

let zones: string[] | null = null;
export function timeZones() {
	if (zones) return zones;
	let list: string[] = [];
	try {
		list = Intl.supportedValuesOf("timeZone");
	} catch {}
	zones = [...new Set(["UTC", systemTimeZone(), ...list])].sort((a, b) => (a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b)));
	return zones;
}

// resolvedOptions().timeZone で正規化しないのは、ブラウザによっては Asia/Kathmandu を旧名の Asia/Katmandu に戻してしまうため
function canonicalTimeZone(tz: string) {
	const lower = tz.toLowerCase();
	return timeZones().find((z) => z.toLowerCase() === lower) ?? tz;
}

const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const validators: { [K in SettingKey]: (v: unknown) => Settings[K] | undefined } = {
	animation: bool,
	code: bool,
	details: bool,
	lag: (v) => (typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, -LAG_LIMIT_MS), LAG_LIMIT_MS) : undefined),
	tz: (v) => (isValidTimeZone(v) ? canonicalTimeZone(v) : undefined),
	lang: (v) => (v === null ? null : typeof v === "string" ? (findLang(v) ?? undefined) : undefined),
};
const KEYS = Object.keys(validators) as SettingKey[];

function sanitize(o: unknown): Partial<Settings> {
	const out: Partial<Record<SettingKey, unknown>> = {};
	if (typeof o !== "object" || o === null) return {};
	for (const k of KEYS) {
		if (!(k in o)) continue;
		const v = validators[k]((o as Record<string, unknown>)[k]);
		if (v !== undefined) out[k] = v;
	}
	return out as Partial<Settings>;
}

function load(): Partial<Settings> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? sanitize(JSON.parse(raw)) : {};
	} catch {
		return {};
	}
}

function persist() {
	try {
		if (Object.keys(stored).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {}
}

function media(query: string) {
	try {
		return matchMedia(query);
	} catch {
		return null;
	}
}
const reducedMotion = media("(prefers-reduced-motion: reduce)");

function defaults(): Settings {
	return { animation: !reducedMotion?.matches, code: false, details: true, lag: 0, tz: systemTimeZone(), lang: null };
}

function fromUrl(): Partial<Settings> {
	const params = new URLSearchParams(location.search);
	const out: Partial<Settings> = {};
	if (params.has("min")) out.details = false;
	const lag = params.get("lag");
	if (lag !== null) {
		const v = validators.lag(Number(lag));
		if (v !== undefined) out.lag = v;
	}
	const code = params.get("code");
	if (code === "1" || code === "0") out.code = code === "1";
	const tz = params.get("tz");
	if (tz !== null) {
		const v = validators.tz(tz);
		if (v !== undefined) out.tz = v;
	}
	return out;
}

let stored = load();
let overrides = fromUrl();
const listeners = new Map<SettingKey, Set<Listener<SettingKey>>>();

function effective(): Settings {
	return { ...defaults(), ...stored, ...overrides };
}
let current = effective();

function notify() {
	const prev = current;
	current = effective();
	for (const k of KEYS) {
		if (Object.is(prev[k], current[k])) continue;
		for (const fn of listeners.get(k) ?? []) fn(current[k]);
	}
}

reducedMotion?.addEventListener?.("change", notify);
addEventListener("storage", (e) => {
	if (e.key !== STORAGE_KEY && e.key !== null) return;
	stored = load();
	notify();
});

export const settings = {
	get<K extends SettingKey>(key: K): Settings[K] {
		return current[key];
	},
	isExplicit(key: SettingKey) {
		return key in stored || key in overrides;
	},
	set<K extends SettingKey>(key: K, value: Settings[K]) {
		const v = validators[key](value);
		if (v === undefined) return false;
		delete overrides[key];
		(stored as Record<SettingKey, unknown>)[key] = v;
		persist();
		notify();
		return true;
	},
	// 登録時に現在値で一度呼ばないのは、初期化と変更で処理が違う利用者もいるため。初期値は get で取る
	subscribe<K extends SettingKey>(key: K, fn: Listener<K>) {
		let set = listeners.get(key);
		if (!set) listeners.set(key, (set = new Set()));
		set.add(fn as Listener<SettingKey>);
		return () => void set.delete(fn as Listener<SettingKey>);
	},
	reset() {
		stored = {};
		overrides = {};
		persist();
		notify();
	},
};
