import type { SeoMessages } from "./en.ts";

export default {
	title: "Relógio com milissegundos e hora certa online | {name}",
	description:
		"Relógio online gratuito com milissegundos, sincronizado com servidores de hora atômica, limite de erro garantido. Filme-o para medir o desvio da câmera.",
	ogImageAlt: "{name}: um grande relógio com milissegundos e seu limite de erro",
	h1: "{name}: um relógio online preciso ao milissegundo",
	intro:
		"O {name} é um relógio online gratuito que mostra a hora atual em milissegundos. Em vez de confiar no relógio deste dispositivo, ele consulta vários servidores de hora independentes (um servidor de borda da Cloudflare, Akamai, o NICT do Japão, timeapi.io e time.now), mantém apenas os que concordam e informa o quanto, no máximo, a hora exibida pode estar errada. Sem cadastro nem instalação; funciona em qualquer fuso horário.",
	howHeading: "Medindo o desvio de câmera e timecode",
	how1: "Abra esta página em uma tela, escolha seu fuso horário e aguarde até que as fontes concordem e o limite de erro fique pequeno.",
	how2: "Filme a tela com sua câmera, celular ou gravador. Uma velocidade de obturador alta mantém os dígitos nítidos, e cada quadro mostra um único valor.",
	how3: "No seu editor, compare o timecode de um quadro ou a data do arquivo com a hora visível nesse quadro. Repita mais adiante na gravação: a variação da diferença é o desvio.",
	boundHeading: "O que significa o limite de erro",
	boundBody:
		"A resposta de um servidor de hora pode estar errada no máximo pelo tempo de ida e volta, então cada resposta vira um intervalo que deve conter a hora verdadeira. O relógio usa a faixa em que mais intervalos se sobrepõem (algoritmo de Marzullo), descarta os servidores que discordam e mostra o meio dessa faixa. O valor ± é um limite rígido, não uma estimativa estatística. Ele também aprende a velocidade do relógio deste dispositivo, por isso mantém a hora certa entre as consultas.",
	faqHeading: "Perguntas frequentes",
	q1: "Qual é a precisão deste relógio online?",
	a1: "Depende da sua rede. Em uma conexão comum, o limite de erro é de poucos milissegundos e aparece ao vivo na página. O atraso de um quadro de exibição é compensado automaticamente, e você pode acrescentar mais em Configurações.",
	q2: "Ele é tão preciso quanto um relógio atômico?",
	a2: "Os servidores consultados seguem o UTC, mantido por relógios atômicos, então a página mostra a hora atômica dentro do limite de erro exibido. Os atrasos da sua tela e da câmera não fazem parte desse limite.",
	q3: "Por que o relógio do meu computador ou celular é diferente?",
	a3: "Os relógios dos dispositivos se desviam e só são corrigidos de vez em quando. A página mostra o quanto o relógio deste dispositivo está distante da hora verdadeira e com que velocidade ele anda, em partes por milhão.",
	q4: "Funciona no meu fuso horário e idioma? É grátis?",
	a4: "Sim. Você pode escolher qualquer fuso horário IANA (como Asia/Tokyo ou America/New_York), a página está disponível em {languages} idiomas e é gratuita, sem cadastro.",
} satisfies SeoMessages;
