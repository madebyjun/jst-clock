import type { SeoMessages } from "./en.ts";

export default {
	title: "Zegar z milisekundami online, dokładny czas | {name}",
	description:
		"Darmowy zegar online z milisekundami, zsynchronizowany z serwerami czasu atomowego, z gwarantowaną granicą błędu. Nagraj go i zmierz dryf timecode.",
	ogImageAlt: "{name}: duży zegar z milisekundami i granicą błędu",
	h1: "{name}: zegar online z dokładnością do milisekundy",
	intro:
		"{name} to darmowy zegar online, który pokazuje aktualny czas z dokładnością do milisekundy. Zamiast ufać zegarowi tego urządzenia, odpytuje kilka niezależnych serwerów czasu (serwer brzegowy Cloudflare, Akamai, japoński NICT, timeapi.io i time.now), zachowuje tylko zgodne odpowiedzi i pokazuje, jak bardzo wyświetlany czas może odbiegać od prawdziwego. Nie wymaga rejestracji ani instalacji i działa w dowolnej strefie czasowej.",
	howHeading: "Pomiar dryfu kamery i timecode",
	how1: "Otwórz tę stronę na ekranie, wybierz strefę czasową i poczekaj, aż źródła będą zgodne, a granica błędu zmaleje.",
	how2: "Nagraj ekran kamerą, telefonem lub rejestratorem. Krótki czas migawki utrzymuje ostre cyfry, więc każda klatka pokazuje jedną wartość.",
	how3: "W programie do montażu porównaj timecode klatki lub znacznik czasu pliku z czasem widocznym na tej klatce. Powtórz to później w nagraniu: zmiana różnicy to dryf.",
	boundHeading: "Co oznacza granica błędu",
	boundBody:
		"Odpowiedź serwera czasu może być błędna co najwyżej o czas przebycia drogi tam i z powrotem, więc każda odpowiedź staje się przedziałem, w którym musi znajdować się prawdziwy czas. Zegar wybiera zakres, w którym nakłada się najwięcej przedziałów (algorytm Marzullo), odrzuca niezgodne serwery i pokazuje środek tego zakresu. Wartość ± jest twardym limitem, a nie oszacowaniem statystycznym. Zegar uczy się też, jak szybko chodzi zegar tego urządzenia, dzięki czemu zachowuje dokładność między sprawdzeniami.",
	faqHeading: "Najczęściej zadawane pytania",
	q1: "Jak dokładny jest ten zegar online?",
	a1: "To zależy od sieci. Przy typowym połączeniu granica błędu wynosi kilka milisekund i jest stale widoczna na stronie. Opóźnienie wyświetlania o jedną klatkę jest kompensowane automatycznie, a w ustawieniach można dodać więcej.",
	q2: "Czy jest tak dokładny jak zegar atomowy?",
	a2: "Odpytywane serwery podążają za UTC, który utrzymują zegary atomowe, więc strona pokazuje czas atomowy w granicach wyświetlanego błędu. Opóźnienia ekranu i kamery nie wchodzą w skład tej granicy.",
	q3: "Dlaczego zegar mojego komputera lub telefonu pokazuje inny czas?",
	a3: "Zegary urządzeń się rozchodzą i są korygowane tylko od czasu do czasu. Strona pokazuje, jak bardzo zegar tego urządzenia odbiega od prawdziwego czasu i jak szybko chodzi, w milionowych częściach (ppm).",
	q4: "Czy działa w mojej strefie czasowej i języku? Czy jest darmowy?",
	a4: "Tak. Możesz wybrać dowolną strefę czasową IANA (na przykład Asia/Tokyo lub America/New_York), strona jest dostępna w {languages} językach i jest darmowa, bez rejestracji.",
} satisfies SeoMessages;
