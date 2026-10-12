import type { Lang } from "../i18n.ts";
import ar from "./ar.ts";
import bg from "./bg.ts";
import bn from "./bn.ts";
import cs from "./cs.ts";
import da from "./da.ts";
import de from "./de.ts";
import el from "./el.ts";
import en, { type SeoMessages } from "./en.ts";
import es from "./es.ts";
import fa from "./fa.ts";
import fi from "./fi.ts";
import fr from "./fr.ts";
import he from "./he.ts";
import hi from "./hi.ts";
import hu from "./hu.ts";
import id from "./id.ts";
import it from "./it.ts";
import ja from "./ja.ts";
import ko from "./ko.ts";
import nb from "./nb.ts";
import nl from "./nl.ts";
import pl from "./pl.ts";
import ptBR from "./pt-BR.ts";
import ptPT from "./pt-PT.ts";
import ro from "./ro.ts";
import ru from "./ru.ts";
import sk from "./sk.ts";
import sv from "./sv.ts";
import th from "./th.ts";
import tr from "./tr.ts";
import uk from "./uk.ts";
import ur from "./ur.ts";
import vi from "./vi.ts";
import zhCN from "./zh-CN.ts";
import zhTW from "./zh-TW.ts";

export type { SeoKey, SeoMessages } from "./en.ts";

export const SEO: Record<Lang, SeoMessages> = {
	en,
	ja,
	"zh-CN": zhCN,
	"zh-TW": zhTW,
	ko,
	es,
	fr,
	de,
	it,
	"pt-BR": ptBR,
	"pt-PT": ptPT,
	ru,
	uk,
	pl,
	nl,
	sv,
	da,
	nb,
	fi,
	cs,
	sk,
	hu,
	ro,
	bg,
	el,
	tr,
	id,
	vi,
	th,
	hi,
	bn,
	ar,
	he,
	fa,
	ur,
};

/** 言語タグから機械的に作らないのは、og:locale が「言語_地域」の形しか受け付けず、地域のないタグ（ja・ar など）には主な地域を選ぶ必要があるため */
export const OG_LOCALE: Record<Lang, string> = {
	en: "en_US",
	ja: "ja_JP",
	"zh-CN": "zh_CN",
	"zh-TW": "zh_TW",
	ko: "ko_KR",
	es: "es_ES",
	fr: "fr_FR",
	de: "de_DE",
	it: "it_IT",
	"pt-BR": "pt_BR",
	"pt-PT": "pt_PT",
	ru: "ru_RU",
	uk: "uk_UA",
	pl: "pl_PL",
	nl: "nl_NL",
	sv: "sv_SE",
	da: "da_DK",
	nb: "nb_NO",
	fi: "fi_FI",
	cs: "cs_CZ",
	sk: "sk_SK",
	hu: "hu_HU",
	ro: "ro_RO",
	bg: "bg_BG",
	el: "el_GR",
	tr: "tr_TR",
	id: "id_ID",
	vi: "vi_VN",
	th: "th_TH",
	hi: "hi_IN",
	bn: "bn_BD",
	ar: "ar_AR",
	he: "he_IL",
	fa: "fa_IR",
	ur: "ur_PK",
};
