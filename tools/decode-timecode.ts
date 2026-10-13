// 撮影した映像（または画像）から時刻帯とQRを読み、フレームごとの CSV を出す。形式は docs/timecode.md
//   node tools/decode-timecode.ts <映像|画像...> [--out out.csv] [--corners x,y,x,y,x,y,x,y] [--around ISO|ms] [--qr-every n]
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import jsQR from "jsqr";
import {
	BITS_PER_ROW,
	COLS,
	crc16,
	DATA_ROWS,
	FLAG_SLEWING,
	FLAG_SYNCED,
	FLAG_VERIFIED,
	FLAG_VERSION,
	gray,
	HOLDS,
	mod,
	N_WRAP,
	ROWS,
	T_WRAP,
	T2_WRAP,
	ungray,
	unpackRowV2,
} from "../src/client/timecode-format.ts";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
/** これより差の小さい組は、どちらとも決めない */
const AMBIGUOUS = 0.25;
/** 全振幅（基準セルの白黒の差）に対してこれより小さい組は、2つ以上のフレームが混ざったビット */
const MIXED = 0.6;
const MIN_CONTRAST = 24;
/** 行0でこれより多くのビットが中間なら、範囲も出さない（候補が 2^4 = 16 を超えると幅が広すぎて使えない） */
const MAX_MIXED_BITS = 4;
const QR_BEFORE_MS = 100;
const QR_AFTER_MS = 2000;
const RELOCATE_COOLDOWN = 4;

type Gray8 = { w: number; h: number; data: Uint8Array };
type Quad = [number, number][];

export type Row = {
	frame: number;
	pts: number | null;
	status: "ok" | "mixed" | "range" | "torn" | "multi" | "inconsistent" | "unsynced" | "lowcontrast" | "nocode";
	format: 1 | 2 | null;
	hold: number | null;
	n16: number | null;
	n16hi: number | null;
	frac: number | null;
	nT16: number | null;
	tRaw: number | null;
	synced: boolean | null;
	verified: boolean | null;
	slewing: boolean | null;
	qr: string | null;
	n?: number | null;
	nHi?: number | null;
	nT?: number | null;
	t?: number | null;
	tLo?: number | null;
	tHi?: number | null;
	tEst?: number | null;
};

const EMPTY = { format: null, hold: null, n16: null, n16hi: null, frac: null, nT16: null, tRaw: null, synced: null, verified: null, slewing: null } as const;

// ---- 幾何

function homography(src: Quad, dst: Quad) {
	const a: number[][] = [];
	const b: number[] = [];
	for (let i = 0; i < 4; i++) {
		const [x, y] = src[i];
		const [u, v] = dst[i];
		a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
		b.push(u);
		a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
		b.push(v);
	}
	for (let c = 0; c < 8; c++) {
		let p = c;
		for (let r = c + 1; r < 8; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
		[a[c], a[p]] = [a[p], a[c]];
		[b[c], b[p]] = [b[p], b[c]];
		for (let r = 0; r < 8; r++) {
			if (r === c) continue;
			const f = a[r][c] / a[c][c];
			for (let k = c; k < 8; k++) a[r][k] -= f * a[c][k];
			b[r] -= f * b[c];
		}
	}
	const h = b.map((v, i) => v / a[i][i]);
	return (x: number, y: number): [number, number] => {
		const w = h[6] * x + h[7] * y + 1;
		return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
	};
}

function bilinear(img: Gray8, x: number, y: number) {
	const x0 = Math.max(0, Math.min(img.w - 2, Math.floor(x - 0.5)));
	const y0 = Math.max(0, Math.min(img.h - 2, Math.floor(y - 0.5)));
	const fx = Math.max(0, Math.min(1, x - 0.5 - x0));
	const fy = Math.max(0, Math.min(1, y - 0.5 - y0));
	const p = (xx: number, yy: number) => img.data[yy * img.w + xx];
	return (p(x0, y0) * (1 - fx) + p(x0 + 1, y0) * fx) * (1 - fy) + (p(x0, y0 + 1) * (1 - fx) + p(x0 + 1, y0 + 1) * fx) * fy;
}

/** モジュール (c, r) の中央40%の平均。縁はにじみやブルーミングで隣の色が混じるので使わない */
function cell(img: Gray8, map: (x: number, y: number) => [number, number], c: number, r: number) {
	let sum = 0;
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			const [x, y] = map(c + 0.3 + 0.2 * i, r + 0.3 + 0.2 * j);
			sum += bilinear(img, x, y);
		}
	}
	return sum / 9;
}

