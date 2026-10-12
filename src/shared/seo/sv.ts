import type { SeoMessages } from "./en.ts";

export default {
	title: "Klocka med millisekunder – exakt tid online | {name}",
	description:
		"Gratis klocka med millisekunder och exakt tid online, synkad mot flera atomtidsservrar med garanterad felgräns. Filma den och mät kamerans tidskodsdrift.",
	ogImageAlt: "{name}: en stor millisekundklocka med felgräns",
	h1: "{name}: en onlineklocka som går exakt på millisekunden",
	intro:
		"{name} är en gratis onlineklocka som visar aktuell tid med millisekunders precision. I stället för att lita på den här enhetens klocka frågar den flera oberoende tidsservrar (en Cloudflare-edgeserver, Akamai, Japans NICT, timeapi.io och time.now), behåller bara de som stämmer överens och visar hur mycket den visade tiden som mest kan avvika. Ingen registrering eller installation krävs, och den fungerar i alla tidszoner.",
	howHeading: "Mät drift i kamera och tidskod",
	how1: "Öppna den här sidan på en skärm, välj din tidszon och vänta tills källorna är överens och felgränsen är liten.",
	how2: "Filma skärmen med kamera, mobil eller inspelare. En kort slutartid håller siffrorna skarpa så att varje bildruta visar ett enda värde.",
	how3: "Jämför i ditt redigeringsprogram en bildrutas tidskod eller filens tidsstämpel med tiden som syns i just den bildrutan. Gör om det senare i inspelningen: förändringen i skillnaden är driften.",
	boundHeading: "Vad felgränsen betyder",
	boundBody:
		"Ett tidsservers svar kan som mest vara fel med den tur och retur-tid det tog, så varje svar blir ett intervall som måste innehålla den sanna tiden. Klockan väljer det område där flest intervall överlappar (Marzullos algoritm), sorterar bort servrar som avviker och visar mitten av området. Värdet efter ± är en hård gräns, inte en statistisk uppskattning. Klockan lär sig också hur fort den här enhetens klocka går, så att den håller god tid mellan kontrollerna.",
	faqHeading: "Vanliga frågor",
	q1: "Hur exakt är den här onlineklockan?",
	a1: "Det beror på ditt nätverk. På en vanlig uppkoppling är felgränsen några millisekunder, och den visas löpande på sidan. En bildrutas visningsfördröjning kompenseras automatiskt, och du kan lägga till mer i Inställningar.",
	q2: "Är den lika exakt som en atomklocka?",
	a2: "Servrarna den frågar följer UTC, som hålls av atomklockor, så sidan visar atomtid inom den visade felgränsen. Fördröjningar i din skärm och kamera ingår inte i gränsen.",
	q3: "Varför går klockan i min dator eller mobil fel?",
	a3: "Enheters klockor driver och korrigeras bara då och då. Sidan visar hur långt den här enhetens klocka ligger från den sanna tiden och hur fort den går, i miljondelar (ppm).",
	q4: "Fungerar den i min tidszon och på mitt språk? Är den gratis?",
	a4: "Ja. Du kan välja vilken IANA-tidszon som helst (till exempel Asia/Tokyo eller America/New_York), sidan finns på {languages} språk, och den är gratis utan registrering.",
} satisfies SeoMessages;
