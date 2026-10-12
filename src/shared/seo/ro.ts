import type { SeoMessages } from "./en.ts";

export default {
	title: "Ceas cu milisecunde și ora exactă online | {name}",
	description:
		"Ceas online gratuit cu milisecunde, sincronizat cu servere de timp atomic, cu limită de eroare garantată. Filmează-l ca să măsori deriva camerei.",
	ogImageAlt: "{name}: un ceas mare cu milisecunde și limita sa de eroare",
	h1: "{name}: un ceas online exact până la milisecundă",
	intro:
		"{name} este un ceas online gratuit care afișează ora curentă cu milisecunde. În loc să se bazeze pe ceasul acestui dispozitiv, interoghează mai multe servere de timp independente (un server edge Cloudflare, Akamai, NICT din Japonia, timeapi.io și time.now), păstrează doar serverele care concordă și arată cu cât poate diferi, cel mult, ora afișată. Fără înregistrare sau instalare; funcționează în orice fus orar.",
	howHeading: "Măsurarea derivei camerei și a timecode-ului",
	how1: "Deschide această pagină pe un ecran, alege fusul orar și așteaptă până când sursele concordă, iar limita de eroare devine mică.",
	how2: "Filmează ecranul cu camera, telefonul sau recorderul. O viteză mare a obturatorului păstrează cifrele clare, astfel încât fiecare cadru să arate o singură valoare.",
	how3: "În programul de editare, compară timecode-ul unui cadru sau data fișierului cu ora vizibilă în acel cadru. Repetă comparația mai târziu în înregistrare: modificarea diferenței este deriva.",
	boundHeading: "Ce înseamnă limita de eroare",
	boundBody:
		"Răspunsul unui server de timp poate greși cel mult cât durata dus-întors, așa că fiecare răspuns devine un interval care trebuie să conțină ora reală. Ceasul alege zona în care se suprapun cele mai multe intervale (algoritmul Marzullo), elimină serverele care nu concordă și afișează mijlocul acelei zone. Valoarea ± este o limită strictă, nu o estimare statistică. Ceasul învață și cât de repede merge ceasul acestui dispozitiv, așa că rămâne exact între verificări.",
	faqHeading: "Întrebări frecvente",
	q1: "Cât de exact este acest ceas online?",
	a1: "Depinde de rețeaua ta. Pe o conexiune obișnuită, limita de eroare este de câteva milisecunde și este afișată în timp real pe pagină. Întârzierea unui cadru de afișare este compensată automat, iar în Setări poți adăuga mai mult.",
	q2: "Este la fel de exact ca un ceas atomic?",
	a2: "Serverele interogate urmează UTC, menținut de ceasuri atomice, așa că pagina arată ora atomică în limita de eroare afișată. Întârzierile ecranului și ale camerei nu fac parte din această limită.",
	q3: "De ce ceasul computerului sau al telefonului meu arată altfel?",
	a3: "Ceasurile dispozitivelor derivă și sunt corectate doar din când în când. Pagina arată cât de departe este ceasul acestui dispozitiv de ora reală și cât de repede merge, în părți pe milion.",
	q4: "Funcționează în fusul meu orar și în limba mea? Este gratuit?",
	a4: "Da. Poți alege orice fus orar IANA (precum Asia/Tokyo sau America/New_York), pagina este disponibilă în {languages} limbi și este gratuită, fără înregistrare.",
} satisfies SeoMessages;
