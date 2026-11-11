import type { PieceId } from "./pieces";

export type Caption = { text: string; alt: string | string[]; tags?: string; ad?: { headline: string; button: string } };

export const HASHTAGS = "#kpss #yks #lgs #ales #dgs #sınavahazırlık #dersçalış #puhukoç";
// Feature ads are YKS-heavy (owner, 2026-11-10).
export const SERIES_TAGS = "#yks #tyt #ayt #sınavahazırlık #dersçalış #puhukoç";
// Meta's limit for the headline under an ad creative.
export const AD_HEADLINE_MAX = 40;
const AD_BUTTON = "Daha Fazla Bilgi";

export const CAPTIONS: Partial<Record<PieceId, Caption>> = {
  F1: {
    text: "Puhu düdüğü çaldı: yalnız çalışmak artık yasak. 📣\nMasada yerin hazır, çok yakında puhukoc.com'da.",
    alt: "Mavi zeminde kocaman \"YALNIZ ÇALIŞMAK YASAK!\" yazısı. Hakem Puhu düdük çalıp yanındaki telefonu gösteriyor. Telefonun ekranından dört Puhu'nun birlikte ders çalıştığı masa taşıyor.",
  },
  F2: {
    text: "Sınava çalışmak zor, biliyoruz. 🤯\nO yüzden birlikte çalışıyoruz ve evet, sen de dahilsin. Masada yerin hazır: puhukoc.com",
    alt: "Krem renkli noktalı defter sayfasında \"sınava çalışmak zor. o yüzden birlikte çalışıyoruz.\" yazısı. \"Zor\" kelimesinin önünde şaşkın, uykulu ve elini yüzüne kapatmış üç Puhu çıkartması var. El yazısıyla \"evet, sen de dahilsin.\" notu düşülmüş, alt köşeden bir Puhu göz kırpıyor.",
  },
  F3: {
    text: "Yerini şimdiden ayıralım! 🔦\nPuhuKoç'u senin için hazırlıyoruz. E-postanı bırak, açıldığında ilk sana haber verelim: puhukoc.com",
    alt: "Gece mavisi zeminde, elinde fenerle pencerede sevinçle zıplayan Puhu. Bantlı bir notta el yazısıyla \"Tüm sınavlara tek puhu yeter\" ve altında KPSS, YKS, LGS, ALES, DGS yazıyor. Altta \"Yerini şimdiden ayıralım!\" başlığı.",
  },
  S1: {
    text: "POV: \"son bir video\" dedin, saat 01:47. 🙃\nTelefon zaten elinde, yerini kap: puhukoc.com",
    alt: "Mavi zeminde \"POV: Son bir video dedin.\" yazısı. Puhu bir telefonun üstünden, gözlüğünün üzerinden şüpheyle bakıyor; yanındaki konuşma balonunda \"Kanka, bu 7. son.\" yazıyor. Telefon ekranında \"Yerini kap!\" yazısı ve dört Puhu'nun birlikte çalıştığı masa var.",
  },
  S2: {
    text: "Gece çalışan tek kişi sen değilsin. 🌙\nMasaya otur, birlikte çalışalım: puhukoc.com",
    alt: "Gece şehri, her pencerede masasında çalışan bir Puhu. Üstte \"Gece çalışan tek kişi sen değilsin.\" yazısı, altta bantlı bir notta el yazısıyla \"Masaya otur, birlikte çalışalım!\"",
  },
  S3: {
    text: "Bugünün listesi: üçü tamam, sonuncusu 10 saniye sürüyor. ✅\nYerini ayır: puhukoc.com",
    alt: "Krem renkli noktalı zeminde bantlı bir yapılacaklar listesi. \"2 seans çalış\", \"40 paragraf çöz\" ve \"Puhu'ya haftanı kurdur\" işaretlenip üstü çizilmiş. Son madde \"Yerini ayır\" sarıyla vurgulu ve henüz boş. Altında el yazısıyla \"sonuncusu 10 saniye sürüyor.\" notu ve kitap okuyan bir Puhu var.",
  },
  F4: {
    text: "Puhu'yla bir gün nasıl geçer? Kaydır, gör. 👉\nSabah plan hazır, öğlen masa dolu, akşam haftalık özetin seni bekliyor. Çok yakında puhukoc.com'da.",
    alt: [
      "Mavi zeminde \"Puhu'yla bir gün\" etiketi ve kocaman \"Sabah\" yazısı. \"Puhu günün planını hazırlar. Sen sadece başla.\" Yanında eğik duran telefonda \"Bugün\" listesi ve üç görev, köşede gülen bir Puhu.",
      "Kocaman \"Öğlen\" yazısı. \"Masada 4 kişi. Kimse yalnız çalışmıyor.\" Telefonun ekranından dört Puhu'nun birlikte çalıştığı masa taşıyor, altında odak sayacı.",
      "Kocaman \"Akşam\" yazısı. \"Haftalık özetin hazır. Bu haftaki lakabın: Gizli Kahraman.\" Telefonda haftalık toplam odak süresi, günlük çubuklar ve sarı \"Gizli Kahraman\" kartı; köşede şaşkınlıkla gözlerini açmış bir Puhu.",
      "Kocaman \"İstersen\" yazısı. \"Gerçek bir koç da masana katılır.\" Telefonda koçtan gelen \"Bu hafta harika gidiyorsun.\" mesajı ve \"Teşekkürler!\" cevabı; alt köşeden göz kırpan bir Puhu.",
      "Kocaman sarı \"Yerini kap!\" yazısı, altında puhukoc.com ve @puhukoc. Hakem Puhu yandan fırlayıp düdük çalarak adresi gösteriyor. Köşede \"ÇOK YAKINDA\" etiketi.",
    ],
  },
  F5: {
    text: "Hangi sınava hazırlanıyorsun? Yorumlara yaz, Puhu tek tek sayıyor. 📝\nKPSS, YKS, LGS, ALES, DGS: hepsi aynı masada.",
    alt: "Krem renkli noktalı zeminde \"Hangi sınava hazırlanıyorsun?\" sorusu. Altında KPSS, YKS, LGS, ALES ve DGS yazan beş yuvarlak damga. Papyonlu bir Puhu kanadıyla damgaları gösteriyor, el yazısıyla \"yorumlara yaz, Puhu sayıyor.\" notu var.",
  },
  F6: {
    text: "Tek başına çalışırken ben vs. masada Puhu'larla ben. 😂\nSen hangisisin? Masada yerin hazır: puhukoc.com",
    alt: "İki bantlı kâğıt panel. Solda \"Tek başına çalışırken ben:\" yazısı ve gece takkeli, elinde kahveyle bitkin Puhu. Sağda \"Masada Puhu'larla ben:\" yazısı ve gülmekten gözleri yaşaran Puhu.",
  },
  S4: {
    text: "Gece kuşu musun, sabahçı mı? 🦉☀️\nAnkete bas, masada iki tipe de yer var: puhukoc.com",
    alt: "Çapraz ikiye bölünmüş Story. Üstte gece mavisi yarıda \"Sen hangi çalışma tipisin?\" sorusu ve gece takkeli, elinde kahve kupasıyla gözlerini kocaman açmış Puhu, etiketi \"Gece kuşu\". Altta mavi yarıda heyecandan gözlüğü havaya uçan Puhu, etiketi \"Sabahçı\".",
  },
  X1: {
    text: "Yalnız çalışmak yasak. 📣\nKPSS, YKS, LGS, ALES, DGS: masada yerin hazır, çok yakında puhukoc.com",
    alt: "Mavi zeminde \"YALNIZ ÇALIŞMAK YASAK!\" yazısı. Sağda hakem Puhu düdük çalıp eğik duran telefonu gösteriyor; telefonun ekranından dört Puhu'nun birlikte çalıştığı masa taşıyor.",
  },
  L1: {
    text: "Sınava birlikte hazırlanmak daha kolay.\nPuhuKoç; KPSS, YKS, LGS, ALES ve DGS'ye hazırlananlar için günlük plan, birlikte çalışma masası ve haftalık özet sunar. Çok yakında: puhukoc.com",
    alt: "Gece mavisi zeminde solda \"Sınava birlikte hazırlanmak daha kolay.\" başlığı ve kısa bir açıklama. Sağda elinde fenerle pencerede sevinçle zıplayan Puhu.",
  },
  R1: {
    text: "POV: \"son bir video\" dedin. Kanka, bu 7. son. 🙃\nTelefon zaten elinde, yerini kap: puhukoc.com",
    alt: "Mavi zeminde \"POV: Son bir video dedin.\" yazısı beliriyor. Alttan bir telefon fırlıyor, arkasından Puhu gözlüğünün üzerinden bakıyor ve \"Kanka, bu 7. son.\" balonu sallanarak çıkıyor. Telefondaki video ekranı PuhuKoç ekranına dönüyor ve \"Yerini kap!\" yazısının altı sarıyla çiziliyor. Sonda PuhuKoç logosu, puhukoc.com ve \"ÇOK YAKINDA\" etiketi.",
  },
  R2: {
    text: "Masaya biri geldi, sonra biri daha. 🪑\nYalnız çalışmak yasak, sana da yer var: puhukoc.com",
    alt: "Mavi zeminde \"Masada 0 kişi\" etiketi. Dört Puhu tek tek beliriyor, sayaç her gelişte bir artıp 4'e çıkıyor. Ardından dört Puhu'nun birlikte çalıştığı masa ekrana oturuyor ve \"YALNIZ ÇALIŞMAK YASAK!\" yazısı damgalanıyor. Sonda PuhuKoç logosu, puhukoc.com ve \"ÇOK YAKINDA\" etiketi.",
  },
  R3: {
    text: "KPSS, YKS, LGS, ALES, DGS. Hangisi senin? 📝\nYorumlara yaz, Puhu tek tek sayıyor. Hepsi aynı masada: puhukoc.com",
    alt: "Krem renkli noktalı zeminde KPSS, YKS, LGS, ALES ve DGS yazan beş yuvarlak damga ritimle basılıyor. Altlarında şaşkın, uykulu ve elini yüzüne kapatmış üç Puhu çıkartması beliriyor. Ardından \"Hangisi senin?\" sorusu ve el yazısıyla \"Yorumlara yaz.\" notu geliyor. Sonda PuhuKoç logosu, puhukoc.com ve \"ÇOK YAKINDA\" etiketi.",
  },
  // Premium: the post says no date, the caption does (captions can be edited after launch).
  PF1: {
    text: "Kahraman modu: açık. 🦸\nPuhu artık yapay zekâ koçun: takıldığın an yaz, cevap hemen gelsin. Premium çok yakında: puhukoc.com",
    alt: "Krem zeminde kocaman \"KAHRAMAN MODU\" yazısı; \"O\" harfi altın renginde ve ondan aşağı bir ışık iniyor. Işığın içinde maskeli, pelerinli kahraman Puhu elleri belinde duruyor, yanında \"AÇIK\" yazan sarı bir düğme var. Altta \"Süper gücü yapay zekâ: AÇIK.\" yazısı ve puhukoc.com.",
  },
  PF2: {
    text: "Puhu’ya pelerin geldi! ✨\nYapay zekâ koçun Puhu Premium’la geliyor: takıldığın an yaz, cevap hemen gelsin. Çok yakında: puhukoc.com",
    alt: "Gece mavisi zeminde \"Puhu’ya pelerin geldi!\" başlığı. Maskeli ve pelerinli Puhu yumruğu önde uçuyor, arkasında altın kenarlı mavi bir kuyruk ve parıltılar var. Köşede PREMIUM etiketi ve puhukoc.com.",
  },
  PS1: {
    text: "Kahraman modu: açık. 🦸\nPremium çok yakında: puhukoc.com",
    alt: "Krem zeminde kocaman \"KAHRAMAN MODU\" yazısı ve altın renkli \"O\" harfinden inen ışık. Işığın içinde maskeli, pelerinli kahraman Puhu elleri belinde duruyor; yanında \"AÇIK\" düğmesi ve \"ÇOK YAKINDA\" etiketi var. Altta \"Süper gücü yapay zekâ: AÇIK.\" yazısı.",
  },
  PS2: {
    text: "Puhu’ya pelerin geldi! ✨\nPremium çok yakında: puhukoc.com",
    alt: "Gece mavisi zeminde \"Puhu’ya pelerin geldi!\" başlığı. Maskeli ve pelerinli Puhu altın kenarlı mavi bir kuyrukla uçuyor. Altta \"ÇOK YAKINDA\" etiketi.",
  },
  PR1: {
    text: "Kahraman modu: açık. 🦸\nSüper gücü yapay zekâ: zor soruda çağır, Puhu saniyesinde yanında. Premium çok yakında: puhukoc.com",
    alt: "Krem zeminde bir ışık huzmesi. Maskeli, pelerinli Puhu çömeliyor, tavana fırlıyor ve \"KAHRAMAN MODU\" yazısı damgalanırken ışığın içine kahraman gibi iniyor. Yanında \"AÇIK\" düğmesi beliriyor, altta \"Süper gücü yapay zekâ: AÇIK.\" yazısı. Sonda kahraman Puhu, PuhuKoç logosu, puhukoc.com ve PREMIUM etiketi.",
  },
  PR2: {
    text: "Puhu’ya pelerin geldi! 🦸\nSorunu Puhu’ya sor, her gün ondan bir not al, haftanı ona kurdur. Premium çok yakında: puhukoc.com",
    alt: "Gece mavisi zeminde \"Puhu’ya pelerin geldi!\" yazısı damgalanıyor. Maskeli, pelerinli Puhu sol alttan altın kenarlı mavi bir kuyrukla uçarak giriyor. Sırayla \"Sorunu Puhu’ya sor\", \"Her güne Puhu’dan not\" ve \"Haftanı Puhu kursun\" etiketleri beliriyor. Sonda kahraman Puhu, PuhuKoç logosu, puhukoc.com ve PREMIUM etiketi.",
  },
  T1: {
    text: "“Son bir video” dedin, Puhu seni içeri çekti. 📱\nPlanla, odaklan, Puhu ile çalış: puhukoc.com",
    alt: "Gece, telefonda bir video oynuyor ve \"“Son bir video” dedin.\" yazısı damgalanıyor. Puhu'dan \"Kanka, bu 7. son.\" bildirimi düşüyor. Papyonlu Puhu ekrandan çıkıp el ediyor ve ekrana dalıyor; kamera onu izliyor. Mavi dünyada sınav etiketleri, meslek Puhu'larıyla dolan bir çıkartma albümü ve Kodcu Puhu'nun yapıştığı bir hedef panosu. \"PLANLA\": gece şehrin üstünde Puhu sihirli değneğiyle haftalık plan kartları çıkarıyor, kartlar telefondaki gerçek plan ekranına uçuyor. \"ODAKLAN\": çalışma odaları sırayla geçiyor, Puhu kitabını bitirip seviniyor, yanlış soru defterinin sayfaları dönüyor. \"BİRLİKTE\": dört Puhu aynı masada çak yapıyor, toplulukta soru ve cevaplar beliriyor. Gece bir haftalık sandık açılıyor, içinden \"Odak Makinesi\" lakap kartı çıkıyor ve ışığı bir apartmanın karanlık penceresini yakıyor. İçeride Puhu izleyiciyi gösteriyor. Sonda \"PLANLA. ODAKLAN. PUHU İLE.\", PuhuKoç logosu, puhukoc.com ve beş sınav.",
  },
  // Feature ads, wave 1. `ad` is for paid use: the headline under the creative and the button.
  IF1: {
    text: "Bildirimler sıraya girsin, şimdi olmaz. ✋\nSeansı başlat, 25 dakika kapıda Puhu var: puhukoc.com",
    alt: "Mavi zeminde kocaman \"ŞİMDİ OLMAZ, ÇALIŞIYOR!\" yazısı. Takım elbiseli, kulaklıklı koruma Puhu kanadını dur işareti gibi uzatmış; üç bildirim simgesi kanadına çarpıp sekiyor. Yanında 25:00'ı gösteren odak seansı sayacı.",
    tags: SERIES_TAGS,
    ad: { headline: "25 dakika kapıda Puhu var", button: AD_BUTTON },
  },
  IF2: {
    text: "Rotan hazır, yola çık! 🧭\nHaftanı Puhu kursun, sen sadece ilk durağa git: puhukoc.com",
    alt: "Mavi zeminde \"ROTAN HAZIR, YOLA ÇIK!\" yazısı. Kaptan şapkalı Puhu bir kanadında harita tutuyor, diğeriyle ileriyi gösteriyor. Yanındaki kartta haftanın üç durağı: pazartesi Paragraf, salı Problemler, çarşamba Geometri.",
    tags: SERIES_TAGS,
    ad: { headline: "Haftanı Puhu kursun", button: AD_BUTTON },
  },
  IF3: {
    text: "Yanlışların kaçamaz! 🔍\nYanlış yaptığın soru deftere düşer, tekrar günü gelince karşına çıkar: puhukoc.com",
    alt: "Mavi zeminde \"YANLIŞLARIN KAÇAMAZ!\" yazısı. Dedektif şapkalı Puhu büyüteçle bakıyor, bir gözü mercekte kocaman görünüyor. Yanında bantlı bir \"ARANIYOR: işlem hatası\" kâğıdı ve bir denklem.",
    tags: SERIES_TAGS,
    ad: { headline: "Yanlış soruların tek defterde", button: AD_BUTTON },
  },
  IF4: {
    text: "Haftanın net durumu: Paragraf yerinde, sıradaki Geometri. ⛅\nDenemeni gir, sıradaki konunu tek bakışta gör: puhukoc.com",
    alt: "Mavi zeminde \"HAFTANIN NET DURUMU!\" yazısı. Lacivert ceketli hava durumu spikeri Puhu çubuğuyla yanındaki tabloyu gösteriyor. Tabloda Geometri sıradaki, Problemler tekrar ister, Paragraf yerinde.",
    tags: SERIES_TAGS,
    ad: { headline: "Denemeni gir, sıradaki konunu gör", button: AD_BUTTON },
  },
  IF5: {
    text: "Puhu iş başında: bugün hakem. 📣\nYalnız çalışmak yasak, masada yerin hazır: puhukoc.com",
    alt: "Mavi zeminde kocaman \"YALNIZ ÇALIŞMAK YASAK!\" yazısı ve \"PUHU İŞ BAŞINDA\" etiketi. Hakem Puhu düdük çalıp yanındaki telefonu gösteriyor. Telefonun ekranından dört Puhu'nun birlikte ders çalıştığı masa taşıyor.",
    tags: SERIES_TAGS,
    ad: { headline: "Masada yerin hazır", button: AD_BUTTON },
  },
  IF6: {
    text: "Ve bu haftaki lakabın… 🥁\nHafta bitince Puhu sana bir lakap takar. Seninki ne olur, yorumlara yaz.",
    alt: "Mavi zeminde \"VE BU HAFTAKİ LAKABIN…\" yazısı. Papyonlu sunucu Puhu kanatlarını açmış; yanındaki altın çerçeveli kartta ateş kanatlı bir Puhu ve \"Korkusuz Denemeci\" lakabı var.",
    tags: SERIES_TAGS,
    ad: { headline: "Bu haftaki lakabın ne olacak?", button: AD_BUTTON },
  },
  IS1: {
    text: "POV: \"bir bildirime bakıp çıkacağım\" dedin. 🙃\nSeansı başlat, kapıda Puhu var: puhukoc.com",
    alt: "Mavi zeminde \"POV: Bir bildirime bakıp çıkacağım dedin.\" yazısı. Elini yüzüne kapatmış Puhu'nun konuşma balonunda \"Kanka, 40 dakika oldu.\" yazıyor. Alttaki kartta \"Seans hazır!\" başlığı ve 25:00 odak seansı satırı.",
    tags: SERIES_TAGS,
    ad: { headline: "Seansı başlat, kapıda Puhu var", button: AD_BUTTON },
  },
  IS2: {
    text: "POV: \"pazartesi başlıyorum\" dedin, bugün pazartesi. 😌\nHaftan hazır, Puhu kurdu bile: puhukoc.com",
    alt: "Mavi zeminde \"POV: Pazartesi başlıyorum dedin.\" yazısı. Puhu gözlüğünün üzerinden şüpheyle bakıyor; konuşma balonunda \"Kanka, bugün pazartesi.\" yazıyor. Alttaki \"Haftan hazır!\" kartında pazartesi Paragraf, salı Problemler, çarşamba Geometri.",
    tags: SERIES_TAGS,
    ad: { headline: "Haftan hazır, Puhu kurdu bile", button: AD_BUTTON },
  },
  IS3: {
    text: "POV: \"bu soruya sonra bakarım\" dedin. 🔍\nPuhu deftere yazdı, tekrar günü karşına çıkacak: puhukoc.com",
    alt: "Mavi zeminde \"POV: Bu soruya sonra bakarım dedin.\" yazısı. Dedektif Puhu büyüteciyle bakıyor; konuşma balonunda \"Kanka, deftere yazdım.\" yazıyor. Önünde çizgili bir defter sayfası: bantla yapıştırılmış \"3x − 5 = 2x + 4 ise x kaçtır?\" sorusu ve altında kırmızı kalemle \"işlem hatası!\" notu, onun da altında yeşil \"ÇÖZDÜM\" damgası.",
    tags: SERIES_TAGS,
    ad: { headline: "Yanlış soruların artık kaybolmaz", button: AD_BUTTON },
  },
  IS4: {
    text: "POV: \"hangi konudan başlasam?\" dedin. 🤔\nDenemeni gir, sıradaki konun hazır: puhukoc.com",
    alt: "Mavi zeminde \"POV: Hangi konudan başlasam? dedin.\" yazısı. Hava durumu spikeri Puhu çubuğuyla gösteriyor; konuşma balonunda \"Kanka, sıradaki Geometri.\" yazıyor. Alttaki \"Deneme analizi\" kartında Geometri sıradaki, Problemler tekrar ister, Paragraf yerinde.",
    tags: SERIES_TAGS,
    ad: { headline: "Sıradaki konun hazır", button: AD_BUTTON },
  },
  IS5: {
    text: "POV: \"kütüphaneye gidince çalışırım\" dedin. 📚\nKütüphane cebinde, masada 4 kişi var: puhukoc.com",
    alt: "Mavi zeminde \"POV: Kütüphaneye gidince çalışırım dedin.\" yazısı. Hakem Puhu düdük çalıyor; konuşma balonunda \"Kanka, kütüphane cebinde.\" yazıyor. Altta lamba ışığında dört Puhu'nun birlikte çalıştığı büyük bir masa ve \"Masada 4 kişi\" etiketi.",
    tags: SERIES_TAGS,
    ad: { headline: "Kütüphane cebinde, masan hazır", button: AD_BUTTON },
  },
  IS6: {
    text: "POV: \"bu hafta hiçbir şey yapmadım\" sandın. 🏆\n5 gün masadaydın, lakabın hazır: puhukoc.com",
    alt: "Mavi zeminde \"POV: Bu hafta hiçbir şey yapmadım sandın.\" yazısı. Papyonlu Puhu kanatlarını açmış seviniyor; konuşma balonunda \"Kanka, 5 gün masadaydın.\" yazıyor. Önünde altın çerçeveli lakap kartı: ışıklı saat halkaları içinde pelerinli Puhu, \"Seri Canavarı\" ve \"5 gün üst üste! Seriyi hiç bırakmadın.\"",
    tags: SERIES_TAGS,
    ad: { headline: "5 gün masadaydın, lakabın hazır", button: AD_BUTTON },
  },
  IR1: {
    text: "Tam çalışacaktın, bildirimler üşüştü. Puhu: DUR! ✋\nSeansı başlat, 25 dakika kapıda Puhu var: puhukoc.com",
    alt: "Mavi zeminde \"Tam çalışacaktın…\" yazısı ve 25:00 sayacının çevresine üşüşen bildirim simgeleri. Koruma Puhu kanadını kameraya uzatıp kadraja giriyor, \"DUR!\" yazısı damgalanıyor ve simgeler savruluyor. Ardından \"ŞİMDİ OLMAZ, ÇALIŞIYOR!\" ve işleyen sayaç. Sonda koruma Puhu, PuhuKoç logosu, puhukoc.com ve \"Kapıda Puhu var!\".",
    tags: SERIES_TAGS,
    ad: { headline: "25 dakika kapıda Puhu var", button: AD_BUTTON },
  },
};

// caption.txt: post text, hashtags, the alt text for Instagram's accessibility field, then the paid fields.
export function formatCaption(c: Caption): string {
  const alt = Array.isArray(c.alt) ? c.alt.map((a, i) => `${i + 1}. ${a}`).join("\n") : c.alt;
  const ad = c.ad ? `\nReklam başlığı: ${c.ad.headline}\nButon: ${c.ad.button}\n` : "";
  return `${c.text}\n\n${c.tags ?? HASHTAGS}\n\nAlt metin:\n${alt}\n${ad}`;
}
