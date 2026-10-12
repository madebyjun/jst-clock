export type Source = {
	id: string;
	label: string;
	urls: string[];
	parse: (body: string) => number;
	resolutionMs: number;
	resourceTiming: boolean;
};

const NICT_HOSTS = [
	"3fe5a5f690efc790d4764f1c528a4ebb89fa4168",
	"67495dde3b39c2991829589f0101ab7a035eecf5",
	"08a08e3a6edef4ba7a0c055a42d8e1ba2597f2b5",
];

export const SOURCES: Source[] = [
	{
		id: "edge",
		label: "Cloudflare edge",
		urls: ["/api/time"],
		parse: (b) => JSON.parse(b).t,
		resolutionMs: 1,
		resourceTiming: true,
	},
	{
		id: "akamai",
		label: "Akamai",
		urls: ["https://time.akamai.com/?ms"],
		parse: (b) => Number.parseFloat(b) * 1000,
		resolutionMs: 1,
		resourceTiming: true,
	},
	{
		// 3台を別々の時刻源として数えないのは、同じ組織の同じ仕組みなので1つが狂えば3つとも狂い、多数決を乗っ取れるため
		id: "nict",
		label: "NICT",
		urls: NICT_HOSTS.map((h) => `https://${h}.nict.go.jp/cgi-bin/json`),
		parse: (b) => JSON.parse(b).st * 1000,
		resolutionMs: 1,
		resourceTiming: false,
	},
	{
		id: "timeapi",
		label: "timeapi.io",
		urls: ["https://timeapi.io/api/time/current/zone?timeZone=UTC"],
		parse: (b) => Date.parse(`${JSON.parse(b).dateTime.slice(0, 23)}Z`),
		resolutionMs: 1,
		resourceTiming: false,
	},
	{
		id: "timenow",
		label: "time.now",
		urls: ["https://time.now/developer/api/timezone/Etc/UTC"],
		parse: (b) => Date.parse(JSON.parse(b).utc_datetime),
		resolutionMs: 1,
		resourceTiming: false,
	},
];
