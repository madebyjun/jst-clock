import type { SeoMessages } from "./en.ts";

export default {
	title: "Jam Online Milidetik & Cek Sinkronisasi Waktu | {name}",
	description:
		"Jam online gratis dengan milidetik, disinkronkan ke beberapa server waktu atom dengan batas galat. Rekam layar untuk mengukur drift timecode kamera.",
	ogImageAlt: "{name}: jam milidetik besar dengan batas galatnya",
	h1: "{name}: jam online yang akurat hingga milidetik",
	intro:
		"{name} adalah jam online gratis yang menampilkan waktu saat ini hingga milidetik. Alih-alih memercayai jam perangkat ini, situs menanyakan beberapa server waktu independen (server edge Cloudflare, Akamai, NICT Jepang, timeapi.io, dan time.now), hanya memakai yang hasilnya sepakat, lalu memberi tahu seberapa jauh waktu yang ditampilkan mungkin meleset. Tanpa pendaftaran atau instalasi, dan berfungsi di zona waktu mana pun.",
	howHeading: "Mengukur selisih kamera dan timecode",
	how1: "Buka halaman ini di layar, pilih zona waktu, lalu tunggu hingga sumber waktu sepakat dan batas galat menjadi kecil.",
	how2: "Rekam layar dengan kamera, ponsel, atau perekam. Kecepatan rana yang tinggi menjaga angka tetap tajam sehingga setiap frame menampilkan satu nilai.",
	how3: "Di perangkat lunak penyuntingan, bandingkan timecode atau stempel waktu berkas pada sebuah frame dengan waktu yang terlihat di frame itu. Lakukan lagi di bagian rekaman yang lebih akhir: perubahan selisihnya adalah drift.",
	boundHeading: "Arti batas galat",
	boundBody:
		"Jawaban server waktu paling banyak meleset sebesar waktu pulang-pergi, sehingga setiap jawaban menjadi interval yang pasti memuat waktu sebenarnya. Jam mengambil rentang tempat paling banyak interval yang bertumpuk (algoritma Marzullo), membuang server yang tidak sepakat, dan menampilkan titik tengah rentang itu. Nilai ± adalah batas mutlak, bukan perkiraan statistik. Jam ini juga mempelajari seberapa cepat jam perangkat berjalan, sehingga tetap akurat di antara pengecekan.",
	faqHeading: "Pertanyaan yang sering diajukan",
	q1: "Seberapa akurat jam online ini?",
	a1: "Tergantung jaringan Anda. Pada koneksi umum, batas galat hanya beberapa milidetik dan ditampilkan langsung di halaman. Tundaan tampilan satu frame dikompensasi otomatis, dan Anda dapat menambahkannya di Pengaturan.",
	q2: "Apakah seakurat jam atom?",
	a2: "Server yang diperiksa mengikuti UTC, yang dijaga oleh jam atom, sehingga halaman menampilkan waktu atom dalam batas galat yang ditampilkan. Tundaan pada layar dan kamera tidak termasuk dalam batas tersebut.",
	q3: "Mengapa jam komputer atau ponsel saya berbeda?",
	a3: "Jam perangkat melenceng seiring waktu dan hanya dikoreksi sesekali. Halaman ini menunjukkan seberapa jauh jam perangkat ini dari waktu sebenarnya dan seberapa cepat jalannya, dalam bagian per juta (ppm).",
	q4: "Apakah tersedia untuk zona waktu dan bahasa saya? Apakah gratis?",
	a4: "Ya. Anda dapat memilih zona waktu IANA mana pun (seperti Asia/Tokyo atau America/New_York), halaman tersedia dalam {languages} bahasa, dan gratis tanpa pendaftaran.",
} satisfies SeoMessages;