/** 白枠らしい明るい連結成分の四隅 */
function locate(img: Gray8): Quad[] {
	const { w, h, data } = img;
	const hist = new Array(256).fill(0);
	for (let i = 0; i < data.length; i++) hist[data[i]]++;
	const pct = (p: number) => {
		let acc = 0;
		for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= p * data.length) return v;
		return 255;
	};
	const lo = pct(0.05);
	const hi = pct(0.999);
	if (hi - lo < MIN_CONTRAST * 2) return [];
	const thr = (lo + hi) / 2;
	const seen = new Uint8Array(w * h);
	const stack = new Int32Array(w * h);
	const found: { quad: Quad; area: number }[] = [];
	for (let start = 0; start < data.length; start++) {
		if (seen[start] || data[start] < thr) continue;
		let sp = 0;
		stack[sp++] = start;
		seen[start] = 1;
		let count = 0;
		let minX = w, maxX = 0, minY = h, maxY = 0;
		let tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, Infinity];
		while (sp) {
			const i = stack[--sp];
			const x = i % w;
			const y = (i - x) / w;
			count++;
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
			if (x + y < tl[2]) tl = [x, y, x + y];
			if (x + y > br[2]) br = [x, y, x + y];
			if (x - y > tr[2]) tr = [x, y, x - y];
			if (x - y < bl[2]) bl = [x, y, x - y];
			for (const j of [i - 1, i + 1, i - w, i + w]) {
				if (j < 0 || j >= data.length || seen[j] || data[j] < thr) continue;
				if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
				seen[j] = 1;
				stack[sp++] = j;
			}
		}
		const bw = maxX - minX + 1;
		const bh = maxY - minY + 1;
		const aspect = bw / bh;
		const fill = count / (bw * bh);
		// 中まで白い矩形（進捗バーなど）は fill が1に近いので除く
		if (bw < COLS * 2 || aspect < (COLS / ROWS) * 0.75 || aspect > (COLS / ROWS) * 1.33 || fill > 0.9 || fill < 0.3) continue;
		found.push({
			quad: [
				[tl[0], tl[1]],
				[tr[0] + 1, tr[1]],
				[br[0] + 1, br[1] + 1],
				[bl[0], bl[1] + 1],
			],
			area: bw * bh,
		});
	}
	return found.sort((a, b) => b.area - a.area).map((f) => f.quad);
}

// ---- 読み取り

type Read = Omit<Row, "frame" | "pts" | "qr"> & { raw?: { contrast: number[]; d: number[][] } };

function readStrip(img: Gray8, quad: Quad, hint: Hint): Read | null {
	const map = homography(
		[
			[0, 0],
			[COLS, 0],
			[COLS, ROWS],
			[0, ROWS],
		],
		quad,
	);
	const top = Array.from({ length: COLS }, (_, c) => cell(img, map, c, 0));
	const bottom = Array.from({ length: COLS }, (_, c) => cell(img, map, c, ROWS - 1));
	const d: number[][] = [];
	const contrast: number[] = [];
	for (let r = 0; r < DATA_ROWS; r++) {
		const black = cell(img, map, 2, r + 1);
		const ref = cell(img, map, 1, r + 1) - black;
		contrast.push(ref);
		if (ref < MIN_CONTRAST) return null;
		const f = (r + 1) / (ROWS - 1);
		// 左端の基準セル1か所の白黒の差で割らないのは、横方向の明るさのむら（グレア・視野角）で変わらないビットまで中間に見えるため
		const white = (c: number) => top[c] * (1 - f) + bottom[c] * f;
		const row: number[] = [];
		for (let i = 0; i < BITS_PER_ROW; i++) {
			const cl = 3 + 2 * i;
			const local = Math.max((white(cl) + white(cl + 1)) / 2 - black, MIN_CONTRAST);
			row.push((cell(img, map, cl, r + 1) - cell(img, map, cl + 1, r + 1)) / local);
		}
		d.push(row);
	}
	return { ...decodeRows(d, hint), raw: { contrast, d } };
}

