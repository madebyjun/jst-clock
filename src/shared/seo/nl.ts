import type { SeoMessages } from "./en.ts";

export default {
	title: "Klok met milliseconden: de exacte tijd online | {name}",
	description:
		"Gratis online klok met milliseconden, gesynchroniseerd met atoomtijdservers en een gegarandeerde foutmarge. Film hem om cameradrift te meten.",
	ogImageAlt: "{name}: een grote milliseconde-klok met zijn foutmarge",
	h1: "{name}: een online klok die op de milliseconde nauwkeurig is",
	intro:
		"{name} is een gratis online klok die de actuele tijd tot op de milliseconde toont. In plaats van de klok van dit apparaat te vertrouwen, vraagt hij de tijd op bij meerdere onafhankelijke tijdservers (een Cloudflare-edgeserver, Akamai, het Japanse NICT, timeapi.io en time.now), houdt alleen de overeenkomende over en laat zien hoeveel de getoonde tijd hooguit kan afwijken. Geen account of installatie nodig; hij werkt in elke tijdzone.",
	howHeading: "Camera- en timecode-drift meten",
	how1: "Open deze pagina op een scherm, kies uw tijdzone en wacht tot de bronnen overeenkomen en de foutmarge klein is.",
	how2: "Film het scherm met uw camera, telefoon of recorder. Met een korte sluitertijd blijven de cijfers scherp, zodat elk beeld één waarde toont.",
	how3: "Vergelijk in uw montageprogramma de timecode van een beeld of de tijdstempel van het bestand met de tijd die in dat beeld zichtbaar is. Doe dit later in de opname nog eens: de verandering van het verschil is de drift.",
	boundHeading: "Wat de foutmarge betekent",
	boundBody:
		"Het antwoord van een tijdserver kan hooguit zoveel afwijken als de heen-en-terugreis duurde, dus elk antwoord wordt een interval dat de ware tijd moet bevatten. De klok neemt het bereik waarin de meeste intervallen overlappen (Marzullo-algoritme), laat servers die afwijken vallen en toont het midden van dat bereik. De ±-waarde is een harde grens, geen statistische schatting. De klok leert ook hoe snel de klok van dit apparaat loopt, zodat hij tussen de controles door de tijd goed bijhoudt.",
	faqHeading: "Veelgestelde vragen",
	q1: "Hoe nauwkeurig is deze online klok?",
	a1: "Dat hangt van uw netwerk af. Bij een gewone verbinding is de foutmarge enkele milliseconden en wordt die live op de pagina getoond. De vertraging van één beeld op het scherm wordt automatisch gecompenseerd en u kunt in de Instellingen meer toevoegen.",
	q2: "Is hij net zo nauwkeurig als een atoomklok?",
	a2: "De servers die worden geraadpleegd volgen UTC, dat door atoomklokken wordt bijgehouden, dus de pagina toont atoomtijd binnen de getoonde foutmarge. Vertragingen van uw scherm en camera maken geen deel uit van die marge.",
	q3: "Waarom loopt de klok van mijn computer of telefoon anders?",
	a3: "Klokken van apparaten lopen af en worden maar af en toe gecorrigeerd. De pagina toont hoe ver de klok van dit apparaat van de ware tijd afwijkt en hoe snel hij loopt, in delen per miljoen.",
	q4: "Werkt hij in mijn tijdzone en taal? Is hij gratis?",
	a4: "Ja. U kunt elke IANA-tijdzone kiezen (zoals Asia/Tokyo of America/New_York), de pagina is beschikbaar in {languages} talen en is gratis, zonder account.",
} satisfies SeoMessages;
