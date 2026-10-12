export {};

declare global {
	interface Window {
		__clock: { now: (at?: number) => number | null; state: () => unknown; sync: () => Promise<void> };
		__timecode: {
			renderAt: (t: number | null, n: number, anchor?: { n: number; t: number | null }) => void;
			live: () => void;
			log: () => { n: number; t: number | null }[];
			qr: () => string | null;
			enabled: () => boolean;
		};
	}
}
