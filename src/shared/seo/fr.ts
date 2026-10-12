import type { SeoMessages } from "./en.ts";

export default {
	title: "Horloge en ligne en millisecondes, heure exacte | {name}",
	description:
		"Horloge en ligne gratuite à la milliseconde, synchronisée sur des serveurs d'heure atomique, marge d'erreur garantie. Filmez-la pour mesurer la dérive.",
	ogImageAlt: "{name} : une grande horloge en millisecondes avec sa marge d'erreur",
	h1: "{name} : une horloge en ligne précise à la milliseconde",
	intro:
		"{name} est une horloge en ligne gratuite qui affiche l'heure actuelle à la milliseconde. Au lieu de se fier à l'horloge de cet appareil, elle interroge plusieurs serveurs d'heure indépendants (un serveur périphérique Cloudflare, Akamai, le NICT japonais, timeapi.io et time.now), ne garde que ceux qui concordent et indique de combien l'heure affichée peut au maximum s'écarter de l'heure réelle. Aucune inscription ni installation : elle fonctionne dans tous les fuseaux horaires.",
	howHeading: "Mesurer la dérive d'une caméra et du timecode",
	how1: "Ouvrez cette page sur un écran, choisissez votre fuseau horaire et attendez que les sources concordent et que la marge d'erreur soit faible.",
	how2: "Filmez l'écran avec votre caméra, votre téléphone ou votre enregistreur. Une vitesse d'obturation élevée garde les chiffres nets : chaque image montre alors une seule valeur.",
	how3: "Dans votre logiciel de montage, comparez le timecode d'une image ou l'horodatage du fichier avec l'heure visible sur cette image. Recommencez plus tard dans l'enregistrement : la variation de l'écart est la dérive.",
	boundHeading: "Ce que signifie la marge d'erreur",
	boundBody:
		"La réponse d'un serveur d'heure ne peut se tromper que de la durée de l'aller-retour au maximum : chaque réponse devient donc un intervalle qui doit contenir l'heure réelle. L'horloge retient la plage où le plus d'intervalles se recoupent (algorithme de Marzullo), écarte les serveurs en désaccord et affiche le milieu de cette plage. La valeur ± est une limite stricte, et non une estimation statistique. Elle apprend aussi la vitesse de l'horloge de cet appareil et reste donc précise entre deux vérifications.",
	faqHeading: "Questions fréquentes",
	q1: "Quelle est la précision de cette horloge en ligne ?",
	a1: "Cela dépend de votre réseau. Sur une connexion ordinaire, la marge d'erreur est de quelques millisecondes et s'affiche en direct sur la page. Le retard d'une image d'affichage est compensé automatiquement, et vous pouvez en ajouter dans les Réglages.",
	q2: "Est-elle aussi précise qu'une horloge atomique ?",
	a2: "Les serveurs interrogés suivent l'UTC, que maintiennent des horloges atomiques : la page affiche donc l'heure atomique dans la marge d'erreur indiquée. Les retards de votre écran et de votre caméra ne sont pas inclus dans cette marge.",
	q3: "Pourquoi l'horloge de mon ordinateur ou de mon téléphone est-elle différente ?",
	a3: "Les horloges des appareils dérivent et ne sont corrigées qu'occasionnellement. La page indique de combien l'horloge de cet appareil s'écarte de l'heure réelle et à quelle vitesse elle avance, en parties par million.",
	q4: "Fonctionne-t-elle dans mon fuseau horaire et ma langue ? Est-elle gratuite ?",
	a4: "Oui. Vous pouvez choisir n'importe quel fuseau horaire IANA (comme Asia/Tokyo ou America/New_York), la page est disponible en {languages} langues et elle est gratuite, sans inscription.",
} satisfies SeoMessages;
