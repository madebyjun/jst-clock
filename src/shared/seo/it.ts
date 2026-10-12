import type { SeoMessages } from "./en.ts";

export default {
	title: "Orologio con millisecondi e ora esatta online | {name}",
	description:
		"Orologio online gratuito con millisecondi, sincronizzato con server di ora atomica, margine d'errore garantito. Riprendilo per misurare la deriva.",
	ogImageAlt: "{name}: un grande orologio con millisecondi e il suo margine d'errore",
	h1: "{name}: un orologio online preciso al millisecondo",
	intro:
		"{name} è un orologio online gratuito che mostra l'ora attuale al millisecondo. Invece di fidarsi dell'orologio di questo dispositivo, interroga più server orari indipendenti (un server edge di Cloudflare, Akamai, il NICT giapponese, timeapi.io e time.now), tiene solo quelli concordi e indica di quanto, al massimo, l'ora mostrata può discostarsi da quella reale. Non servono registrazione né installazione e funziona in qualsiasi fuso orario.",
	howHeading: "Misurare la deriva di fotocamera e timecode",
	how1: "Apri questa pagina su uno schermo, scegli il tuo fuso orario e attendi che le fonti concordino e che il margine d'errore sia piccolo.",
	how2: "Riprendi lo schermo con la fotocamera, lo smartphone o il registratore. Un tempo di otturazione breve mantiene nitide le cifre, così ogni fotogramma mostra un solo valore.",
	how3: "Nel tuo programma di montaggio, confronta il timecode di un fotogramma o la data del file con l'ora visibile in quel fotogramma. Ripeti il confronto più avanti nella registrazione: la variazione della differenza è la deriva.",
	boundHeading: "Cosa significa il margine d'errore",
	boundBody:
		"La risposta di un server orario può sbagliare al massimo quanto il tempo di andata e ritorno, quindi ogni risposta diventa un intervallo che deve contenere l'ora reale. L'orologio prende l'intervallo in cui si sovrappongono più risposte (algoritmo di Marzullo), scarta i server discordanti e mostra il centro di quell'intervallo. Il valore ± è un limite rigoroso, non una stima statistica. Inoltre impara a che velocità procede l'orologio di questo dispositivo, così resta preciso tra un controllo e l'altro.",
	faqHeading: "Domande frequenti",
	q1: "Quanto è preciso questo orologio online?",
	a1: "Dipende dalla tua rete. Con una connessione normale il margine d'errore è di pochi millisecondi e viene mostrato in tempo reale nella pagina. Il ritardo di un fotogramma di visualizzazione è compensato automaticamente e puoi aggiungerne altro nelle Impostazioni.",
	q2: "È preciso come un orologio atomico?",
	a2: "I server interrogati seguono l'UTC, mantenuto da orologi atomici, quindi la pagina mostra l'ora atomica entro il margine d'errore indicato. I ritardi di schermo e fotocamera non rientrano in quel margine.",
	q3: "Perché l'orologio del mio computer o smartphone è diverso?",
	a3: "Gli orologi dei dispositivi derivano e vengono corretti solo di tanto in tanto. La pagina mostra di quanto l'orologio di questo dispositivo si discosta dall'ora reale e a che velocità procede, in parti per milione.",
	q4: "Funziona nel mio fuso orario e nella mia lingua? È gratuito?",
	a4: "Sì. Puoi scegliere qualsiasi fuso orario IANA (come Asia/Tokyo o America/New_York), la pagina è disponibile in {languages} lingue ed è gratuita, senza registrazione.",
} satisfies SeoMessages;
