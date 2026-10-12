import type { Lang } from "../i18n.ts";
import ar from "./ar.ts";
import bg from "./bg.ts";
import bn from "./bn.ts";
import cs from "./cs.ts";
import da from "./da.ts";
import de from "./de.ts";
import el from "./el.ts";
import en, { type Messages } from "./en.ts";
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

export type { MessageKey, Messages } from "./en.ts";

export const MESSAGES: Record<Lang, Messages> = {
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
