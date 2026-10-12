const MINUTE_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, "0");

export function formatOffset(offsetMs: number) {
	const s = Math.round(Math.abs(offsetMs) / 1000);
	const hms = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}${s % 60 ? `:${pad(s % 60)}` : ""}`;
	return `UTC${offsetMs < 0 ? "−" : "+"}${hms}`;
}

export type DateLine = { day: string; name: string; offset: string };

export class Zone {
	private readonly parts: Intl.DateTimeFormat;
	private readonly day: Intl.DateTimeFormat;
	private readonly name: Intl.DateTimeFormat;
	private minute = Number.NaN;
	private offset = 0;
	private line: DateLine = { day: "", name: "", offset: "" };

	constructor(
		readonly id: string,
		locale: string,
	) {
		this.parts = new Intl.DateTimeFormat("en-US", {
			timeZone: id,
			hourCycle: "h23",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		});
		this.day = new Intl.DateTimeFormat(locale, { timeZone: id, dateStyle: "full" });
		this.name = new Intl.DateTimeFormat(locale, { timeZone: id, timeZoneName: "long" });
	}

	private refresh(t: number) {
		const m = Math.floor(t / MINUTE_MS);
		if (m === this.minute) return;
		this.minute = m;
		// 毎フレーム formatToParts を呼ばないのは、オフセットが変わるのは分の境目だけで、ICU の呼び出しとオブジェクト生成がフレームごとに積み重なるため
		const at = m * MINUTE_MS;
		const p: Record<string, number> = {};
		for (const { type, value } of this.parts.formatToParts(at)) p[type] = Number(value);
		this.offset = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - at;
		this.line = {
			day: this.day.format(t),
			name: this.name.formatToParts(t).find((x) => x.type === "timeZoneName")?.value ?? this.id,
			offset: formatOffset(this.offset),
		};
	}

	offsetAt(t: number) {
		this.refresh(t);
		return this.offset;
	}

	dateLine(t: number) {
		this.refresh(t);
		return this.line;
	}
}
