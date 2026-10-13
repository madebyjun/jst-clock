export {};

declare global {
	interface Window {
		__clock: { now: (at?: number) => number | null; state: () => unknown; sync: () => Promise<void> };
		__bg?: {
			state: () => { mode: string; steps: number; renders: number };
			stats: () => { mode: string; meanLum: number; maxLum: number; hash: number; frameMs: number; simW?: number; simH?: number; steps?: number; simTime?: number; renderer?: string };
			bench: (n: number) => number | null;
		};
		__timecode: {
			renderAt: (t: number | null, n: number, anchor?: { n: number; t: number | null }, format?: 1 | 2, at?: number) => void;
			hold: () => number;
			drive: (times: number[], frameMs: number) => { n: number; t: number | null }[];
			live: () => void;
			log: () => { n: number; t: number | null }[];
			qr: () => string | null;
			enabled: () => boolean;
		};
	}
}