type Hint = { hold: number | null };

const word = (row: number[]) => row.reduce((w, v) => (w << 1) | (v > 0 ? 1 : 0), 0);
const bitAt = (row: number[], lsb: number) => row[BITS_PER_ROW - 1 - lsb];

/** 中間のビットを自由にした候補が1つの連続した区間（16ビットで巻き戻る）になれば、その始まりと終わり */
function grayRange(g: number, mixed: number[]): [number, number] | null {
	const values = new Set<number>();
	for (let k = 0; k < 1 << mixed.length; k++) {
		let c = g;
		for (let j = 0; j < mixed.length; j++) {
			const bit = 1 << (BITS_PER_ROW - 1 - mixed[j]);
			c = k & (1 << j) ? c | bit : c & ~bit;
		}
		values.add(ungray(c));
	}
	const start = [...values].find((v) => !values.has(mod(v - 1, N_WRAP)));
	if (start === undefined) return null;
	for (let i = 0; i < values.size; i++) if (!values.has(mod(start + i, N_WRAP))) return null;
	return [start, mod(start + values.size - 1, N_WRAP)];
}

function decodeRows(d: number[][], hint: Hint): Read {
	const vBit = bitAt(d[2], 0);
	const format: 1 | 2 | null = Math.abs(vBit) >= MIXED ? (vBit > 0 ? 2 : 1) : hint.hold !== null ? 2 : null;
	const holdBits = [bitAt(d[2], 5), bitAt(d[2], 4)];
	const hold = format === 2 ? (holdBits.every((v) => Math.abs(v) >= MIXED) ? HOLDS[(holdBits[0] > 0 ? 2 : 0) + (holdBits[1] > 0 ? 1 : 0)] : hint.hold) : null;
	const empty: Read = { ...EMPTY, status: "multi", format, hold };
	const mixed = d[0].flatMap((v, i) => (Math.abs(v) < MIXED ? [i] : []));
	if (mixed.length > MAX_MIXED_BITS) return empty;
	const g = word(d[0]);
	const span = mixed.length ? grayRange(g, mixed) : [ungray(g), ungray(g)];
	if (!span) return empty;
	const [lo, hiEnd] = span;
	const hi = mixed.length ? hiEnd : null;
	let frac: number | null = null;
	let cands = [g];
	if (mixed.length === 1) {
		const bit = 1 << (BITS_PER_ROW - 1 - mixed[0]);
		const hiBit = (gray(hiEnd) & bit) !== 0;
		const v = d[0][mixed[0]];
		frac = Math.max(0, Math.min(1, (1 + (hiBit ? v : -v)) / 2));
		cands = frac >= 0.5 ? [gray(hiEnd), gray(lo)] : [gray(lo), gray(hiEnd)];
	}
	const base: Read = { ...empty, status: "range", n16: lo, n16hi: hi, frac };
	// 中間ビットが2つ以上のときに組み合わせを試して CRC で選ばないのは、候補が増えるほど偶然の一致を防げないため
	if (mixed.length > 1 || d.slice(1).some((row) => row.some((v) => Math.abs(v) < AMBIGUOUS))) return base;
	const [r1, r2, r3] = d.slice(1).map(word);
	const match = cands.find((c) => crc16([c, r1, r2]) === r3);
	if (match === undefined) return { ...base, status: "torn" };
	const fields =
		r2 & FLAG_VERSION
			? { format: 2 as const, ...unpackRowV2(r1, r2) }
			: { format: 1 as const, t26: r1 * 4096 + (r2 >>> 4), hold: null, synced: (r2 & FLAG_SYNCED) !== 0, verified: (r2 & FLAG_VERIFIED) !== 0, slewing: (r2 & FLAG_SLEWING) !== 0 };
	return {
		...base,
		format: fields.format,
		hold: fields.hold,
		status: !fields.synced ? "unsynced" : hi === null ? "ok" : "mixed",
		nT16: ungray(match),
		tRaw: fields.synced ? fields.t26 : null,
		synced: fields.synced,
		verified: fields.verified,
		slewing: fields.slewing,
	};
}

