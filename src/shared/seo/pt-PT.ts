import type { SeoMessages } from "./en.ts";

export default {
	title: "Relógio com milissegundos e hora certa online | {name}",
	description:
		"Relógio online gratuito com milissegundos, sincronizado com servidores de hora atómica, limite de erro garantido. Filme-o para medir o desvio da câmara.",
	ogImageAlt: "{name}: um grande relógio com milissegundos e o seu limite de erro",
	h1: "{name}: um relógio online preciso ao milissegundo",
	intro:
		"O {name} é um relógio online gratuito que mostra a hora atual em milissegundos. Em vez de confiar no relógio deste dispositivo, consulta vários servidores de hora independentes (um servidor de periferia da Cloudflare, a Akamai, o NICT do Japão, o timeapi.io e o time.now), mantém apenas os que concordam e indica quanto, no máximo, a hora apresentada pode estar errada. Sem registo nem instalação; funciona em qualquer fuso horário.",
	howHeading: "Medir o desvio da câmara e do timecode",
	how1: "Abra esta página num ecrã, escolha o seu fuso horário e aguarde até que as fontes concordem e o limite de erro fique pequeno.",
	how2: "Filme o ecrã com a câmara, o telemóvel ou o gravador. Uma velocidade de obturador elevada mantém os dígitos nítidos, e cada fotograma mostra um único valor.",
	how3: "No seu editor, compare o timecode de um fotograma ou a data do ficheiro com a hora visível nesse fotograma. Repita mais à frente na gravação: a variação da diferença é o desvio.",
	boundHeading: "O que significa o limite de erro",
	boundBody:
		"A resposta de um servidor de hora pode estar errada, no máximo, pelo tempo de ida e volta, pelo que cada resposta se torna um intervalo que tem de conter a hora verdadeira. O relógio usa o intervalo em que mais respostas se sobrepõem (algoritmo de Marzullo), descarta os servidores que discordam e apresenta o meio desse intervalo. O valor ± é um limite rígido, não uma estimativa estatística. Aprende também a velocidade do relógio deste dispositivo, por isso mantém a hora certa entre consultas.",
	faqHeading: "Perguntas frequentes",
	q1: "Qual é a precisão deste relógio online?",
	a1: "Depende da sua rede. Numa ligação normal, o limite de erro é de poucos milissegundos e é apresentado em direto na página. O atraso de um fotograma de apresentação é compensado automaticamente e pode acrescentar mais nas Definições.",
	q2: "É tão preciso como um relógio atómico?",
	a2: "Os servidores consultados seguem o UTC, mantido por relógios atómicos, pelo que a página mostra a hora atómica dentro do limite de erro apresentado. Os atrasos do ecrã e da câmara não fazem parte desse limite.",
	q3: "Porque é que o relógio do meu computador ou telemóvel é diferente?",
	a3: "Os relógios dos dispositivos desviam-se e só são corrigidos de vez em quando. A página mostra quanto o relógio deste dispositivo está afastado da hora verdadeira e com que velocidade anda, em partes por milhão.",
	q4: "Funciona no meu fuso horário e idioma? É grátis?",
	a4: "Sim. Pode escolher qualquer fuso horário IANA (como Asia/Tokyo ou America/New_York), a página está disponível em {languages} idiomas e é gratuita, sem registo.",
} satisfies SeoMessages;
