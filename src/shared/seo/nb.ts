import type { SeoMessages } from "./en.ts";

export default {
	title: "Klokke med millisekunder – nøyaktig tid online | {name}",
	description:
		"Gratis klokke med millisekunder og nøyaktig tid online, synkronisert mot flere atomtidsservere med garantert feilgrense. Filmen den og mål tidskodedrift.",
	ogImageAlt: "{name}: en stor millisekundklokke med feilgrense",
	h1: "{name}: en nettklokke som er nøyaktig til millisekundet",
	intro:
		"{name} er en gratis nettklokke som viser klokkeslettet med millisekunders presisjon. I stedet for å stole på klokken på denne enheten spør den flere uavhengige tidsservere (en Cloudflare-edgeserver, Akamai, Japans NICT, timeapi.io og time.now), beholder bare de som er enige, og viser hvor mye den viste tiden høyst kan avvike. Ingen registrering eller installasjon, og den fungerer i alle tidssoner.",
	howHeading: "Mål drift i kamera og tidskode",
	how1: "Åpne denne siden på en skjerm, velg tidssonen din og vent til kildene er enige og feilgrensen er liten.",
	how2: "Filmen skjermen med kamera, mobil eller opptaker. En kort lukkertid holder sifrene skarpe, slik at hvert bilde viser én enkelt verdi.",
	how3: "Sammenlign i redigeringsprogrammet tidskoden eller filens tidsstempel for et bilde med tiden som vises i akkurat det bildet. Gjør det samme senere i opptaket: endringen i forskjellen er driften.",
	boundHeading: "Hva feilgrensen betyr",
	boundBody:
		"Svaret fra en tidsserver kan høyst være feil med tiden svaret brukte fram og tilbake, så hvert svar blir et intervall som må inneholde den sanne tiden. Klokken velger området der flest intervaller overlapper (Marzullos algoritme), forkaster servere som avviker, og viser midten av området. Verdien etter ± er en hard grense, ikke et statistisk anslag. Klokken lærer også hvor fort klokken på denne enheten går, slik at den holder god tid mellom kontrollene.",
	faqHeading: "Vanlige spørsmål",
	q1: "Hvor nøyaktig er denne nettklokken?",
	a1: "Det avhenger av nettverket ditt. På en vanlig tilkobling er feilgrensen noen få millisekunder, og den vises løpende på siden. Visningsforsinkelsen for ett bilde kompenseres automatisk, og du kan legge til mer i Innstillinger.",
	q2: "Er den like nøyaktig som en atomklokke?",
	a2: "Serverne den spør følger UTC, som holdes av atomklokker, så siden viser atomtid innenfor den viste feilgrensen. Forsinkelser i skjermen og kameraet ditt er ikke med i grensen.",
	q3: "Hvorfor avviker klokken på datamaskinen eller mobilen min?",
	a3: "Klokker på enheter driver og blir bare korrigert innimellom. Siden viser hvor langt klokken på denne enheten ligger fra den sanne tiden, og hvor fort den går, i deler per million (ppm).",
	q4: "Fungerer den i min tidssone og på mitt språk? Er den gratis?",
	a4: "Ja. Du kan velge hvilken som helst IANA-tidssone (for eksempel Asia/Tokyo eller America/New_York), siden finnes på {languages} språk, og den er gratis uten registrering.",
} satisfies SeoMessages;
