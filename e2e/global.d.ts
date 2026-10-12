export {};

declare global {
	interface Window {
		__clock: { now: (at?: number) => number | null; state: () => unknown; sync: () => Promise<void> };
		__bg?: { mode: "webgl" | "2d" | "off"; frameMs: number; frames: number; merges: number; pinches: number };
	}
}
