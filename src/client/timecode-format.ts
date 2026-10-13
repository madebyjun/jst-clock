// 時刻帯の符号。ページ（描画）と tools/decode-timecode.ts（読み取り）で共有する。形式は docs/timecode.md

/** 白枠を含むモジュール数 */
export const COLS = 36;
export const ROWS = 6;
/** 白枠の外側の黒い静寂域（モジュール） */
export const QUIET = 2;
export const DATA_ROWS = 4;
export const BITS_PER_ROW = 16;
export const T_BITS = 28;
export const T_WRAP = 2 ** T_BITS;
export const N_WRAP = 2 ** 16;

export const FLAG_SYNCED = 0b1000;
export const FLAG_VERIFIED = 0b0100;
export const FLAG_SLEWING = 0b0010;
export const FLAG_VERSION = 0b0001;

export type StripFrame = { n: number; t: number | null; verified: boolean; slewing: boolean };

export const gray = (n: number) => (n ^ (n >>> 1)) & 0xffff;

export function ungray(g: number) {
	let n = g & 0xffff;
	for (let s = 1; s < 16; s <<= 1) n ^= n >>> s;
	return n & 0xffff;
}

/** CRC-16/CCITT-FALSE */
export function crc16(words: number[]) {
	let crc = 0xffff;
	for (const w of words) {
		for (const byte of [(w >>> 8) & 0xff, w & 0xff]) {
			crc ^= byte << 8;
			for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
		}
	}
	return crc;
}

export const mod = (a: number, m: number) => ((a % m) + m) % m;

/** 4行ぶんの16ビット語 */
export function packRows(f: StripFrame): number[] {
	const g = gray(mod(f.n, N_WRAP));
	const tl = f.t === null ? 0 : mod(Math.floor(f.t), T_WRAP);
	const flags = (f.t === null ? 0 : FLAG_SYNCED) | (f.verified ? FLAG_VERIFIED : 0) | (f.slewing ? FLAG_SLEWING : 0);
	const r1 = Math.floor(tl / 4096);
	const r2 = ((tl % 4096) << 4) | flags;
	return [g, r1, r2, crc16([g, r1, r2])];
}

/** モジュールの白黒（true が白）。[行][列]、白枠を含む */
export function modules(words: number[]): boolean[][] {
	const grid = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1));
	for (let r = 0; r < DATA_ROWS; r++) {
		const row = grid[r + 1];
		row[1] = true;
		row[2] = false;
		for (let i = 0; i < BITS_PER_ROW; i++) {
			const bit = ((words[r] >>> (BITS_PER_ROW - 1 - i)) & 1) === 1;
			row[3 + 2 * i] = bit;
			row[4 + 2 * i] = !bit;
		}
	}
	return grid;
}

// ---- v2：値を保持時間ごとにだけ変える。行0は時刻の目盛り q = floor(t0 / hold) のグレイコード

export const HOLDS = [25, 50, 100, 200] as const;
export type Hold = (typeof HOLDS)[number];
export const T2_WRAP = 2 ** 26;

export type HeldFrame = { t0: number | null; q: number; hold: Hold; verified: boolean; slewing: boolean };

export function packRowsV2(f: HeldFrame): number[] {
	const g = gray(mod(f.q, N_WRAP));
	const tl = f.t0 === null ? 0 : mod(Math.floor(f.t0), T2_WRAP);
	const flags = ((f.t0 === null ? 0 : 1) << 2) | ((f.verified ? 1 : 0) << 1) | (f.slewing ? 1 : 0);
	const r1 = Math.floor(tl / 1024);
	const r2 = ((tl % 1024) << 6) | (HOLDS.indexOf(f.hold) << 4) | (flags << 1) | FLAG_VERSION;
	return [g, r1, r2, crc16([g, r1, r2])];
}

export function unpackRowV2(r1: number, r2: number) {
	return {
		t26: r1 * 1024 + (r2 >>> 6),
		hold: HOLDS[(r2 >>> 4) & 3],
		synced: ((r2 >>> 3) & 1) === 1,
		verified: ((r2 >>> 2) & 1) === 1,
		slewing: ((r2 >>> 1) & 1) === 1,
	};
}