const decoded = (r: Read) => r.status === "ok" || r.status === "mixed" || r.status === "unsynced" || r.status === "range";

function readQr(img: Gray8): string | null {
	const rgba = new Uint8ClampedArray(img.w * img.h * 4);
	for (let i = 0; i < img.data.length; i++) {
		const v = img.data[i];
		rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v;
		rgba[i * 4 + 3] = 255;
	}
	const r = jsQR(rgba, img.w, img.h, { inversionAttempts: "dontInvert" });
	return r && r.data.startsWith("JC1 ") ? r.data : null;
}

export function qrField(qr: string | null, key: string) {
	const f = qr?.split(" ").find((p) => p.startsWith(key));
	if (!f) return null;
	const v = Number(f.slice(key.length));
	return Number.isFinite(v) ? v : null;
}

// ---- 入力

function probe(file: string) {
	const entries = "stream=width,height,codec_type:stream_side_data=rotation:stream_tags=rotate:format=format_name";
	const r = spawnSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "json", file]);
	if (r.status !== 0) throw new Error(`ffprobe failed: ${file}\n${r.stderr}`);
	const j = JSON.parse(r.stdout.toString());
	const s = j.streams?.[0];
	if (!s) throw new Error(`no video stream: ${file}`);
	const image = /image2|png_pipe|jpeg_pipe|webp_pipe|bmp_pipe|tiff_pipe/.test(j.format?.format_name ?? "");
	// ffmpeg は表示用の回転（スマホの縦撮りなど）を既定で適用して出力する。-noautorotate で保存された向きのまま読まないのは、
	// --corners を利用者が再生ソフトで見たままの座標で書けるようにするため
	const rotation = Number(s.side_data_list?.find((d: { rotation?: number }) => d.rotation !== undefined)?.rotation ?? s.tags?.rotate ?? 0);
	const quarter = Math.abs(Math.round(rotation / 90)) % 2 === 1;
	return { w: (quarter ? s.height : s.width) as number, h: (quarter ? s.width : s.height) as number, image };
}

