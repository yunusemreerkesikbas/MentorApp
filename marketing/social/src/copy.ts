import type { PieceId } from "./pieces";

// Premium: flip this once Premium can be bought. Feed corners and the reel's closing tag become the
// trial sticker, stories swap ÇOK YAKINDA for it. No price anywhere (owner, 2026-11-08).
export const PREMIUM_SALE_OPEN = false;

const PREMIUM_SHARED = { pill: "PREMIUM", site: "puhukoc.com", trial: "7 GÜN ÜCRETSİZ DENE" };
// Direction 1 · Kahraman modu (canvas P-Isik).
const KAHRAMAN = {
  ...PREMIUM_SHARED,
  head1: "KAHRAMAN",
  // The second letter is drawn gold.
  head2: "MODU",
  toggle: "AÇIK",
  line1: "Süper gücü yapay zekâ: AÇIK.",
  line2: "Zor soruda çağır, Puhu saniyesinde yanında.",
  altPuhu: "Maskeli ve pelerinli kahraman Puhu ellerini beline koymuş, kendinden emin gülümsüyor",
};
// Direction 2 · Gece uçuşu (canvas P-Gece).
const PELERIN = {
  ...PREMIUM_SHARED,
  head1: "Puhu’ya",
  head2: "pelerin geldi!",
  body: "Süper gücü: yapay zekâ. Takıldığın an çağır, imdadına yetişsin.",
  altPuhu: "Maskeli ve pelerinli Puhu yumruğu önde, arkasında parıltı iziyle uçuyor",
};

// Feature ads: what every "Puhu iş başında" feed and every POV story shares.
const SERIES = { pill: "PUHU İŞ BAŞINDA", site: "puhukoc.com", handle: "@puhukoc" };
const POV = { pov: "POV:", kanka1: "Kanka,", dedin: "dedin." };
// The sample week Puhu builds (IF2's route card, IS2's plan card).
const WEEK = {
  row1Tag: "Pzt", row1: "Paragraf", row1Meta: "25 dk",
  row2Tag: "Sal", row2: "Problemler", row2Meta: "40 dk",
  row3Tag: "Çar", row3: "Geometri", row3Meta: "30 dk",
};

// The sample deneme reading (IF4's forecast board, IS4's card): the app's own words for a topic's state.
const FORECAST = {
  row1: "Geometri", row1Meta: "sıradaki",
  row2: "Problemler", row2Meta: "tekrar ister",
  row3: "Paragraf", row3Meta: "yerinde",
};

