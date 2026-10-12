import type { SeoMessages } from "./en.ts";

export default {
	title: "Hodiny s milisekundami online, presný čas | {name}",
	description:
		"Bezplatné online hodiny s milisekundami, synchronizované so servermi atómového času, s garantovanou hranicou chyby. Natočte ich a zmerajte posun timecode.",
	ogImageAlt: "{name}: veľké hodiny s milisekundami a hranicou chyby",
	h1: "{name}: online hodiny presné na milisekundu",
	intro:
		"{name} sú bezplatné online hodiny, ktoré ukazujú aktuálny čas s presnosťou na milisekundu. Namiesto dôvery v hodiny tohto zariadenia sa pýtajú viacerých nezávislých časových serverov (okrajový server Cloudflare, Akamai, japonský NICT, timeapi.io a time.now), ponechajú len zhodné odpovede a ukážu, o koľko sa zobrazený čas môže najviac líšiť od skutočného. Nevyžadujú registráciu ani inštaláciu a fungujú v ľubovoľnom časovom pásme.",
	howHeading: "Meranie posunu kamery a timecode",
	how1: "Otvorte túto stránku na obrazovke, vyberte časové pásmo a počkajte, kým sa zdroje zhodnú a hranica chyby sa zmenší.",
	how2: "Natočte obrazovku kamerou, telefónom alebo rekordérom. Krátky čas uzávierky udrží číslice ostré, takže každý záber ukazuje jednu hodnotu.",
	how3: "V editore porovnajte timecode záberu alebo časovú pečiatku súboru s časom viditeľným na tomto zábere. Zopakujte to neskôr v zázname: zmena rozdielu je posun.",
	boundHeading: "Čo znamená hranica chyby",
	boundBody:
		"Odpoveď časového servera sa môže líšiť najviac o dobu cesty tam a späť, preto sa každá odpoveď stáva intervalom, v ktorom musí ležať skutočný čas. Hodiny vezmú rozsah, kde sa prekrýva najviac intervalov (Marzullov algoritmus), vyradia nesúhlasiace servery a zobrazia stred tohto rozsahu. Hodnota ± je pevná hranica, nie štatistický odhad. Hodiny sa tiež učia, ako rýchlo idú hodiny tohto zariadenia, takže zostávajú presné aj medzi kontrolami.",
	faqHeading: "Často kladené otázky",
	q1: "Aké presné sú tieto online hodiny?",
	a1: "Závisí to od vašej siete. Pri bežnom pripojení je hranica chyby niekoľko milisekúnd a stále je zobrazená na stránke. Oneskorenie zobrazenia o jeden záber sa kompenzuje automaticky a v nastaveniach možno pridať ďalšie.",
	q2: "Sú rovnako presné ako atómové hodiny?",
	a2: "Dopytované servery sa riadia časom UTC, ktorý udržiavajú atómové hodiny, takže stránka ukazuje atómový čas v rámci zobrazenej hranice chyby. Oneskorenia obrazovky a kamery do tejto hranice nepatria.",
	q3: "Prečo sa hodiny v počítači alebo telefóne líšia?",
	a3: "Hodiny zariadení sa rozchádzajú a opravujú sa len občas. Stránka ukazuje, o koľko sa hodiny tohto zariadenia líšia od skutočného času a ako rýchlo idú, v milióntinách (ppm).",
	q4: "Funguje to v mojom časovom pásme a jazyku? Je to zadarmo?",
	a4: "Áno. Môžete zvoliť ľubovoľné časové pásmo IANA (napríklad Asia/Tokyo alebo America/New_York), stránka je dostupná v {languages} jazykoch a je zadarmo, bez registrácie.",
} satisfies SeoMessages;
