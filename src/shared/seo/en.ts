const en = {
	title: "Online Millisecond Clock & Time Sync Check | {name}",
	description:
		"Free online clock with milliseconds, synced to several atomic-time servers with a guaranteed error bound. Film it to measure camera and timecode drift.",
	ogImageAlt: "{name}: a large millisecond clock with its error bound",
	h1: "{name}: an online clock accurate to the millisecond",
	intro:
		"{name} is a free online clock that shows the current time to the millisecond. Instead of trusting this device's clock, it asks several independent time servers (a Cloudflare edge server, Akamai, Japan's NICT, timeapi.io and time.now), keeps only the ones that agree, and tells you how far off the displayed time could possibly be. No sign-up or install; it works in any time zone.",
	howHeading: "Measuring camera and timecode drift",
	how1: "Open this page on a screen, choose your time zone and wait until the sources agree and the error bound is small.",
	how2: "Film the screen with your camera, phone or recorder. A fast shutter keeps the digits sharp so each frame shows one value.",
	how3: "In your editor, compare a frame's timecode or file timestamp with the time visible in that frame. Do it again later in the recording: the change in the difference is the drift.",
	boundHeading: "What the error bound means",
	boundBody:
		"A time server's answer can be wrong by at most the round trip it took, so each answer becomes an interval that must contain the true time. The clock takes the range where the most intervals overlap (Marzullo's algorithm), drops servers that disagree and shows the middle of that range. The ± value is a hard limit, not a statistical estimate. It also learns how fast this device's clock runs, so it keeps good time between checks.",
	faqHeading: "Frequently asked questions",
	q1: "How accurate is this online clock?",
	a1: "It depends on your network. On a typical connection the error bound is a few milliseconds, and it is shown live on the page. One frame of display delay is compensated automatically, and you can add more in Settings.",
	q2: "Is it as accurate as an atomic clock?",
	a2: "The servers it checks follow UTC, which is kept by atomic clocks, so the page shows atomic time within the displayed error bound. Delays in your screen and camera are not part of that bound.",
	q3: "Why is my computer or phone clock different?",
	a3: "Device clocks drift and are corrected only now and then. The page shows how far this device's clock is from the true time and how fast it runs, in parts per million.",
	q4: "Does it work in my time zone and language? Is it free?",
	a4: "Yes. You can choose any IANA time zone (such as Asia/Tokyo or America/New_York), the page is available in {languages} languages, and it is free with no sign-up.",
};

export type SeoKey = keyof typeof en;
export type SeoMessages = Record<SeoKey, string>;
export default en satisfies SeoMessages;
