export {};

declare global {
	interface Window {
		__clock: { now: (at?: number) => number | null; state: () => unknown; sync: () => Promise<void> };
		__bg?: {
			stats: () => { mode: string; meanLum: number; maxLum: number; hash: number; frameMs: number; simW?: number; simH?: number; steps?: number; simTime?: number; renderer?: string };
			bench: (n: number) => number | null;
		};
	}
}
