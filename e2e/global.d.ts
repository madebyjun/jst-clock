export {};

declare global {
	interface Window {
		__clock: { now: (at?: number) => number | null; state: () => unknown; sync: () => Promise<void> };
		__bg?: { state: () => unknown };
	}
}
