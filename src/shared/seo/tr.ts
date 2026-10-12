import type { SeoMessages } from "./en.ts";

export default {
	title: "Milisaniyeli saat – tam saat ve saat kontrolü | {name}",
	description:
		"Milisaniyeli ücretsiz online saat. Birden çok atom saati sunucusuyla senkron, garantili hata sınırlı tam saat. Kameraya çekip zaman kodu kaymasını ölçün.",
	ogImageAlt: "{name}: hata sınırını gösteren büyük bir milisaniyeli saat",
	h1: "{name}: milisaniyesine kadar doğru online saat",
	intro:
		"{name}, o anki saati milisaniye hassasiyetiyle gösteren ücretsiz bir online saattir. Bu cihazın saatine güvenmek yerine birbirinden bağımsız birkaç zaman sunucusuna (bir Cloudflare uç sunucusu, Akamai, Japonya'nın NICT'si, timeapi.io ve time.now) sorar, yalnızca uyuşanları tutar ve gösterilen saatin en fazla ne kadar sapabileceğini bildirir. Üyelik ya da kurulum gerekmez; her saat diliminde çalışır.",
	howHeading: "Kamera ve zaman kodu kaymasını ölçme",
	how1: "Bu sayfayı bir ekranda açın, saat diliminizi seçin ve kaynaklar uyuşup hata sınırı küçülene kadar bekleyin.",
	how2: "Ekranı kameranız, telefonunuz veya kayıt cihazınızla çekin. Hızlı bir deklanşör hızı rakamları net tutar; böylece her karede tek bir değer görünür.",
	how3: "Düzenleme programınızda bir karenin zaman kodunu veya dosya zaman damgasını, o karede görünen saatle karşılaştırın. Kaydın ilerleyen bir yerinde de aynısını yapın: farktaki değişim kaymadır.",
	boundHeading: "Hata sınırı ne demek?",
	boundBody:
		"Bir zaman sunucusunun yanıtı, gidiş-dönüş süresinden fazla yanlış olamaz; bu yüzden her yanıt, gerçek saati mutlaka içeren bir aralığa dönüşür. Saat, en çok aralığın üst üste bindiği bölgeyi seçer (Marzullo algoritması), uyuşmayan sunucuları eler ve bu bölgenin ortasını gösterir. ± değeri istatistiksel bir tahmin değil, kesin bir sınırdır. Saat ayrıca bu cihazın saatinin ne kadar hızlı işlediğini öğrenir; böylece kontroller arasında da doğru saati korur.",
	faqHeading: "Sık sorulan sorular",
	q1: "Bu online saat ne kadar doğru?",
	a1: "Ağınıza bağlıdır. Tipik bir bağlantıda hata sınırı birkaç milisaniyedir ve sayfada canlı olarak gösterilir. Bir karelik görüntüleme gecikmesi otomatik telafi edilir; Ayarlar'dan daha fazlasını ekleyebilirsiniz.",
	q2: "Atom saati kadar doğru mu?",
	a2: "Sorguladığı sunucular, atom saatleriyle tutulan UTC'yi izler; dolayısıyla sayfa, gösterilen hata sınırı içinde atom saatini gösterir. Ekranınızın ve kameranızın gecikmeleri bu sınıra dahil değildir.",
	q3: "Bilgisayarımın veya telefonumun saati neden farklı?",
	a3: "Cihaz saatleri kayar ve yalnızca arada bir düzeltilir. Sayfa, bu cihazın saatinin gerçek saatten ne kadar uzakta olduğunu ve ne kadar hızlı işlediğini milyonda bir (ppm) olarak gösterir.",
	q4: "Saat dilimimde ve dilimde çalışır mı? Ücretsiz mi?",
	a4: "Evet. Herhangi bir IANA saat dilimini (örneğin Asia/Tokyo veya America/New_York) seçebilirsiniz, sayfa {languages} dilde sunulur ve üyelik gerektirmeden ücretsizdir.",
} satisfies SeoMessages;
