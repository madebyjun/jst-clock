/** 検索結果での表示幅の近似。全角相当（CJK・かな・ハングル・全角記号）は欧文の約2倍の幅なので2と数える */
export function displayLength(s: string) {
	let n = 0;
	for (const ch of s) n += /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
	return n;
}

export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 155;
