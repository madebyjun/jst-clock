import type { SeoMessages } from "./en.ts";

export default {
	title: "Ur med millisekunder – præcis tid online | {name}",
	description:
		"Gratis ur med millisekunder og præcis tid online, synkron med flere atomtidsservere og garanteret fejlgrænse. Filmér det og mål kameradrift.",
	ogImageAlt: "{name}: et stort millisekundur med fejlgrænse",
	h1: "{name}: et onlineur, der er nøjagtigt til millisekundet",
	intro:
		"{name} er et gratis onlineur, der viser det aktuelle klokkeslæt med millisekunders præcision. I stedet for at stole på denne enheds ur spørger det flere uafhængige tidsservere (en Cloudflare-edgeserver, Akamai, Japans NICT, timeapi.io og time.now), beholder kun dem, der er enige, og viser, hvor meget det viste klokkeslæt højst kan afvige. Ingen tilmelding eller installation, og det virker i alle tidszoner.",
	howHeading: "Mål drift i kamera og tidskode",
	how1: "Åbn denne side på en skærm, vælg din tidszone, og vent, til kilderne er enige, og fejlgrænsen er lille.",
	how2: "Filmér skærmen med kamera, telefon eller optager. En kort lukkertid holder cifrene skarpe, så hvert billede viser én enkelt værdi.",
	how3: "Sammenlign i dit redigeringsprogram et billedes tidskode eller filens tidsstempel med det klokkeslæt, der ses i netop det billede. Gør det igen senere i optagelsen: ændringen i forskellen er driften.",
	boundHeading: "Hvad fejlgrænsen betyder",
	boundBody:
		"En tidsservers svar kan højst være forkert med den tid, svaret tog frem og tilbage, så hvert svar bliver et interval, der skal indeholde den sande tid. Uret vælger det område, hvor flest intervaller overlapper (Marzullos algoritme), fravælger servere, der afviger, og viser midten af området. Værdien efter ± er en hård grænse, ikke et statistisk skøn. Uret lærer også, hvor hurtigt denne enheds ur går, så det holder god tid mellem kontrollerne.",
	faqHeading: "Ofte stillede spørgsmål",
	q1: "Hvor nøjagtigt er dette onlineur?",
	a1: "Det afhænger af dit netværk. På en almindelig forbindelse er fejlgrænsen nogle få millisekunder, og den vises løbende på siden. Et billedes visningsforsinkelse kompenseres automatisk, og du kan lægge mere til i Indstillinger.",
	q2: "Er det lige så nøjagtigt som et atomur?",
	a2: "De servere, det spørger, følger UTC, som holdes af atomure, så siden viser atomtid inden for den viste fejlgrænse. Forsinkelser i din skærm og dit kamera indgår ikke i grænsen.",
	q3: "Hvorfor afviger uret på min computer eller telefon?",
	a3: "Enheders ure driver og bliver kun korrigeret fra tid til anden. Siden viser, hvor langt denne enheds ur ligger fra det sande klokkeslæt, og hvor hurtigt det går, i dele pr. million (ppm).",
	q4: "Virker det i min tidszone og på mit sprog? Er det gratis?",
	a4: "Ja. Du kan vælge enhver IANA-tidszone (for eksempel Asia/Tokyo eller America/New_York), siden findes på {languages} sprog, og den er gratis uden tilmelding.",
} satisfies SeoMessages;
