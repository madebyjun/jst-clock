import type { SeoMessages } from "./en.ts";

export default {
	title: "Kello millisekunneilla – tarkka aika netissä | {name}",
	description:
		"Ilmainen kello millisekunneilla ja tarkka aika netissä, tahdistettu atomiaikapalvelimiin taatulla virherajalla. Kuvaa se ja mittaa aikakoodin ryömintä.",
	ogImageAlt: "{name}: suuri millisekuntikello ja sen virheraja",
	h1: "{name}: millisekunnin tarkkuudella käyvä verkkokello",
	intro:
		"{name} on ilmainen verkkokello, joka näyttää kellonajan millisekunnin tarkkuudella. Tämän laitteen kellon varassa olemisen sijaan se kysyy useilta toisistaan riippumattomilta aikapalvelimilta (Cloudflaren reunapalvelin, Akamai, Japanin NICT, timeapi.io ja time.now), käyttää vain yhtäpitäviä vastauksia ja kertoo, kuinka paljon näytetty aika voi enintään poiketa. Rekisteröitymistä tai asennusta ei tarvita, ja kello toimii kaikilla aikavyöhykkeillä.",
	howHeading: "Kameran ja aikakoodin ryöminnän mittaaminen",
	how1: "Avaa tämä sivu näytölle, valitse aikavyöhykkeesi ja odota, että lähteet ovat yhtäpitäviä ja virheraja on pieni.",
	how2: "Kuvaa näyttöä kameralla, puhelimella tai tallentimella. Lyhyt suljinaika pitää numerot terävinä, jolloin jokaisessa kuvassa näkyy yksi arvo.",
	how3: "Vertaa muokkausohjelmassa kuvan aikakoodia tai tiedoston aikaleimaa samassa kuvassa näkyvään aikaan. Tee sama myöhemmin tallenteessa: eron muutos on ryöminnän määrä.",
	boundHeading: "Mitä virheraja tarkoittaa",
	boundBody:
		"Aikapalvelimen vastaus voi olla väärässä enintään edestakaisen matkan keston verran, joten jokaisesta vastauksesta tulee väli, jonka on sisällettävä todellinen aika. Kello valitsee alueen, jossa useimmat välit menevät päällekkäin (Marzullon algoritmi), hylkää poikkeavat palvelimet ja näyttää alueen keskikohdan. ±-arvo on kova raja eikä tilastollinen arvio. Kello oppii myös, kuinka nopeasti tämän laitteen kello käy, joten se pysyy tarkkana tarkistusten välilläkin.",
	faqHeading: "Usein kysytyt kysymykset",
	q1: "Kuinka tarkka tämä verkkokello on?",
	a1: "Se riippuu verkostasi. Tavallisella yhteydellä virheraja on muutama millisekunti, ja se näkyy sivulla jatkuvasti. Yhden kuvan näyttöviive korjataan automaattisesti, ja voit lisätä korjausta Asetuksissa.",
	q2: "Onko se yhtä tarkka kuin atomikello?",
	a2: "Kysytyt palvelimet noudattavat UTC-aikaa, jota pitävät yllä atomikellot, joten sivu näyttää atomiaikaa näytetyn virherajan sisällä. Näytön ja kameran viiveet eivät sisälly rajaan.",
	q3: "Miksi tietokoneeni tai puhelimeni kello poikkeaa?",
	a3: "Laitteiden kellot ryömivät ja niitä korjataan vain silloin tällöin. Sivu näyttää, kuinka kaukana tämän laitteen kello on todellisesta ajasta ja kuinka nopeasti se käy, miljoonasosina (ppm).",
	q4: "Toimiiko se omalla aikavyöhykkeelläni ja kielelläni? Onko se ilmainen?",
	a4: "Kyllä. Voit valita minkä tahansa IANA-aikavyöhykkeen (esimerkiksi Asia/Tokyo tai America/New_York), sivu on saatavilla {languages} kielellä, ja se on ilmainen ilman rekisteröitymistä.",
} satisfies SeoMessages;