/** ffmpeg で8ビットのグレースケールに展開し、1フレームずつ渡す */
async function frames(file: string, w: number, h: number, onFrame: (img: Gray8, index: number) => void) {
	const size = w * h;
	const ff = spawn(FFMPEG, ["-v", "info", "-i", file, "-vf", "showinfo", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
	const pts: number[] = [];
	let err = "";
	ff.stderr.on("data", (b: Buffer) => {
		err += b.toString();
		const lines = err.split("\n");
		err = lines.pop()!;
		for (const l of lines) {
			const m = /showinfo.*\bn:\s*(\d+).*\bpts_time:\s*([-\d.e]+)/.exec(l);
			if (m) pts[Number(m[1])] = Number(m[2]);
		}
	});
	let buf: Buffer = Buffer.alloc(0);
	let index = 0;
	for await (const chunk of ff.stdout as AsyncIterable<Buffer>) {
		buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
		while (buf.length >= size) {
			onFrame({ w, h, data: new Uint8Array(buf.subarray(0, size)) }, index++);
			buf = buf.subarray(size);
		}
	}
	const code: number = await new Promise((r) => (ff.exitCode !== null ? r(ff.exitCode) : ff.on("close", r)));
	if (code !== 0) throw new Error(`ffmpeg failed (${code}): ${file}`);
	return pts;
}

// ---- 全体

function unwrapAround(v: number, ref: number, wrap: number) {
	return ref + mod(v - ref + wrap / 2, wrap) - wrap / 2;
}

/** 下位ビットだけの値に上位を補い、範囲を時刻に直し、最新の QR と矛盾するものを捨てる */
function finish(rows: Row[], around: number | null, sequential: boolean) {
	// 最初のQRより前のフレームも、そのQRを基準にする（映像の冒頭はQRの読み取り間隔ぶん基準がない）
	const first = (key: string) => (sequential ? (rows.map((r) => qrField(r.qr, key)).find((v) => v !== null) ?? null) : null);
	let prevN = first("N");
	let lastT = first("T");
	let seenT: number | null = null;
	let qr: string | null = null;
	for (const r of rows) {
		if (!sequential) prevN = null;
		const qrN = qrField(r.qr, "N");
		const qrT = qrField(r.qr, "T");
		if (sequential && qrT !== null) lastT = qrT;
		// 照合には、このフレームまでに実際に読めた QR だけを使う（先のフレームの QR で冒頭を補うのは上位ビットの復元のためだけ）
		const checkT = sequential ? (seenT = qrT ?? seenT) : qrT;
		const tRef = (sequential ? lastT : qrT) ?? around;
		let ref: number | null;
		if (r.format === 2) ref = tRef !== null && r.hold ? Math.floor(tRef / r.hold) : null;
		else {
			if ((!sequential || r.qr !== qr) && qrN !== null && r.n16 !== null) prevN = unwrapAround(r.n16, qrN, N_WRAP);
			ref = prevN;
		}
		qr = r.qr;
		const un = (v: number | null): number | null => (v === null ? null : ref === null ? v : unwrapAround(v, ref, N_WRAP));
		r.n = un(r.n16);
		r.nHi = r.n16hi === null || r.n == null ? null : r.n + mod(r.n16hi - r.n16!, N_WRAP);
		r.nT = un(r.nT16);
		if (r.format !== 2 && r.n != null) prevN = r.n;
		const wrap = r.format === 2 ? T2_WRAP : T_WRAP;
		r.t = r.tRaw === null || tRef === null ? null : unwrapAround(r.tRaw, tRef, wrap);
		if (r.format === 2 && r.hold && ref !== null && r.n != null && r.status !== "unsynced") {
			if (r.t != null && mod(Math.floor(r.t / r.hold), N_WRAP) !== r.nT16) r.status = "inconsistent";
			r.tLo = r.n * r.hold;
			r.tHi = ((r.nHi ?? r.n) + 1) * r.hold;
		}
		if (r.t != null) {
			r.tLo ??= r.t;
			r.tHi ??= r.t;
		}
		const lo = r.tLo ?? r.t;
		const hi = r.tHi ?? r.t;
		const slack = 2 * (r.hold ?? 0) + QR_BEFORE_MS;
		if (checkT !== null && lo != null && hi != null && (hi < checkT - slack || lo > checkT + QR_AFTER_MS)) r.status = "inconsistent";
		if (r.status === "inconsistent") r.t = r.tLo = r.tHi = null;
	}
	if (!sequential) return;
	// v1 の範囲は、前後に描かれた QR のアンカーで挟む。1回の描画間隔の下限は保証できないので、表示時刻の単調性だけを仮定する
	const anchors = [...new Map(rows.flatMap((r) => (qrField(r.qr, "N") !== null && qrField(r.qr, "T") !== null ? [[qrField(r.qr, "N")!, qrField(r.qr, "T")!] as const] : []))).entries()].sort((a, b) => a[0] - b[0]);
	for (const r of rows) {
		if (r.format === 2 || r.n == null || r.status !== "range" && r.status !== "torn") continue;
		const nHi = r.nHi ?? r.n;
		const before = anchors.findLast(([n]) => n <= r.n!);
		const after = anchors.find(([n]) => n >= nHi);
		if (!before || !after) continue;
		r.tLo = before[1];
		r.tHi = after[1];
		const mid = (r.n + nHi) / 2;
		r.tEst = after[0] === before[0] ? before[1] : before[1] + ((mid - before[0]) * (after[1] - before[1])) / (after[0] - before[0]);
	}
}

const HEADER = ["frame", "pts", "status", "format", "hold_ms", "n", "n_hi", "frac", "n_t", "t_ms", "t_iso", "t_lo_ms", "t_hi_ms", "t_raw", "t_est_ms", "synced", "verified", "slewing", "qr"];

function csv(rows: Row[]) {
	const v = (x: unknown) => (x === null || x === undefined ? "" : typeof x === "boolean" ? (x ? "1" : "0") : String(x));
	const q = (s: string) => (/[",\s]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
	return [
		HEADER.join(","),
		...rows.map((r) =>
			[
				r.frame,
				r.pts === null ? "" : r.pts.toFixed(6),
				r.status,
				r.format,
				r.hold,
				r.n,
				r.nHi,
				r.frac === null ? null : r.frac.toFixed(3),
				r.nT,
				r.t,
				r.t == null ? null : new Date(r.t).toISOString(),
				r.tLo,
				r.tHi,
				r.tRaw,
				r.tEst == null ? null : r.tEst.toFixed(1),
				r.synced,
				r.verified,
				r.slewing,
				r.qr,
			]
				.map(v)
				.map(q)
				.join(","),
		),
	].join("\n");
}

function parseArgs(argv: string[]) {
	const files: string[] = [];
	const o = { dump: null as string | null, out: null as string | null, corners: null as Quad | null, around: null as number | null, qrEvery: 5 };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--out") o.out = argv[++i];
		else if (a === "--corners") {
			const v = argv[++i].split(",").map(Number);
			if (v.length !== 8 || v.some((x) => !Number.isFinite(x))) throw new Error("--corners は x,y を左上・右上・右下・左下の順に8つ");
			o.corners = [0, 2, 4, 6].map((k) => [v[k], v[k + 1]] as [number, number]);
		} else if (a === "--around") {
			const s = argv[++i];
			o.around = /^\d+$/.test(s) ? Number(s) : Date.parse(s);
		} else if (a === "--dump") o.dump = argv[++i];
		else if (a === "--qr-every") o.qrEvery = Math.max(1, Number(argv[++i]));
		else files.push(a);
	}
	return { files, ...o };
}

export async function decode(argv: string[]) {
	const opt = parseArgs(argv);
	if (!opt.files.length) throw new Error("usage: node tools/decode-timecode.ts <video|image...> [--out out.csv] [--corners x,y,...] [--around ISO|ms] [--qr-every n]");
	const all: Row[] = [];
	if (opt.dump) writeFileSync(opt.dump, "");
	let sequential = true;
	for (const file of opt.files) {
		const { w, h, image } = probe(file);
		if (image) sequential = false;
		let quad: Quad | null = opt.corners;
		let qr: string | null = null;
		let sinceQr = Number.POSITIVE_INFINITY;
		let cooldown = 0;
		const hint = (): Hint => ({ hold: qrField(qr, "G") });
		const rows: Row[] = [];
		const pts = await frames(file, w, h, (img, index) => {
			let read: Read | null = quad ? readStrip(img, quad, hint()) : null;
			let status: Row["status"] = "nocode";
			if (!read && !opt.corners) {
				for (const q of locate(img)) {
					read = readStrip(img, q, hint());
					if (read) {
						quad = q;
						break;
					}
					status = "lowcontrast";
				}
			} else if (!read) status = "lowcontrast";
			else if (!decoded(read) && !opt.corners && cooldown-- <= 0) {
				// 混ざったフレームは位置が合っていても読めないので、探し直して見つからなければ数フレームは探さない（全画面の連結成分探索は重い）
				const better = locate(img)
					.map((q) => ({ q, r: readStrip(img, q, hint()) }))
					.find((x) => x.r && decoded(x.r));
				if (better) {
					quad = better.q;
					read = better.r;
					cooldown = 0;
				} else cooldown = RELOCATE_COOLDOWN;
			}
			if (image || sinceQr >= opt.qrEvery || (read && read.status !== "ok" && read.status !== "mixed")) {
				const q = readQr(img);
				if (q) qr = q;
				sinceQr = 0;
			} else sinceQr++;
			rows.push({
				frame: all.length + rows.length,
				pts: null,
				...(read ?? { ...EMPTY, status }),
				qr,
			});
			if (opt.dump) appendFileSync(opt.dump, `${JSON.stringify({ frame: all.length + rows.length - 1, status: read?.status ?? status, ...read?.raw })}\n`);
		});
		for (let i = 0; i < rows.length; i++) rows[i].pts = image ? null : (pts[i] ?? null);
		all.push(...rows);
	}
	finish(all, opt.around, sequential);
	const text = csv(all);
	if (opt.out) writeFileSync(opt.out, `${text}\n`);
	else process.stdout.write(`${text}\n`);
	const counts: Record<string, number> = {};
	for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;
	process.stderr.write(`${all.length} frames: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ")}\n`);
	return all;
}

if (import.meta.main) {
	decode(process.argv.slice(2)).catch((e) => {
		process.stderr.write(`${e instanceof Error ? e.message : e}\n`);
		process.exit(1);
	});
}
