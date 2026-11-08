import type { PieceId } from "./pieces";

export type Caption = { text: string; alt: string | string[] };

export const HASHTAGS = "#kpss #yks #lgs #ales #dgs #sınavahazırlık #dersçalış #puhukoç";

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
};

// caption.txt: post text, hashtags, then the alt text for Instagram's accessibility field.
export function formatCaption(c: Caption): string {
  const alt = Array.isArray(c.alt) ? c.alt.map((a, i) => `${i + 1}. ${a}`).join("\n") : c.alt;
  return `${c.text}\n\n${HASHTAGS}\n\nAlt metin:\n${alt}\n`;
}
