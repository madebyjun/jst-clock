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
