import type { SeoMessages } from "./en.ts";

export default {
	title: "Reloj con milisegundos y hora exacta online | {name}",
	description:
		"Reloj online gratuito con milisegundos, sincronizado con servidores de hora atómica y margen de error garantizado. Grábalo y mide el desfase de tu cámara.",
	ogImageAlt: "{name}: un gran reloj con milisegundos y su margen de error",
	h1: "{name}: un reloj online preciso al milisegundo",
	intro:
		"{name} es un reloj online gratuito que muestra la hora actual con milisegundos. En lugar de fiarse del reloj de este dispositivo, consulta varios servidores de hora independientes (un servidor de borde de Cloudflare, Akamai, el NICT de Japón, timeapi.io y time.now), conserva solo los que coinciden e indica cuánto podría desviarse como máximo la hora mostrada. No requiere registro ni instalación y funciona en cualquier zona horaria.",
	howHeading: "Medir el desfase de la cámara y del código de tiempo",
	how1: "Abre esta página en una pantalla, elige tu zona horaria y espera a que las fuentes coincidan y el margen de error sea pequeño.",
	how2: "Graba la pantalla con tu cámara, teléfono o grabadora. Una velocidad de obturación alta mantiene los dígitos nítidos y cada fotograma muestra un único valor.",
	how3: "En tu editor, compara el código de tiempo de un fotograma o la marca de tiempo del archivo con la hora visible en ese fotograma. Repite la comparación más adelante en la grabación: la variación de la diferencia es el desfase.",
	boundHeading: "Qué significa el margen de error",
	boundBody:
		"La respuesta de un servidor de hora puede equivocarse como máximo en el tiempo de ida y vuelta, así que cada respuesta se convierte en un intervalo que debe contener la hora real. El reloj toma el rango donde más intervalos se solapan (algoritmo de Marzullo), descarta los servidores que discrepan y muestra el centro de ese rango. El valor ± es un límite estricto, no una estimación estadística. Además aprende a qué velocidad avanza el reloj de este dispositivo, por lo que mantiene la hora entre consultas.",
	faqHeading: "Preguntas frecuentes",
	q1: "¿Qué precisión tiene este reloj online?",
	a1: "Depende de tu red. En una conexión normal el margen de error es de unos pocos milisegundos y se muestra en vivo en la página. El retraso de un fotograma de la pantalla se compensa automáticamente y puedes añadir más en Ajustes.",
	q2: "¿Es tan preciso como un reloj atómico?",
	a2: "Los servidores que consulta siguen el UTC, que mantienen relojes atómicos, así que la página muestra la hora atómica dentro del margen de error indicado. Los retrasos de tu pantalla y de tu cámara no forman parte de ese margen.",
	q3: "¿Por qué el reloj de mi ordenador o teléfono es diferente?",
	a3: "Los relojes de los dispositivos se desvían y solo se corrigen de vez en cuando. La página muestra cuánto se aleja el reloj de este dispositivo de la hora real y a qué velocidad avanza, en partes por millón.",
	q4: "¿Funciona en mi zona horaria e idioma? ¿Es gratis?",
	a4: "Sí. Puedes elegir cualquier zona horaria IANA (como Asia/Tokyo o America/New_York), la página está disponible en {languages} idiomas y es gratuita, sin registro.",
} satisfies SeoMessages;