// Every visible string, per piece. Edit copy here and re-render.
export const COPY: Partial<Record<PieceId, Record<string, string>>> = {
  F1: {
    badge: "ÇOK YAKINDA",
    head1: "YALNIZ",
    head2: "ÇALIŞMAK",
    punch: "YASAK!",
    exams: "KPSS · YKS · LGS · ALES · DGS",
    timer: "18:42",
    timerLabel: "odak",
    site: "puhukoc.com",
    handle: "@puhukoc",
    altMasa: "Dört Puhu masa başında birlikte çalışıyor, telefonun ekranından taşıyor",
    altPuhu: "Hakem Puhu düdük çalıp telefonu gösteriyor",
  },
  F2: {
    line1: "sınava çalışmak",
    line2: "zor.",
    line3: "o yüzden",
    line4: "birlikte",
    line5: "çalışıyoruz.",
    note1: "evet, sen de",
    note2: "dahilsin.",
    footer: "puhukoc.com · @puhukoc",
    altPuhu: "Puhu alt kenardan göz kırpıyor",
  },
  F3: {
    badge: "ÇOK YAKINDA",
    // The owner's own wording, kept as written (lowercase "puhu").
    note: "Tüm sınavlara tek puhu yeter",
    exams: "KPSS · YKS · LGS · ALES · DGS",
    head: "Yerini şimdiden",
    punch: "ayıralım!",
    body: "PuhuKoç'u senin için hazırlıyoruz. E-postanı bırak, açıldığında ilk sana haber verelim.",
    handle: "@puhukoc",
    altPuhu: "Puhu elinde fenerle pencerede sevinçle zıplıyor",
  },
  S1: {
    pov: "POV:",
    head: "“Son bir video”",
    dedin: "dedin.",
    kanka1: "Kanka,",
    kanka2: "bu 7. son.",
    clock: "01:47",
    line1: "Telefon zaten elinde.",
    cta: "Yerini kap!",
    altPeek: "Puhu telefonun üstünden, gözlüğünün üzerinden şüpheyle bakıyor",
    altMasa: "Dört Puhu masa başında birlikte çalışıyor",
  },
  S2: {
    head1: "Gece çalışan",
    head2: "tek kişi",
    punch: "sen değilsin.",
    note: "Masaya otur, birlikte çalışalım!",
    altCity: "Gece şehrinde her pencerede masasında çalışan bir Puhu",
  },
  S3: {
    title: "bugünün listesi",
    item1: "2 seans çalış",
    item2: "40 paragraf çöz",
    item3: "Puhu'ya haftanı kurdur",
    item4: "Yerini ayır",
    footnote: "sonuncusu 10 saniye sürüyor.",
    altPuhu: "Puhu kitap okuyor",
  },
  F4: {
    title: "Puhu'yla bir gün",
    c1Time: "Sabah",
    c1Line: "Puhu günün planını hazırlar. Sen sadece başla.",
    c2Time: "Öğlen",
    c2Line: "Masada 4 kişi. Kimse yalnız çalışmıyor.",
    c3Time: "Akşam",
    c3Line: "Haftalık özetin hazır. Bu haftaki lakabın: Gizli Kahraman.",
    c4Time: "İstersen",
    c4Line: "Gerçek bir koç da masana katılır.",
    c5Head: "Yerini kap!",
    c5Badge: "ÇOK YAKINDA",
    c5Site: "puhukoc.com",
    c5Handle: "@puhukoc",
    c5Exams: "KPSS · YKS · LGS · ALES · DGS",
    c5Alt: "Hakem Puhu düdük çalıp puhukoc.com adresini gösteriyor",
    c1Alt: "Papyonlu Puhu kanadını açmış, telefondaki planı gösteriyor",
    c3Alt: "Puhu lakabını görünce şaşkınlıkla gözlerini kocaman açıyor",
    c4Alt: "Puhu alt kenardan göz kırpıyor",
    s1Title: "Bugün",
    s1Chip: "Puhu planını hazırladı",
    s1Row1: "2 seans çalış",
    s1Row2: "40 paragraf çöz",
    s1Row3: "10 dk tekrar",
    s3Title: "Bu hafta",
    s3Total: "6 sa 40 dk",
    s3TotalLabel: "toplam odak",
    s3NickLabel: "Bu haftaki lakabın",
    s3Nick: "Gizli Kahraman",
    s4Title: "Koçum",
    s4From: "Koçun",
    s4Message: "Bu hafta harika gidiyorsun.",
    s4Reply: "Teşekkürler!",
  },
  F5: {
    q1: "Hangi sınava",
    q2: "hazırlanıyorsun?",
    note: "yorumlara yaz, Puhu sayıyor.",
    footer: "puhukoc.com · @puhukoc",
    altPuhu: "Papyonlu Puhu kanadıyla sınav rozetlerini gösteriyor",
  },
  F6: {
    left: "Tek başına çalışırken ben:",
    right: "Masada Puhu'larla ben:",
    footer: "puhukoc.com · @puhukoc",
    altLeft: "Gece takkeli, elinde kahveyle bitkin ve şaşkın Puhu",
    altRight: "Gülmekten gözleri yaşaran mutlu Puhu",
  },
  S4: {
    q1: "Sen hangi",
    q2: "çalışma tipisin?",
    night: "Gece kuşu",
    day: "Sabahçı",
    pollGuide: "Anket çıkartması buraya",
    altNight: "Gece takkeli Puhu elinde kahve kupasıyla gözlerini kocaman açmış",
    altDay: "Heyecandan gözlüğü havaya uçan Puhu",
  },
  X1: {
    badge: "ÇOK YAKINDA",
    head1: "YALNIZ",
    head2: "ÇALIŞMAK",
    punch: "YASAK!",
    exams: "KPSS · YKS · LGS · ALES · DGS",
    site: "puhukoc.com",
    handle: "@puhukoc",
    altPuhu: "Hakem Puhu düdük çalıp telefonu gösteriyor",
  },
  R2: {
    head1: "YALNIZ",
    head2: "ÇALIŞMAK",
    punch: "YASAK!",
    altSeat: "Bir Puhu daha masaya katılıyor",
    altMasa: "Dört Puhu masa başında birlikte çalışıyor",
  },
  R3: {
    question: "Hangisi senin?",
    note: "Yorumlara yaz.",
    altStickers: "Şaşkın, uykulu ve elini yüzüne kapatmış Puhu çıkartmaları",
  },
  L1: {
    title: "Sınava birlikte hazırlanmak daha kolay.",
    body: "PuhuKoç; KPSS, YKS, LGS, ALES ve DGS'ye hazırlananlar için günlük plan, birlikte çalışma masası ve haftalık özet sunar. Çok yakında.",
    site: "puhukoc.com",
    altArt: "Puhu elinde fenerle pencerede sevinçle zıplıyor",
  },
  PF1: KAHRAMAN,
  PS1: { ...KAHRAMAN, badge: "ÇOK YAKINDA" },
  PF2: PELERIN,
  PS2: { ...PELERIN, badge: "ÇOK YAKINDA" },
  PR1: {
    head1: KAHRAMAN.head1,
    head2: KAHRAMAN.head2,
    toggle: KAHRAMAN.toggle,
    line1: KAHRAMAN.line1,
    line2: KAHRAMAN.line2,
    pill: PREMIUM_SHARED.pill,
    trial: PREMIUM_SHARED.trial,
    altPuhu: KAHRAMAN.altPuhu,
  },
  PR2: {
    head1: PELERIN.head1,
    head2: PELERIN.head2,
    chip1: "Sorunu Puhu’ya sor",
    chip2: "Her güne Puhu’dan not",
    chip3: "Haftanı Puhu kursun",
    pill: PREMIUM_SHARED.pill,
    trial: PREMIUM_SHARED.trial,
    altPuhu: PELERIN.altPuhu,
  },
  // Promo film "Ekrana dalış" (spec docs/plans/2026-11-08-promo-video-design.md). Lines marked app are
  // the app's own copy (board, notebook, chest, story, nickname); the rest is ours.
  T1: {
    hookA: "“Son bir video”",
    hookB: "dedin.",
    clock: "01:47",
    notifName: "Puhu",
    notif: "Kanka, bu 7. son.",
    come1: "Gel, sana bir şey",
    come2: "göstereyim!",
    exams1: "Sınavın hangisi olursa olsun,",
    exams2: "Puhu yanında!",
    exams: "KPSS · YKS · LGS · ALES · DGS",
    albumQ1: "Doktor mu, mühendis mi?",
    albumQ2: "Sen hangisisin?",
    stSaglik: "Dr. Puhu",
    stMuhendislik: "Müh. Puhu",
    stHukuk: "Av. Puhu",
    stYazilim: "Kodcu Puhu",
    stEgitim: "Öğretmen Puhu",
    stIsletme: "Patron Puhu",
    stSosyal: "Sunucu Puhu",
    stSanat: "Ressam Puhu",
    stFen: "Prof. Puhu",
    stMimarlik: "Mimar Puhu",
    planla: "PLANLA",
    board1: "Hedefini", // app
    board2: "duvara as!", // app
    pol1: "kampüs",
    pol2: "kod",
    pol3: "Konya",
    pol4: "mezuniyet",
    goalLabel: "HEDEFİM",
    goal: "Bilgisayar Mühendisi", // app
    city: "Konya", // app
    note: "kampüste görüşürüz!",
    magic1: "Haftanı",
    magic2: "Puhu kursun!",
    card1: "Türkçe 25 dk",
    card2: "Matematik 40 dk",
    card3: "Tekrar 15 dk",
    screens1: "Denemeni gir,",
    screens2: "sıradaki konunu gör.",
    spell: "abrakadabra, hafta hazır",
    next: "Sıradaki: Geometri",
    odaklan: "ODAKLAN",
    rooms: "Odanı seç, süreni kur, başla!",
    roomEv: "Ev",
    roomKafe: "Kafe",
    roomKutuphane: "Kütüphane",
    dial: "25:00",
    finish1: "Bitir,",
    finish2: "serini büyüt!",
    timerEnd: "00:00",
    xp: "+5 XP",
    streak: "4 gün seri",
    mola: "Mola hazır",
    nb1: "Yanlış soruların", // app
    nb2: "artık kaybolmaz!", // app
    nbName: "Matematik Defteri", // app
    nbTape: "Matematik", // app
    q1: "3x − 5 = 2x + 4 ise x kaçtır?", // app
    n1: "işlem hatası!",
    q2: "%20'si 45 olan sayı kaçtır?",
    n2: "oranı ters kurdum",
    q3: "2⁵ · 2³ kaçtır?",
    n3: "üsler toplanır!",
    page1: "1 / 3",
    page2: "2 / 3",
    page3: "3 / 3",
    review: "Bugün 2 tekrar",
    solved: "ÇÖZDÜM",
    birlikte: "BİRLİKTE",
    masa1: "Arkadaşlarınla",
    masa2: "aynı masada çalış.",
    ask1: "Takıldın mı?",
    ask2: "Topluluğa sor, Puhu’ya yaz.",
    zeynepName: "Zeynep",
    zeynep: "Paragrafta hep son soruda takılıyorum.",
    canName: "Can",
    can: "Önce soru kökünü oku, sonra metne dön.",
    clap: "12 alkış",
    puhuName: "Puhu",
    puhu: "Seanslarına baktım: bugün 10 paragraf yeter.",
    days: "5 gün masadaydın!", // app
    devirdin: "Haftayı devirdin!",
    chest: "Sandığın hazır!", // app
    story1: "Hafta bitti mi?", // app
    story2: "Hikâyen hazır!", // app
    nickLabel: "BU HAFTAKİ LAKABIN", // app
    nick1: "Seri Canavarı", // app
    nick2: "Korkusuz Denemeci", // app
    nick3: "Odak Makinesi", // app
    nickMsg: "Tek oturuşta 50 dakika! Seni durdurmak imkânsız.", // app
    light1: "Işığın yanıyorsa,",
    light2: "yalnız değilsin.",
    end1: "PLANLA.",
    end2: "ODAKLAN.",
    end3: "PUHU İLE.",
  },
  // Feature ads, wave 1 (spec docs/plans/2026-11-10-feature-ads-design.md). IF = "Puhu iş başında" feed,
  // IS = POV story. Sample rows are topic names and short study times, never official exam facts.
  IF1: {
    ...SERIES,
    head1: "ŞİMDİ OLMAZ,",
    head2: "ÇALIŞIYOR!",
    body1: "Seansı başlat.",
    body2: "25 dakika",
    body3: "kapıda Puhu var.",
    timer: "25:00",
    timerLabel: "odak seansı",
    chip1: "12",
    chip2: "99+",
    chip3: "3",
    altPuhu: "Takım elbiseli, kulaklıklı koruma Puhu kaşlarını çatmış, kanadıyla dur işareti yapıyor",
  },
  IF2: {
    ...SERIES,
    head1: "ROTAN HAZIR,",
    head2: "YOLA ÇIK!",
    body1: "Haftanı Puhu kursun.",
    body2: "İlk durak:",
    body3: "Paragraf, 25 dakika.",
    cardTitle: "Bu hafta",
    ...WEEK,
    altPuhu: "Kaptan şapkalı Puhu bir kanadında harita tutuyor, diğeriyle ileriyi gösteriyor",
  },
  IF3: {
    ...SERIES,
    head1: "YANLIŞLARIN",
    head2: "KAÇAMAZ!",
    body1: "Yanlışın defterde.",
    body2: "Tekrar günü gelince",
    body3: "karşına çıkar.",
    solved: "ÇÖZDÜM", // app
    wanted: "ARANIYOR",
    suspect: "işlem hatası",
    seenLabel: "Son görülme:",
    seen: "3x − 5 = 2x + 4", // app
    altPuhu: "Dedektif şapkalı Puhu büyüteçle bakıyor, bir gözü mercekte kocaman görünüyor",
  },
  IF4: {
    ...SERIES,
    head1: "HAFTANIN",
    head2: "NET DURUMU!",
    body1: "Denemeni gir.", // app
    body2: "Sıradaki konunu",
    body3: "tek bakışta gör.",
    cardTitle: "Net durumu",
    ...FORECAST,
    altPuhu: "Lacivert ceketli hava durumu spikeri Puhu çubuğuyla tabloyu gösteriyor",
  },
  // F1 with the series pill in place of ÇOK YAKINDA.
  IF5: { pill: SERIES.pill },
  IF6: {
    ...SERIES,
    head1: "VE BU HAFTAKİ",
    head2: "LAKABIN…",
    body1: "Hafta bitti mi?", // app
    body2: "Puhu sana lakap takar.",
    body3: "Seninki ne olur?",
    nick: "Korkusuz Denemeci", // app
    nickMsg: "3 deneme çözdün, hem de hiç çekinmeden!", // app
    altPuhu: "Papyonlu sunucu Puhu kanatlarını açmış, lakap kartını takdim ediyor",
  },
  IS1: {
    ...POV,
    quote1: "“Bir bildirime",
    quote2: "bakıp çıkacağım”",
    kanka2: "40 dakika oldu.",
    cardTitle: "Seans hazır!",
    cardChip: "Puhu kapıda",
    row1Tag: "25:00",
    row1: "Odak seansı",
    row2Tag: "Sonra",
    row2: "Mola hazır", // app
    altPuhu: "Puhu çıkartması elini yüzüne kapatmış",
  },
  IS2: {
    ...POV,
    quote1: "“Pazartesi",
    quote2: "başlıyorum”",
    kanka2: "bugün pazartesi.",
    cardTitle: "Haftan hazır!",
    cardChip: "Puhu kurdu",
    ...WEEK,
    altPuhu: "Puhu kartın üstünden, gözlüğünün üzerinden şüpheyle bakıyor",
  },
  IS3: {
    ...POV,
    quote1: "“Bu soruya",
    quote2: "sonra bakarım”",
    kanka2: "deftere yazdım.",
    question: "3x − 5 = 2x + 4 ise x kaçtır?", // app
    note: "işlem hatası!",
    page: "1 / 3",
    solved: "ÇÖZDÜM", // app
    altPuhu: "Dedektif Puhu büyüteciyle defter sayfasına bakıyor",
  },
  IS4: {
    ...POV,
    quote1: "“Hangi konudan",
    quote2: "başlasam?”",
    kanka2: "sıradaki Geometri.",
    cardTitle: "Deneme analizi",
    cardChip: "Sıradaki: Geometri", // app
    ...FORECAST,
    altPuhu: "Hava durumu spikeri Puhu çubuğuyla kartı gösteriyor",
  },
  IS5: {
    ...POV,
    quote1: "“Kütüphaneye",
    quote2: "gidince çalışırım”",
    kanka2: "kütüphane cebinde.",
    altPuhu: "Hakem Puhu düdük çalıp masayı gösteriyor",
    altMasa: "Dört Puhu kütüphanede masa başında birlikte çalışıyor",
  },
  IS6: {
    ...POV,
    dedin: "sandın.",
    quote1: "“Bu hafta hiçbir",
    quote2: "şey yapmadım”",
    kanka2: "5 gün masadaydın.",
    nick: "Seri Canavarı", // app
    nickMsg: "5 gün üst üste! Seriyi hiç bırakmadın.", // app
    altPuhu: "Papyonlu Puhu kanatlarını açmış seviniyor",
  },
  IR1: {
    hook1: "Tam",
    hook2: "çalışacaktın…",
    stop: "DUR!",
    head1: "ŞİMDİ OLMAZ,",
    head2: "ÇALIŞIYOR!",
    timerLabel: "odak seansı",
    end: "Kapıda Puhu var!",
    altPuhu: "Koruma Puhu kanadını kameraya uzatmış, dur işareti yapıyor",
  },
};
