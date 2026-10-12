import dgram from "node:dgram";

const NTP_EPOCH_OFFSET = 2208988800;

export type NtpResult = { server: string; offset: number; delay: number; half: number; at: number };

function readTs(buf: Buffer, at: number) {
	return (buf.readUInt32BE(at) - NTP_EPOCH_OFFSET) * 1000 + (buf.readUInt32BE(at + 4) / 2 ** 32) * 1000;
}

function query(server: string, timeoutMs = 2000): Promise<NtpResult> {
	return new Promise((resolve, reject) => {
		const sock = dgram.createSocket(server.includes(":") ? "udp6" : "udp4");
		const pkt = Buffer.alloc(48);
		pkt[0] = 0x23;
		const timer = setTimeout(() => {
			sock.close();
			reject(new Error(`timeout ${server}`));
		}, timeoutMs);
		let t1 = 0;
		sock.on("message", (msg) => {
			const t4 = Date.now();
			clearTimeout(timer);
			sock.close();
			const t2 = readTs(msg, 32);
			const t3 = readTs(msg, 40);
			const delay = t4 - t1 - (t3 - t2);
			const offset = (t2 - t1 + (t3 - t4)) / 2;
			resolve({ server, offset, delay, half: delay / 2, at: t4 });
		});
		sock.on("error", (e) => {
			clearTimeout(timer);
			sock.close();
			reject(e);
		});
		t1 = Date.now();
		sock.send(pkt, 123, server);
	});
}

/** NTPで測った「正しい時刻 − このマシンのシステム時計(Date.now)」。各サーバーで遅延が最小のサンプルを使う */
export async function ntpReference(servers = ["ntp.nict.jp", "time.cloudflare.com", "time.apple.com"], perServer = 8) {
	const best: NtpResult[] = [];
	for (const s of servers) {
		const xs: NtpResult[] = [];
		for (let i = 0; i < perServer; i++) {
			try {
				xs.push(await query(s));
			} catch {}
			await new Promise((r) => setTimeout(r, 150));
		}
		if (xs.length) best.push(xs.reduce((a, b) => (b.delay < a.delay ? b : a)));
	}
	return best;
}
