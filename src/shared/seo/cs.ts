import type { SeoMessages } from "./en.ts";

export default {
	title: "Hodiny s milisekundami online, přesný čas | {name}",
	description:
		"Bezplatné online hodiny s milisekundami, synchronizované se servery atomového času se zaručenou mezí chyby. Natočte je a změřte posun kamery a timecode.",
	ogImageAlt: "{name}: velké hodiny s milisekundami a mezí chyby",
	h1: "{name}: online hodiny přesné na milisekundu",
	intro:
		"{name} jsou bezplatné online hodiny, které ukazují aktuální čas s přesností na milisekundu. Místo důvěry v hodiny tohoto zařízení se dotazují několika nezávislých časových serverů (okrajový server Cloudflare, Akamai, japonský NICT, timeapi.io a time.now), ponechají jen shodné odpovědi a ukážou, o kolik se zobrazený čas může nejvýše lišit od skutečného. Nevyžadují registraci ani instalaci a fungují v libovolném časovém pásmu.",
	howHeading: "Měření posunu kamery a timecode",
	how1: "Otevřete tuto stránku na obrazovce, vyberte časové pásmo a počkejte, až se zdroje shodnou a mez chyby se zmenší.",
	how2: "Natočte obrazovku kamerou, telefonem nebo rekordérem. Krátký čas závěrky udrží číslice ostré, takže každý snímek ukazuje jednu hodnotu.",
	how3: "V editoru porovnejte timecode snímku nebo časové razítko souboru s časem viditelným na tomto snímku. Zopakujte to později v záznamu: změna rozdílu je posun.",
	boundHeading: "Co znamená mez chyby",
	boundBody:
		"Odpověď časového serveru se může lišit nejvýše o dobu cesty tam a zpět, proto se každá odpověď stává intervalem, ve kterém musí ležet skutečný čas. Hodiny vezmou rozsah, kde se překrývá nejvíc intervalů (Marzullův algoritmus), vyřadí nesouhlasící servery a zobrazí střed tohoto rozsahu. Hodnota ± je pevná hranice, nikoli statistický odhad. Hodiny se také učí, jak rychle jdou hodiny tohoto zařízení, takže zůstávají přesné i mezi kontrolami.",
	faqHeading: "Často kladené otázky",
	q1: "Jak přesné jsou tyto online hodiny?",
	a1: "Záleží na vaší síti. Při běžném připojení je mez chyby několik milisekund a stále je zobrazena na stránce. Zpoždění zobrazení o jeden snímek se kompenzuje automaticky a v nastavení lze přidat další.",
	q2: "Jsou stejně přesné jako atomové hodiny?",
	a2: "Dotazované servery se řídí časem UTC, který udržují atomové hodiny, takže stránka ukazuje atomový čas v rámci zobrazené meze chyby. Zpoždění obrazovky a kamery do této meze nepatří.",
	q3: "Proč se hodiny v počítači nebo telefonu liší?",
	a3: "Hodiny zařízení se rozcházejí a opravují se jen občas. Stránka ukazuje, o kolik se hodiny tohoto zařízení liší od skutečného času a jak rychle jdou, v miliontinách (ppm).",
	q4: "Funguje to v mém časovém pásmu a jazyce? Je to zdarma?",
	a4: "Ano. Můžete zvolit libovolné časové pásmo IANA (například Asia/Tokyo nebo America/New_York), stránka je dostupná v {languages} jazycích a je zdarma, bez registrace.",
} satisfies SeoMessages;
