import type { SeoMessages } from "./en.ts";

export default {
	title: "Pontos idő milliszekundummal, óra online | {name}",
	description:
		"Ingyenes online óra milliszekundumokkal, atomidő-szerverekkel szinkronizálva, garantált hibahatárral. Vedd fel, és mérd meg a timecode eltérését.",
	ogImageAlt: "{name}: nagy milliszekundumos óra hibahatárral",
	h1: "{name}: milliszekundum pontosságú online óra",
	intro:
		"A(z) {name} egy ingyenes online óra, amely milliszekundum pontossággal mutatja az aktuális időt. Ahelyett, hogy ennek az eszköznek az órájában bízna, több független időszervert kérdez le (Cloudflare edge szerver, Akamai, a japán NICT, a timeapi.io és a time.now), csak az egyező válaszokat tartja meg, és megmutatja, legfeljebb mennyivel térhet el a kijelzett idő a valóditól. Nem kell hozzá regisztráció vagy telepítés, és bármely időzónában működik.",
	howHeading: "A kamera és a timecode eltérésének mérése",
	how1: "Nyisd meg ezt az oldalt egy képernyőn, válaszd ki az időzónát, és várd meg, amíg az időforrások egyeznek, és a hibahatár lecsökken.",
	how2: "Filmezd le a képernyőt kamerával, telefonnal vagy rögzítővel. A rövid záridő élesen tartja a számjegyeket, így minden kép egy értéket mutat.",
	how3: "A vágóprogramban hasonlítsd össze egy kép timecode-ját vagy a fájl időbélyegét az adott képen látható idővel. Ismételd meg később a felvételen: a különbség változása az eltérés.",
	boundHeading: "Mit jelent a hibahatár",
	boundBody:
		"Az időszerver válasza legfeljebb az oda-vissza út idejével lehet téves, ezért minden válasz egy olyan intervallummá válik, amelynek tartalmaznia kell a valódi időt. Az óra azt a tartományt veszi, ahol a legtöbb intervallum átfedi egymást (Marzullo-algoritmus), kizárja az eltérő szervereket, és e tartomány közepét mutatja. A ± érték kemény korlát, nem statisztikai becslés. Az óra azt is megtanulja, milyen gyorsan jár az eszköz órája, így az ellenőrzések között is pontos marad.",
	faqHeading: "Gyakran ismételt kérdések",
	q1: "Mennyire pontos ez az online óra?",
	a1: "A hálózatodtól függ. Átlagos kapcsolaton a hibahatár néhány milliszekundum, és élőben látható az oldalon. A kijelző egy képkockányi késését automatikusan kompenzálja, a Beállításokban pedig többet is hozzáadhatsz.",
	q2: "Olyan pontos, mint egy atomóra?",
	a2: "A lekérdezett szerverek az atomórák által tartott UTC-t követik, így az oldal atomidőt mutat a kijelzett hibahatáron belül. A képernyő és a kamera késése nem része ennek a határnak.",
	q3: "Miért tér el a számítógépem vagy a telefonom órája?",
	a3: "Az eszközök órái elcsúsznak, és csak időnként korrigálják őket. Az oldal megmutatja, mennyivel tér el ennek az eszköznek az órája a valódi időtől, és milyen gyorsan jár, ppm-ben (a millió egy része).",
	q4: "Működik az én időzónámban és nyelvemen? Ingyenes?",
	a4: "Igen. Bármely IANA időzónát kiválaszthatod (például Asia/Tokyo vagy America/New_York), az oldal {languages} nyelven érhető el, és ingyenes, regisztráció nélkül.",
} satisfies SeoMessages;
