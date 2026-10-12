import type { SeoMessages } from "./en.ts";

export default {
	title: "Uhr mit Millisekunden: genaue Uhrzeit online | {name}",
	description:
		"Kostenlose Online-Uhr mit Millisekunden, abgeglichen mit Atomzeit-Servern, mit garantierter Fehlergrenze. Filmen Sie sie, um die Kamera-Drift zu messen.",
	ogImageAlt: "{name}: eine große Millisekunden-Uhr mit ihrer Fehlergrenze",
	h1: "{name}: eine Online-Uhr, die auf die Millisekunde genau geht",
	intro:
		"{name} ist eine kostenlose Online-Uhr, die die aktuelle Uhrzeit auf die Millisekunde genau anzeigt. Statt der Uhr dieses Geräts zu vertrauen, fragt sie mehrere unabhängige Zeitserver ab (einen Cloudflare-Edge-Server, Akamai, das japanische NICT, timeapi.io und time.now), behält nur die übereinstimmenden und zeigt, wie weit die angezeigte Zeit höchstens abweichen kann. Keine Anmeldung, keine Installation; sie funktioniert in jeder Zeitzone.",
	howHeading: "Kamera- und Timecode-Drift messen",
	how1: "Öffnen Sie diese Seite auf einem Bildschirm, wählen Sie Ihre Zeitzone und warten Sie, bis die Quellen übereinstimmen und die Fehlergrenze klein ist.",
	how2: "Filmen Sie den Bildschirm mit Kamera, Smartphone oder Rekorder. Eine kurze Belichtungszeit hält die Ziffern scharf, sodass jedes Bild genau einen Wert zeigt.",
	how3: "Vergleichen Sie in Ihrem Schnittprogramm den Timecode eines Bildes oder den Zeitstempel der Datei mit der in diesem Bild sichtbaren Uhrzeit. Wiederholen Sie das später in der Aufnahme: Die Änderung der Differenz ist die Drift.",
	boundHeading: "Was die Fehlergrenze bedeutet",
	boundBody:
		"Die Antwort eines Zeitservers kann höchstens um die Dauer des Hin- und Rückwegs falsch sein, daher wird jede Antwort zu einem Intervall, das die wahre Zeit enthalten muss. Die Uhr nimmt den Bereich, in dem sich die meisten Intervalle überlappen (Marzullo-Algorithmus), verwirft abweichende Server und zeigt die Mitte dieses Bereichs. Der ±-Wert ist eine harte Grenze, keine statistische Schätzung. Außerdem lernt die Uhr, wie schnell die Uhr dieses Geräts läuft, und bleibt so zwischen den Abfragen genau.",
	faqHeading: "Häufig gestellte Fragen",
	q1: "Wie genau ist diese Online-Uhr?",
	a1: "Das hängt von Ihrem Netzwerk ab. Bei einer üblichen Verbindung beträgt die Fehlergrenze wenige Millisekunden und wird live auf der Seite angezeigt. Die Verzögerung eines Anzeigebildes wird automatisch ausgeglichen; in den Einstellungen können Sie weitere hinzufügen.",
	q2: "Ist sie so genau wie eine Atomuhr?",
	a2: "Die abgefragten Server folgen der UTC, die von Atomuhren gehalten wird. Die Seite zeigt also Atomzeit innerhalb der angezeigten Fehlergrenze. Verzögerungen von Bildschirm und Kamera sind in dieser Grenze nicht enthalten.",
	q3: "Warum geht die Uhr meines Computers oder Smartphones anders?",
	a3: "Geräteuhren driften und werden nur gelegentlich korrigiert. Die Seite zeigt, wie weit die Uhr dieses Geräts von der wahren Zeit abweicht und wie schnell sie läuft, in Millionstel (ppm).",
	q4: "Funktioniert sie in meiner Zeitzone und Sprache? Ist sie kostenlos?",
	a4: "Ja. Sie können jede IANA-Zeitzone wählen (etwa Asia/Tokyo oder America/New_York), die Seite ist in {languages} Sprachen verfügbar und kostenlos, ohne Anmeldung.",
} satisfies SeoMessages;
