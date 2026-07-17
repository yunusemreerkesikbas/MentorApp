# Sınav Koçluğu Platformu — Karar Kaydı & Roadmap

> Durum: Yaşayan karar kaydı + roadmap · Oluşturma: 2026-06-02
> **Ürün sınav-agnostik:** AI koç, ritüel, sosyal, analiz mantığı tüm sınavlarda (YKS/LGS/KPSS…) **aynı**. Sınavlar yalnızca **içerik/config** ile ayrışır (konu taksonomisi, **net kuralı** [KPSS/YKS: D−Y/4, LGS: D−Y/3], takvim kaynağı [ÖSYM/MEB], SEO içeriği). Ayrı "dikey geliştirme" yok. **KPSS = fikrin çıkış noktası + ilk tohumlanacak içerik.** *(LGS açılırsa: reşit-olmayan veli onayı/KVKK boyutu.)*
> Kapsam: konumlandırma · bilgi merkezi · forum/ekonomi · doğrulama · retention · iş modeli · stack/mimari · roller/paneller/marketplace · MVP · ödeme · yönetim paneli.

---

## Roadmap — Faz Özeti

> Hızlı referans; detaylar ilgili bölümlerde.

- **Faz 1 — MVP (Responsive Web, B2C):** onboarding · AI koç (hibrit check-in) · plan + sınav geri sayımı · Pomodoro + streak · deneme analizi (subject-bazlı giriş) · bilgi merkezi A-katmanı (SEO sayfası + grounded AI) · freemium abonelik (aylık/döngü · ücretsiz=AI-yok / kartlı trial / premium · **kazanılan AI hakkı: davet+görev**) · web push + e-posta · **yalın admin** (içerik editörü + kullanıcı + ödeme/refund + metrik + audit). Temeller: JWT · Drizzle+Neon · Render · Cloudflare · iyzico+e-arşiv · Cron+jobs kuyruğu (`JobQueuePort`). → §10
- **Faz 2 — Sosyal + Mobil + Koç:** mahalle (kohort) · forum + ödül ekonomisi (XP/coin) · rekabet/işbirliği · **mobil app (#1)** · koç (BYOS) + ince companion · **B2B yalın** (org panel + sanal sınıf + koç zekâ katmanı) · Redis (presence/leaderboard) · canlı çalışma odası · OCR giriş (otomatik doldurma) · native push · yaratıcı backlog (yol arkadaşı / deneme günü / sesli check-in / sezon etkinlikleri).
- **Faz 3 — Marketplace + Ölçek:** koç keşfi/vitrin · % komisyon (azalan) · sadakat/aracısızlaşma kalkanları · platform-içi chat · (gerekirse video SDK) · B2B derinleşme · sponsorlu/öne-çıkarma · ölçekte managed K8s.
- **Faz 0 — Lansman öncesi (operasyon, paralel):** şirket (şahıs) + iyzico başvuru + web yasal sayfaları + mali müşavir · fiyat/WTP araştırması · içerik/taksonomi tohumlama (KPSS ilk).

---

## 0. Konumlandırma & Ürün Ruhu (en kritik karar)

> **Karar:** Ürünün ruhu = **sosyal + duygusal koçluk ("yoldaşlık platformu").** Bu, orijinal taslaktan en önemli sapma.

**Tek cümlelik konumlandırma:**
> Sınav hazırlığının uzun, yalnız ve yıpratıcı yolunda seni **anlayan, devam ettiren ve yalnız bırakmayan** bir AI koç + topluluk. "Bilgi platformu" değil, **"yoldaşlık platformu".**

### Neden bu yön?
- Hedef kitlenin en derin acısı **bilgi eksikliği değil; yalnızlık, motivasyon çöküşü, bırakma.** Rakipler (soru-bankası/içerik app'leri + koçluk-hafif, sosyalliği sıfır) tam buraya kör.
- Son tasarımın tamamı (mahalle, rekabet/işbirliği, duygu check-in, AI koç, Pomodoro/streak, forum) bu acıya merhem.

### Wedge ≠ Moat ≠ Ruh
| Aday | Kopyalanabilir | Frekans | Çözdüğü acı | Moat | Rol |
|---|---|---|---|---|---|
| Sosyal/Topluluk (mahalle+forum+rekabet) | Çok zor | Günlük | **Yalnızlık/bırakma** | **Ağ etkisi** ✅ | **Ruh + Moat** |
| AI koç (davranış-temelli) | Orta | Günlük | İlerleme belirsizliği | Kısmi (veri) | Omurga |
| Bilgi merkezi (A-only) | Kolay (emek) | Epizodik | Bilgi açlığı (dar) | Yok | **Güven çapası** (zayıf SEO) |

### Karar: Katmanlı strateji (risk dengesi)
- **Ruh/konumlandırma = sosyal + duygusal koçluk** → marka, pazarlama, tüm ürün kararları buna hizmet eder.
- **Gün-1 teslim edilebilir değer = AI koç + ritüel + bilgi merkezi** → sosyal kütle (cold-start) oluşana kadar bunlar taşır. Sosyali *ruh* yap ama *gün-1 bel kemiği* yapma.
- **Moat zamanla:** davranış verisi (erken) → topluluk ağ etkisi (kütle sonrası).

### Markette ayıran cümle
> Rakipler "soru / bilgi / araç" satıyor; biz **"bu süreçten sağ çıkma"** satıyoruz.

---

## 1. Bilgi Merkezi (güven çapası + edinim wedge'i)

> **Not (§0 pivotu):** Bilgi merkezi artık "en güçlü diferansiyatör" değil; **güven çapası ve SEO edinim wedge'i** rolünde — destekleyici özellik, ürünün kalbi değil. Aşağıdaki teknik kararlar (RAG, A/B/C, güven üst-verisi) aynen geçerli.

Sınav süreç bilgisi (takvim/başvuru/tercih/yerleştirme; KPSS'te atama/kadro) güçlü bir **edinim ve güven** varlığıdır; ama yanlış bilgi güveni çökertir. Bu yüzden bir **yazılım** değil, bir **içerik-operasyon + güven** problemi olarak ele alınır.

### Karar: "Eğitmek" değil RAG
- **Fine-tuning kullanılmaz.** Güncel/kesin gerçek için yanlış araçtır; halüsinasyonu gizler, güncellemesi pahalıdır.
- **RAG (Retrieval-Augmented Generation) kullanılır.** Model bilgiyi ezberlemez; soru gelince doğrulanmış kendi DB'sinden ilgili kayıt çekilir, LLM sadece **dile döker**.
- Güncelleme = DB'de bir satır değiştirmek. Model anında güncel kalır, kaynak gösterebilir, bilmiyorsa "bilmiyorum" der.

### Karar: Bilgiyi 2 katmana ayır (A + C)
| Katman | Doğası | AI nasıl kullanır | Güven |
|---|---|---|---|
| **A — Editoryal** | İnsan-küratör, resmi metin (takvim, başvuru, "atama nasıl olur", kadro türleri) | Doğrudan, otorite | Yüksek |
| **C — Topluluk (forum)** | Kullanıcı üretimi, deneyimsel | "Topluluk deneyimi, düşük-otorite" **etiketiyle** | Düşük, etiketli |

> **B (yapısal/sayısal — taban puanı/kontenjan/atama simülasyonu) PLANDAN ÇIKARILDI** — yüksek emek + doğruluk/scraping/sorumluluk riski; değer/risk dengesi olumsuz.

### Karar: Retrieval = vektör (metin)
- **Metin (A, C)** → embedding + pgvector ile **semantik (vektör) arama**. *(Sayısal B kaldırıldığı için ayrı SQL-sayısal retrieval yolu yok.)*

### Karar: Güven üst-verisi her kayıtta zorunlu
`source`, `source_url`, `effective_date`/`valid_until`, `last_verified_at`, `status` (taslak/yayında/arşiv), `is_official`/`confidence`. Bu üst-veri AI'a verilen bağlamın parçası olur; UI'da **kaynak + son güncelleme rozeti** olarak gösterilir (şeffaflık = güven).

### Koruyucu kural (tüm sistemde geçerli)
**Resmi bilgi (A — tarih/süreç) hiçbir zaman LLM'e serbest ürettirilmez ve topluluk/koç onayına bırakılmaz** — hep doğrulanmış editör içeriğinden gelir (kritik fact = veri kartı). Forum/koç onayı yalnızca deneyimsel (C) içeriği yükseltebilir.

### Karar: A-katmanı sunum modeli + MVP kapsamı
- **Bilgi merkezi = yalnız A katmanı** (küratörlü editoryal: sınav takvimi, başvuru/atama/tercih rehberleri, kadro/puan türleri). **B (taban puanı/kontenjan/atama simülasyonu) çıkarıldı** (yukarıdaki not).
- **Katmanlı sunum — tek içerik, iki tüketim yolu:**
```
        KÜRATÖRLÜ MAKALE (DB, editör doğrular)
         /                              \
   Next.js sayfası                   pgvector RAG
   = SEO + okuma (ücretsiz, statik)   = AI koçun kaynağı
```
- **AI koç davranışı:** cevabı **sohbette verir** (grounded RAG) + **kaynak linki** (yönlendirme değil → atıf/kanıt + derinlik). **Kritik fact (tarih) → veri kartı render** (parafraz yok → halüsinasyon yok).
- **NotebookLM = İÇ editör aracı:** editör kaynağı (ÖSYM PDF/link) verir → AI taslak üretir → **editör doğrular** → yayınlar. Kullanıcıya **chatbot-only DEĞİL** (sebebi: SEO kaybı + halüsinasyon + LLM maliyeti + kontrol).
- **Maliyet:** SEO sayfaları statik/ücretsiz (LLM yok); AI koç cevabı premium / ücretsizde rate-limit (§7).

### Açık konular (1. başlık)
- [x] ~~Kapsam~~ → **Yalnız A katmanı** (küratörlü editoryal). **B (taban puanı/kadro/simülasyon) plandan çıkarıldı** → versiyonlama + scraping konuları da düştü.

---

## 2. Forum & Topluluk *(Faz 2)*

### Konumlandırma kararı
Forum, "AI'ı besleyen bilgi kaynağı" olarak değil — AI zaten çoğu şeyi biliyor — **aidiyet / motivasyon / yalnızlık panzehiri** katmanı olarak konumlanır. Asıl işi insanlar arası bağ; bilgi katkısı (C katmanı) ikincil ve yan ürün.

### Karar: 3 bölge (zone), her biri farklı ödül basar
| Bölge | Amaç | Ödül |
|---|---|---|
| **Bilgi Bölgesi** (Soru-Cevap) | Doğru bilgi, AI'a C katmanı | **Coin + XP** |
| **Lonca / Sohbet** (motivasyon, dertleşme) | Aidiyet, retention | **Sadece XP** |
| **Çalışma Odaları** (Pomodoro, body-doubling) | Disiplin, alışkanlık | **Sadece XP / streak** |

**Coin yalnızca Bilgi Bölgesinde** verilir (doğrulanabilir değer). Sohbet ve odalar yalnızca XP kazanır — aksi halde ekonomi şişer ve sohbet ortamı bozulur.

---

## 3. Ödül & Kazanılan Ekonomi *(davet+görev→AI hakkı = MVP · tam forum/XP/koç = Faz 2)*

### Karar: İki ayrı birim — XP ≠ Coin
| | **XP (İtibar)** | **Coin (Para-benzeri)** |
|---|---|---|
| İşlev | Statü, seviye, rozet, leaderboard, **yetki** | Sınırlı premium-özellik kapısı |
| Harcanır mı | ❌ Asla birikir | ✅ Harcanınca azalır |
| Parasal değer | Yok | **Yok** (nakde/tam aboneliğe çevrilmez) |
| Motivasyon | Ait olma, tanınma | Somut küçük fayda |

### Karar: Coin = sadece sınırlı premium-özellik (parasal değil)
Coin nakit değeri taşımaz; **tavanlı/sınırlı** olarak premium özelliklerden faydalandırır (örn. ekstra AI sorusu, derin analiz yorumu tek seferlik, profil/rozet özelleştirme, "öne çıkan soru" hakkı). Tam abonelik bedava açılmaz → birim ekonomisi korunur.

### Karar: Kazanılan ekonomi — coin → AI hakkı (birleşik)
- **Coin, AI kullanım hakkına çevrilir** (foto-analiz, ekstra sohbet hakkı vb.) → kazanılan coin'e **gerçek/arzu edilen değer** (kozmetik değil). *(İki "para birimi" birleşir: kazanılan = coin/§3, satın alınan = top-up/§7.)*
- **Kazanma yolları:**
  - **Katkı:** arkadaş daveti (**dönüşürse**), app-store/site yorumu, forum'da kabul edilen cevap.
  - **Görev (quest):** onboarding/aktivasyon ("ilk deneme/hedef"), alışkanlık ("bu hafta 5 gün"), kilometre taşı.
- **Free'de = büyüme/dönüşüm motoru** (katkıyla AI'ı tat → **self-funding**: katkı değeri > AI maliyeti); **Premium'da = top-up alternatifi** (para yerine katkı).
- **Suistimal kalkanı:** eylem **doğrulanır** (davet→dönüşüm, yorum→yayınlı, cevap→kalite-kapılı) + cap + Turnstile + **ödül ≤ eylem değeri** (AI-maliyeti sızmasın). Görev **full premium kilidi açmaz** (sadece coin/kozmetik/AI-tadımlık).
- **Faz:** davet + onboarding/alışkanlık/kilometre görevleri = **MVP**; forum-katkı + koç-içerik = **Faz 2**.

### Karar: Kazanım kuralları
- **XP cömert** (maliyeti yok): soru/cevap yazma, oy alma, günlük giriş/streak, kabul edilen cevap, profil tamamlama.
- **Coin kıt** (yalnızca doğrulanabilir değere): kabul edilen cevap, topluluk-onaylı cevap (pending), **editör/koç onaylı cevap** (büyük), haftalık en faydalı katkı.
- **Hem soran hem cevaplayan ödüllendirilir:** soran → kaliteli soru sinyaliyle (görüntüleme/kaydetme) XP, "kabul" işaretleyince küçük coin; cevaplayan → onay merdiveninden coin.
- **Salt aktiviteye coin verilmez** (giriş/oy/yorum → XP).

### Karar: Suistimal kalkanları (katmanlı)
Rate limit (günlük max soru/cevap) + günlük/haftalık **coin tavanı** + coin için **minimum XP eşiği** (Sybil'e karşı) + **XP-ağırlıklı oy** + öz/karşılıklı oy tespiti + **coin yalnızca onaylı eyleme**.

### Kimlik rozetleri (sohbet bölgesi)
Sohbet XP'sini kimliğe çevirmek için davranış-temelli rozetler (örn. "Dert Dinleyen", "Motivatör", "Maraton", "Gece Kuşu"). **Pozitif çerçevele** (negatif/incitici isim yok). Coin'e bağlanmaz; statü kalır.

### Uyarılar
- Sohbet bölgesine **asla coin koyma** (ileride baskı gelse de) — enflasyon ve ortam bozulması.
- İçsel motivasyon (XP/statü) omurga; coin yalnızca hızlandırıcı (ekstrinsik motivasyon tuzağı).
- Sink (harcama yerleri) musluk kadar ciddiye alınmalı (enflasyon).

---

## 4. Doğrulama & Moderasyon *(forum doğrulama = Faz 2; içerik moderasyon altyapısı §9 = MVP)*

### Karar: 3 katmanlı doğrulama hiyerarşisi
```
Katman 1: Topluluk (herkes)        → "topluluk-onaylı", küçük coin (pending), hızlı/ölçeklenir
Katman 2: Koç (yetkili, profilli)  → "koç onaylı" ✓, orta güven, AI'a C-katmanı adayı
Katman 3: Platform/editör (sen)    → "resmi" ✓, sadece en kritik içerik
```

### "Topluluk-onaylı" netleştirme
- Bu **cevabın (Post) durumudur, sorunun değil.** Soru onaylanmaz; ilgi (görüntüleme/kaydetme) toplar.
- Tetik: **sabit kişi sayısı yok.** Ya soran "kabul" işaretler **ya da** XP-ağırlıklı net skor eşiği geçilir (düşük trafikte de çalışsın diye). Eşik canlı veriyle kalibre edilir.

### Cevabın yaşam döngüsü (durum makinesi)
```
yazıldı (+XP) → AÇIK → (oy +XP) → TOPLULUK_ONAYLI (+küçük coin, PENDING)
   → [editör/koç kuyruğu: sadece riskli/değerli içerik]
   → DOĞRULANDI (+büyük coin CONFIRMED, AI C-katmanına aday)  |  REDDEDİLDİ (coin REVERSED)
   → AI_TABANINDA (C katmanı, "düşük-otorite" etiketiyle)
```
- **Coin geri alınabilir:** topluluk-onaylı coin önce `PENDING`; editör/koç onayında `CONFIRMED`, redde `REVERSED`. Harcanabilir bakiye = yalnızca `CONFIRMED`.
- **Her cevap onaya gitmez:** sadece topluluk-onaylı + bilgi-kritik etiketli içerik kuyruğa düşer. Sohbet hiç girmez. → editör eforu kontrollü.

### Koçun iki rolü
| | **Mod A: Koç cevap yazar** | **Mod B: Koç onaylar (moderatör gibi)** |
|---|---|---|
| İçeriği üreten | Koç | Öğrenci |
| **Coin'i alan** | **Koç almaz** | **Cevabı yazan öğrenci** |
| Koçun kazancı | İtibar + marketplace görünürlüğü | İtibar + doğrulama sayacı |
| Ölçeklenir mi | Hayır (koç zamanı kıt) | Evet → **omurga bu olmalı** |

**Kritik kurallar:**
- **Koç coin kazanmaz.** Coin = öğrenci yakıtı; koç yakıtı = itibar/görünürlük (Faz 3'te marketplace gelirine döner).
- **Koç kendi cevabını onaylayamaz** (Mod A + Mod B aynı kişide birleşmez).
- Resmi/sayısal bilgi (B) koç onayına bırakılmaz (bkz. 1. başlık koruyucu kural).

---

## 5. Koç Motivasyonu & Faz Yolculuğu

### Karar: Erken fazda koça bağımlı olma
Faz 1'de doğrulayıcı = **sen/ekip + AI**. Koç katmanı, öğrenci kütlesi oluştukça *devreye giren kapasite*, *bağımlı olunan* değil.

### Marketplace'ten önce koçu çeken 4 değer
1. **Kitleye erişim** — koçun en büyük derdi öğrenci bulmak; platformda hedef kitle hazır.
2. **"Kurucu koç" avantajı** — marketplace açılınca itibar/sıralama geçmişiyle en önde başlamak (FOMO + kalıcı avantaj).
3. **Bedava koçluk araçları** — B2B panel + AI "akıllı brief" forum katkısı karşılığı ücretsiz/indirimli (karşılıklı değer; "bedava işçi" hissini kaldırır).
4. **İtibar/portfolyo + statü** — koç leaderboard, "Ayın Koçu", doğrulanmış uzmanlık rozetleri.

### Faz yolculuğu
```
Faz 1: Koç YOK. Doğrulayıcı = ekip + AI. Sistem koçsuz çalışır.
Faz 2: Davetli/kürasyonlu koç havuzu. Çekiş: kitle + kurucu avantajı + araçlar + itibar.
        Koç onaylar (Mod B) / bazen cevaplar (Mod A). Coin öğrencide. Güven skoru birikir.
Faz 3: Marketplace açılır. Forum itibarı = koçun vitrini/sıralaması/ilk müşterileri.
        Para motivasyonu öncekilerin ÜSTÜNE biner (sebebi değil).
```

### "Koç nasıl koç olur?"
Açık kayıt değil, **kürasyon**: başvuru + belge (öğretmenlik/atanmışlık) + kısa değerlendirme. Forum performansı koçun **güven skorunu** besler → marketplace sıralamasının ham maddesi.

### Tehlike: Aracısızlaşma (disintermediation)
Koç kitleye erişince öğrenciyi platform dışına kaçırabilir. Erken fazda engellenemez ama önemsiz (komisyon yok). Çözüm: **marketplace değerini (ödeme güvencesi, AI brief, takip, itibar) o kadar yüksek yap ki dışarı çıkmak koça zarar versin.**

---

## 6. Odak & Retention (ürünün kalbi)

### Temel ayrım: "Değer sürücüsü" ≠ "Retention sürücüsü"
- **Değer sürücüsü** (niye abone olunur): AI koç + deneme analizi + bilgi merkezi.
- **Retention sürücüsü** (niye her gün açılır): günlük **ritüel** (çalışma seansı + streak + AI check-in + sosyal).
- Üç ana değer düşük frekanslı (bilgi=epizodik, analiz=haftalık, plan=bir kez) → tek başlarına retention sağlamaz. **Günlük katman ayrıca tasarlanmalı.**

### Karar: Merkez = AI koç (omurga), motor = ritüel
- **AI koç merkezde:** planı, analizi, çalışma seanslarını, bilgi merkezini birbirine bağlayan tek bileşen. Diğer özellikler onun girdi/çıktısı.
- **Günlük açtıran = ritüel:** seans + streak + AI check-in. Bunlar "backlog" değil, **MVP retention motoru.**

### Retention zaman ufukları
```
GÜNLÜK   → çalışma seansı + streak + AI check-in + (Faz 2) mahalle/sosyal
HAFTALIK → deneme analizi + AI haftalık değerlendirme + plan revizyonu
KİLOMETRE→ sınav geri sayımı + atama/tercih dönemi + hedefe yaklaşma
```

### Karar: Günlük motor sıralaması (faz)
1. **Faz 1:** Çalışma seansı + streak (cold-start'sız, tek başına çalışır) + AI günlük check-in (omurgayı günlük yapan tetikleyici) + **bağlamsal/motive edici bildirim** (kişisel, veri-temelli, frekansı AI ayarlar).
2. **Faz 2:** Sosyal katman (mahalle) üstüne biner — kütle oluşunca.
- **Kova mantığı:** Önce retention (kovayı tıka), sonra edinim (su doldur).

### Wedge vs Core
- **Core (net):** AI koç + ritüel.
- **Wedge (güncel):** Bilgi merkezi A-only (B çıkarıldı) → **SEO mıknatısı zayıf; wedge = bilgi-merkezi DEĞİL.** Edinim = içerik/organik + küçük-B2B flywheel + ücretsiz tier + (Faz 2) sosyal/viral (davet). Kesin edinim stratejisi açık (Faz 0).

### Mahalle (küçük kohort) — sohbet bölgesinin doğru tasarımı
Forum (konu-eksenli, büyük, bilgi/SEO) ile **Mahalle** (insan-eksenli, küçük, aidiyet) farklı şeylerdir. Geçen turlardaki "Lonca/Sohbet bölgesi" = mahalleler.

- **Boyut:** ~25-30 kişi kapalı grup. Küçük grup, az kullanıcıyla bile "dolu" hisseder → **forumdan daha iyi cold-start.**
- **Atama: hibrit** — sistem kayıt formu verisine göre **en yüksek eşleşmeye otomatik atar** (varsayılan), kullanıcı sonradan değiştirebilir. Erken fazda dolu-oda hissi > özerklik.
- **Eşleştirme boyutları:** sınav+dönem (🔒 zorunlu), hedef alan/kadro, seviye, çalışma ritmi/saat, **aktiflik** (yeni gelen daima canlı mahalleye).
- **Dönem kohortu:** aynı sınav tarihi → ortak yolculuk + doğal yaşam döngüsü (birlikte geri sayım → sınav → "geçmiş olsun" → mezuniyet/arşiv).
- **Dinamik yönetim:** tavan dolunca yeni mahalle aç; küçüleni doldur/birleştir; sessizleşene AI kıvılcımı.
- **Kimlik:** mahalle adı/no, ortak hedef rozeti, grup streak.

### Karar: Çalışma seansı (Pomodoro) tasarımı
Pomodoro = sayaç değil; **günlük veri + hesap verebilirlik ritüeli** ve AI'ın "gözü".
- **Seans öncesi:** konu seç (idealde plandan tek tıkla) → veri kör kalmasın.
- **Sırası:** sayaç; solo (varsayılan) veya **canlı çalışma odası** (body-doubling, mahalleye bağlı, anonim/avatar, sohbet kısıtlı).
- **Sonrası:** 5 sn'lik mikro check-in (mood 😩😐🙂 + opsiyonel "zorlandığın konu") → AI'a öznel zorluk sinyali.
- **Döngü:** Plan → seans → seans verisi → AI yorumu/plan revizyonu → haftalık analiz. (Pomodoro AI koçluğunu kuru sayaçtan ayıran şey.)
- **Esnek süreler** (25/5, 50/10 + özel), sade varsayılan. _(90/20 preseti backlog'dan kaldırıldı — 2026-07-17; özel süre zaten kapsıyor.)_
- **Streak = gerçek çalışma** (tamamlanmış min. seans, sadece login değil); arka plan inaktiflik kontrolü; **coin ile streak onarma** (tavanlı).
- **Ödül:** seans → XP (coin değil); streak rozetleri kimlik rozetlerini besler; **mahalle grup istatistiği** (kolektif gurur).

### Karar: Rekabet & İşbirliği dengesi
- **Çabada rekabet, sonuçta ASLA.** Çalışma saati/streak/tutarlılık sıralanır; net/puan/sonuç **asla** sıralanmaz (demoralizasyon + sınav netı hassas).
- **İçeride yardımlaşma (biz), mahalleler arası rekabet (biz vs onlar):** mahalle üyeleri birbiriyle değil, birlikte başka mahalleye karşı yarışır → rekabet enerjisi + iç dayanışma.
- **Yardımı da ödüllendir:** mahallede destek/cevap → XP + rozet ("Mahalle Ablası/Abisi").
- **"Geçmiş ben" (ghost):** en güvenli bireysel rekabet — kendi geçmiş performansını geç.
- **Doz ayarı (opt-in):** "Rahat mod" (sadece kendi ilerleme) ↔ "Hırslı mod" (lig/yarış) → kişiye göre.
- **Zehir kalkanları:** sonuç sıralaması yok, "en alttakiler" utandırması yok, geride kalan "yük" değil; **AI burnout freni** (aşırı çalışmada "dinlen" der).

### Beğenilen yaratıcı fikirler (kesin faz = §10)
| Fikir | Açıklama | Faz |
|---|---|---|
| Duygu/enerji check-in → adaptif plan | Mood'a göre plan yumuşar/sıkışır; burnout yönetimi | **MVP** |
| "Geçmiş ben" / ghost | Kendi geçmişinle güvenli rekabet | **MVP** |
| Hedef/hayal panosu | Onboarding "neden"i + şehir/hedef içeriği | **MVP** |
| Bağlamsal motive bildirim | Veri-temelli, doğru anda, AI frekans ayarı | **MVP** |
| Deneme girişi: foto→konu-kategorize | Yanlışları konuya ayır (çözmez) | **MVP (premium)** |
| Deneme girişi: OCR (otomatik D/Y/B) | Sonuç fotoğrafından doldur | F2 (fast-follow) |
| Yol arkadaşı (eşleşmiş partner) | Benzer hedef/seviye 1-1 hesap verebilirlik | F2 |
| Telefon ana ekran widget'ı | Geri sayım + görev + streak | F2 |
| "Deneme günü" / sınav simülasyonu | Gerçek süre/saatte tam tur + AI strateji | F2 |
| Sesli check-in | Yazmak yerine AI'a sesli özet | F2-backlog |
| Sezon etkinlikleri (ÖSYM/MEB takvimi) | Başvuru/sonuç/tercih dönemine özel mod | F2 |
| Net tahmin oyunu | "Benim tahminim X, sen?" → haftalık geri dönüş | backlog |
| Mahalleler arası lig/sezon | Çaba-temelli takım rekabeti | F2 |

---

## 7. İş Modeli & Birim Ekonomisi

### Merkezi gerilim
"Yoldaşlık" konumlandırması = daha çok günlük etkileşim = daha çok LLM çağrısı = değişken maliyet. **Retention başarısı marjı yiyebilir.** Bu paradoksu yönetmek işin sırrı.
```
Katkı marjı = Gelir (abonelik) − Değişken maliyet (LLM + ödeme komisyonu + altyapı payı)
```

### Karar: Hibrit mimari = maliyet stratejisi
"Kural motoru + LLM hibrit" bir ürün değil, **maliyet** kararıdır. Günlük teması **ucuz katmanla** sağla, LLM'i sadece katma değerli anda kullan → "algı günlük, maliyet seyrek".
| Etkileşim | Kim yapar | Maliyet |
|---|---|---|
| Günlük check-in, streak, mahalle istatistiği, rutin analiz | Kural motoru/şablon | ~0 |
| Kişisel yorum/motivasyon, derin analiz | LLM | $ |
| Serbest sohbet / soru sor | LLM | $$ |

### Karar: Ücretsiz = sosyal (ucuz, moat) · Premium = AI derinliği (pahalı, monetize)
- **Ücretsiz katmanda AI minimize/sıfır.** Sosyal moat kritik kütle (cold-start) ister → ücretsiz katman şart, ama LLM maliyeti sızdırmamalı.
- **Ücretsiz (eventual):** mahalle + forum + Pomodoro + streak + rekabet/işbirliği + temel plan + bilgi merkezi **okuma** (LLM yok). *(AI sohbet/RAG premium.)* ⚠️ **MVP'de sosyal Faz 2 → MVP-free = araçlar+okuma; AI kullanım mekaniği & 3 hak-kaynağı için ↓ "Premium AI kullanım modeli".)*
- **Premium:** derin AI koçluk + (adil kullanımlı) sınırsız sohbet + detaylı analiz + adaptif plan.
- Bu paketleme "yoldaşlık" pivotuyla çelişmez, **destekler:** ucuz olan (sosyal) bedava + moat; pahalı olan (AI) paralı + dönüşüm hunisi.

### Sınav hazırlığına özgü gerçek: mevsimsellik + kısa LTV
- **Mevsimsellik:** talep sınav öncesi patlar, sonrası çöker → nakit akışı dalgalı.
- **"Başarıyla churn":** kullanıcı ya atanır ya bırakır → müşteri ömrü ~bir hazırlık döngüsüyle sınırlı (6-12 ay).
- **Sonuçlar:** LTV tavanı düşük → **ucuz edinim zorunlu** (SEO wedge + organik topluluk; pahalı reklam kaldırmaz). Döngü-bazlı paketler mantıklı. **Atanan → koç** dönüşümüyle ömrü farklı rolde uzat (aday → atanan → koç).

### Karar: Gelir mimarisi (3 segment + ek gelir)
```
B2C (öğrenci)        → freemium abonelik              ← taban gelir
Koçlar               → marketplace komisyonu (+ ops. Pro araç)  ← Faz 3 ölçek
B2B (kurum/dershane) → öğrenci-başı lisans             ← en stabil/yüksek marj, cash tamponu
Ek gelir             → sponsorlu/öne-çıkarma (Faz 2-3, dikkatli)
```

**B2C — freemium:** Ücretsiz (sosyal, ~0 AI) → Premium (AI derinliği) → ops. Premium+ (simülasyon, öncelik). En fazla 3 kademe. **Aylık + döngü paketi (3-6 ay "sınava kadar")** → geliri öne çeker, churn yumuşatır. *(MVP'de ücretsiz = sosyal yok; bilgi merkezi + temel araçlar + kartlı trial — §10. Sosyal-ücretsiz Faz 2.)*

**Koçlar — ana gelir komisyon, araç = yem:**
- Marketplace komisyonu (%X, iyzico alt-üye-işyeri) = ana model (Faz 3).
- Koç araçları (panel, AI brief) erken fazda **ücretsiz/indirimli yem** (arz çekmek). İleride ops. "Pro Koç" aboneliği.
- Koçtan abonelik sıkma; koç çok kazanınca platform komisyondan kazanır → çıkarlar hizalı.

**B2B — en stabil/yüksek marj:**
- Öğrenci-başı lisans (seat-based), hacme göre kademeli indirim.
- Kurum paneli (öğrenci takibi, plan/ödev atama, raporlar).
- **Yıllık sözleşme** → öngörülebilir gelir, mevsimsel B2C dalgalanmasını dengeler.
- Basit kurum lisansı **Faz 2'ye cash tamponu** olarak öne çekilebilir (taslakta Faz 3'tü).

### Karar: Sponsorlu içerik = "reklam" değil "keşif/öne-çıkarma"
- Klasik banner/CPM/üçüncü-parti reklam **YAPILMAZ** — kaygılı/kırılgan/parası kısıtlı kitleye sömürücü hisseder, "yoldaşlık" ruhunu (§0) ve güveni çürütür.
- Bunun yerine **marketplace'in native uzantısı:**
  - **Koç öne çıkarma (boost):** koç görünürlük için öder (reklam değil, lead-gen; komisyonun üstüne biner).
  - **Kurum vitrini:** doğrulanmış profil + "✓ Sponsorlu/Kurumsal" etiketli içerik.
- **Kurallar:** her sponsorlu içerik **açıkça etiketli**, **kitleye/sınava alakalı**, ve **bilgi/güven katmanını ASLA kirletmez** (§1 koruyucu kural buraya uzanır).
- **Fiyatlama:** düşük trafikte CPM anlamsız → **sabit yerleşim ücreti / vitrin aboneliği**; ölçekte boost/açık artırma.
- **Zamanlama:** trafik/hacim gerektirir → **Faz 2-3**, MVP'de değil.

### İzlenecek metrikler (baştan kur)
Aktif kullanıcı başı **LLM maliyeti** (en kritik), **katkı marjı**, **CAC + geri ödeme süresi**, **ücretsiz→premium dönüşüm**, **döngü-bazlı retention** (sınav öncesi/sonrası ayrı).

### Tehlikeler
- ⚠️ Premium'da bile "power user" sınırsız sohbeti marjı yer → **adil kullanım/rate limit** + ucuz modele yönlendirme.
- ⚠️ Ücretsizde LLM açmak maliyet sızdırır → ücretsizde AI çok sınırlı/sıfır.
- ⚠️ Mevsimsel nakit akışı → sınav sonrası gelir çöküşüne hazırlık (döngü/yıllık paket + B2B tamponlar).
- ⚠️ Coin disiplini (parasal değil, tavanlı — §3) marjı korur; bu disiplin gevşetilmemeli.

### Premium AI kullanım modeli & AI-hak kaynakları
- **Premium = sabit fiyat (flat), kullanıcıya sayaç YOK** (metered değil — fiyat-hassas öğrenci sayaç/kaygı sevmez).
- **AI koç sohbet:** sınırsız/cömert + **görünmez günlük adil-kullanım hakkı** (uç/suistimal sınırlanır). Duygusal yoldaş → **metrelenmez** (§0).
- **Foto→kategorize (pahalı/ayrık):** "ayda X dahil" + **top-up** (taşma valfi) → ağır-kullanıcı geliri + maliyet koruması, herkesi metrelemeden. Hafif sayaç tolere edilir.
- **Sistem-tetikli AI** (deneme yorumu, check-in, reflection, bildirim, adaptif plan): frekans **bizde** → öngörülebilir, kullanıcı-limiti yok.
- **AI-hak 3 kaynağı:** abonelik allowance · **top-up** (para) · **kazanılan** (katkı+görev, §3). Free'de kazanılan = büyüme motoru; premium'da = top-up alternatifi.
- **Tavanlar/allowance = config**, kullanıcı-başı LLM maliyetiyle **kalibre** (§9). Maliyeti düşük tutan: hibrit (kural motoru) + model-katmanı (ucuz/güçlü) + cache + rate-limit.

### Ödeme Entegrasyonu (iyzico)

**Türkiye ön şartları:**
- **Şirket şart** (Sanal POS + Pazaryeri için) — en az **şahıs şirketi** (Ltd/AŞ daha kurumsal).
- **Evrak:** imza sirküleri, vergi levhası, kimlik, IBAN/banka doğrulaması.
- **Web yasal sayfaları:** gizlilik politikası, **mesafeli satış sözleşmesi**, iade/iptal şartları, hakkımızda, KVKK aydınlatma (olmadan başvuru geçmez).
- **Lisans bizde değil:** marketplace'te para taşıma 6493 sayılı Kanun kapsamında lisans ister; **iyzico lisanslı kuruluş** → pazaryeri çözümüyle yük iyzico'da, biz "ödeme kuruluşu" olmayız. *(Lansman öncesi mali müşavir/hukuk onayı.)*

**Kullanılan ürünler:**
- **Abonelik:** B2C premium (aylık/dönem), otomatik yenileme, kart saklama. *(iyzico abonelik-yönetimi **araç ücreti**: ilk 3 ay ücretsiz, sonra ~199 TL/ay — **bizim kullanıcı fiyatımız değil**.)* **Karar: sadece kredi kartı yeterli — ek ödeme yöntemi yok (şimdilik).**
- **Pazaryeri / Alt üye işyeri** (Faz 3): koça payout; koç **bireysel** alt-üye olabilir (şirket kurması gerekmez → arz için kritik); komisyon kesintisi + **stopaj** yönetimi.
- **Kart Saklama:** abonelik döngüsü + tek-tık; kart verisi iyzico'da → **PCI yükü bizde değil**.

**Faza göre:** MVP = B2C abonelik (kredi kartı, 3DS) · B2B = erken fatura/havale (sonra otomatik) · Faz 3 = marketplace payout/komisyon/escrow.

**Teknik:** 3D Secure standart · **idempotent webhook** (§8 — çift coin/abonelik yok) · PCI+kart verisi iyzico'da · izole `payments` modülü + iade/iptal + mutabakat · **tüketici hukuku:** mesafeli satış sözleşmesi + cayma hakkı (dijital hizmet nüansı).

**Ödeme akışı (genel):**
- **Otomatik yenilenen abonelik** (aylık/dönem); **taksit yok.**
- **İptal = self-serve, her an** → yenileme durur, **ödenmiş dönem sonuna kadar erişim**; sonra free tier'a düşer. Başarısız ödemede grace period.
- **Ücretsiz deneme = kartlı otomatik-çekim** (örn. 7 gün → otomatik ücretlenir), satın alımda **açık bilgilendirme + onay** zorunlu ("7 gün ücretsiz, sonra otomatik X TL/ay, istediğin an iptal"). Kullanıcı/kart başına tek deneme (Turnstile).
- **Güvenlik:** kart verisi **bizde değil** (iyzico hosted/tokenize akış — ham kart alanı ellenmez) → saldırıda kart çalınamaz; biz token + maskeli kart tutarız. Risk kart hırsızlığı değil, API anahtarı + endpoint authz (standart önlemler).
- **Sorumluluk:** iyzico = kart saklama + çekim/iade/recurring icrası (PCI). Biz = iptal/iade kararı + entitlement + **e-Arşiv fatura** + onay/KVKK.
- **e-Arşiv fatura:** B2C her tahsilatta otomatik (API'li özel entegratör), **KDV dahil** fiyat (net gelir KDV düşülür). Marketplace faturalama/stopaj → Faz 3 + mali müşavir.

---

## 8. Teknoloji Stack'i & Mimari

> **Karar:** Tek-dil **TypeScript** (greenfield + ekip TS-yatkın). Orijinal taslaktaki Java/Spring + ayrı TS frontend ikiliği terk edildi.

### Stack (kilitlendi)
| Katman | Seçim | Neden |
|---|---|---|
| Dil | **TypeScript (tek dil)** | Web+mobil tip/mantık paylaşımı, real-time + AI SDK doğal, küçük ekip hızı |
| Backend | **NestJS — modüler monolit** | Mikroservis değil; net modül sınırlarıyla başla, gerekeni sonra servise çıkar |
| Web | **Next.js** | B2C + SEO (wedge) |
| Mobil | **Expo (React Native)** | B2C öğrenci ana app (Pomodoro/push/real-time mobil-doğal) |
| Monorepo | **Turborepo + pnpm** | apps/{web,mobile,panel,admin} + packages/{core,types,api-client,validation,ui} |
| DB | **Neon (serverless Postgres)** + pgvector | Scale-to-zero (mevsimsellik), branching DX; saf Postgres → düşük lock-in |
| ORM | **Drizzle** | pgvector + RLS + serverless + SQL-kontrol bizim profilimiz; cold-start/bundle avantajı |
| Kuyruk/Jobs (MVP) | **Render Cron + jobs tablosu**, `JobQueuePort` arkasında | MVP'de **Redis gerekmez**; async LLM/bildirim/zamanlı check-in işleri. *(Düzeltme: pg-boss'un sürekli polling'i Neon compute'unu uyutmaz → scale-to-zero ölür. Cron+tablo erken/mevsimsel-çukur fazında scale-to-zero'yu korur ~$0. İşler dakika-toleranslı.)* **Faz 2: BullMQ+Redis** (port adapter'ı değişir, domain kodu sabit) |
| Cache/Realtime/Leaderboard | **Redis → Faz 2** (sabit managed: DO Managed/Redis Cloud) | presence (pub/sub) + leaderboard (sorted set) + cache; **sosyal özelliklerle gelir**. Rate-limit MVP'de Cloudflare edge |
| Object storage | **Cloudflare R2** | S3-uyumlu, **sıfır egress** (resim-yoğun ürün), Cloudflare ekosistemi |
| Edge/güvenlik | **Cloudflare** | DNS+CDN+SSL+DDoS+WAF + RateLimit + Turnstile + Images + Access |
| Hosting | **Render (PaaS)** | Hobby→dev, Pro→production; güvenilir + Frankfurt (Neon'a bitişik) + öngörülebilir; Docker → taşınabilir. Bare Droplet değil (ops yükü, "performans" gerekçesi geçersiz) |
| AI — metin | **GPT-5 (OpenAI)** [şimdilik; Türkçe-eval ile kesinleşir, Ports&Adapters değiştirilebilir] + kural motoru (hibrit) + pgvector RAG | sohbet + analiz-yorumu + grounded + check-in → **tek ses** |
| AI — vision | **Gemini Flash** | foto→konu-kategorize (ucuz + güçlü vision) |
| Auth | **Kendi JWT** (NestJS, refresh rotasyon, Passport+argon2) | authZ zaten custom → bütünlük; per-MAU maliyet yok, lock-in yok |
| Ödeme | iyzico (abonelik → Faz 3 marketplace alt-üye-işyeri) | |
| E-posta | **Postmark** (transactional) | doğrulama/şifre-reset/fatura-bildirim/dunning/trial-hatırlatma; SPF/DKIM/DMARC; *(US → KVKK aktarım ifşa; toplu pazarlama gerekirse sonra ek araç)* |
| Hata izleme | Sentry | |

### Neden Neon (Supabase değil)
- NestJS iş mantığını sahipleniyor → Supabase'in BaaS katmanı (auto-API/realtime/edge) **gereksiz + split-brain riski.** Storage = R2, presence = (Faz 2) Redis, auth = **kendi JWT**.
- Mevsimsellik → Neon'un **scale-to-zero** + branching DX + saf Postgres (düşük lock-in) birebir. Topluluk konsensüsü: "sadece sağlam DB istiyorsan Neon." *(Neon Auth kullanmıyoruz — auth kendi JWT, §8.)*

### Cloudflare rol dağılımı
```
Cloudflare (ön kapı/edge):
  DNS+SSL+CDN+DDoS+WAF      → temel güvenlik/performans
  Rate Limiting            → §3/§7 suistimal + LLM maliyet kalkanı (backend'e ulaşmadan)
  Turnstile                → §3 bot/Sybil/sahte-hesap engeli (kayıt+forum), gizlilik-dostu
  Images                   → resim optimizasyonu (avatar/deneme foto/forum)
  Access (Zero Trust)      → admin paneli koruması
  R2                       → object storage
[ çekirdek: NestJS + Neon (+ Faz 2: Redis) — Cloudflare veri primitiflerinden (D1/KV/DO) uzak dur → lock-in yok ]
```

### Altyapı (MVP)
- Uygulama: **Render (PaaS)**, Docker'lı, **tek bölge Frankfurt/AB** (KVKK/GDPR + Neon'a bitişik).
- DB: Neon (AB bölgesi). Kuyruk: Render Cron + jobs tablosu (`JobQueuePort` arkasında). CI/CD: GitHub Actions + Docker. *(Redis + BullMQ Faz 2'de eklenir.)*
- **Kubernetes YOK** (MVP'de gereksiz); PaaS orkestrasyonu halleder → gerçek ölçekte managed K8s (DOKS vb.).
- **Maliyet kalkanı:** Neon max-CU sınırı + bütçe uyarısı + Cloudflare edge rate limit (Faz 2: + Redis) → sürpriz fatura yok.

### Tek API mimari notu
Tek API hem web hem mobile'a hizmet eder → **API versiyonlu (`/v1`) ve geriye-uyumlu** olmalı (mobil kullanıcı zorla güncellenemez). OpenAPI → tip-güvenli client codegen (orval) → `api-client` paketi web+mobil paylaşır.

### Mimari stil: Modüler Monolit + Pragmatik Clean + DDD
- **Bağımlılık kuralı:** dıştan içe; domain framework bilmez; altyapı (Neon/iyzico/LLM/R2) en dışta, içeriye *takılır* (Ports & Adapters).
- **Pragmatik Clean:** bağımlılık kuralı her yerde aynı, ama **katman derinliği işe göre.** Basit CRUD (makale oku) → controller+service+repo. Kritik domain (economy/payments/ai/forum-doğrulama) → tam katman (domain/application/infrastructure/presentation).

### Modül haritası (bounded context)
```
identity · coaching · ai · content · forum · community · economy
payments · notifications · admin · (marketplace=Faz3)
```
Kural: modüller birbirinin tablosuna dokunmaz; **public arayüz / event** ile konuşur.

### Event-driven omurga (kritik)
Modüller arası tetikler senkron zincir değil, **domain event** ile gevşek bağlı:
```
PostVerified (forum) →
  economy: coin PENDING→CONFIRMED (ledger)
  ai:      C-katmanına snapshot + embedding kuyruğu
  community: leaderboard güncelle (Redis)
  notifications: yazara push
```
Forum dinleyicileri bilmez → yeni tepki = yeni dinleyici, mevcut koda dokunmadan. İçeride NestJS `EventEmitter`; modüller ayrışırsa kuyruk/mesaj kuyruğuna taşınır (kod aynı).

### Kullanılacak design pattern'ler (nerede/neden)
| Pattern | Nerede | Neden |
|---|---|---|
| Repository | Tüm DB erişimi | Domain'i ORM'den ayır |
| Dependency Injection | Her yer (NestJS) | Test, gevşek bağ |
| Ports & Adapters | LLM, iyzico, R2, push | Sağlayıcı takılabilir/değiştirilebilir |
| Strategy | AI yönlendirme, bölge ödül politikası, doğrulama katmanı | if-else yerine strateji |
| Domain Events | Modüller arası | Gevşek bağ, genişleyebilir omurga |
| Outbox | economy, payments | Event'i DB tx ile garantili yayınla |
| Ledger (append-only) | XP/coin | Bakiye=satır toplamı; PENDING/CONFIRMED/REVERSED |
| Idempotency | iyzico webhook, kuyruk | Çift coin/abonelik engeli |
| Worker/Queue (port) | LLM, bildirim, analiz | §7 maliyet: ağır iş async. `JobQueuePort` arkasında — **MVP: Render Cron + jobs tablosu** (scale-to-zero korunur); Faz 2: **BullMQ+Redis** (adapter değişir, domain sabit). *(pg-boss elendi: polling scale-to-zero'yu öldürür + zaten Faz 2'de BullMQ ile değişecekti = ortada kalan seçenek.)* |
| Policy/Guard + RLS | RBAC + tenancy (user_id/org_id) | Erişim kararı tek yer + Postgres RLS çift kemer. **Tek sürücü:** `pg` Pool (`drizzle-orm/node-postgres`); RLS-session tx-scoped `SET LOCAL` (`withUserContext`). Local Postgres + Neon ikisinde çalışır. *(Önceki neon-http dual-driver sadeleştirildi: API edge değil, Render'da persistent → pooled bağlantı tx/RLS'i doğal destekler; ayrıca local docker Postgres parity. Karar: devnote 0007.)* |
| Saga (sonra) | ödeme→abonelik, coin pending→confirmed | Çok adımlı akış |

### API + Realtime
- **REST `/v1` + OpenAPI** (mobil için güvenli) + **Zod doğrulama** (FE+BE paylaşır, `validation` paketi).
- **WebSocket Gateway** (NestJS + Socket.io) → presence/mahalle/canlı oda; REST'ten ayrı kanal. **Faz 2** (sosyal); çoklu-instance ölçeğinde Redis adapter eklenir.

### ⚠️ Fazla mühendislikten kaçın
- ❌ MVP'de: tam CQRS+Event Sourcing, mikroservis, her modülde 4-katman seremonisi.
- ✅ Şimdi: net modül sınırları + repository + DI + domain events + ledger + idempotency + ports.
- Kural: **pattern'i ancak çözdüğü acıyı yaşayınca ekle.** Şimdi sadece *sınırları* doğru çiz.

### AI Koç Mimarisi
- **Eğitim değil, bağlam enjeksiyonu:** Fine-tuning / kullanıcı-başına model YOK. Tek model; kişiselleştirme = her cevapta kullanıcının **yapılandırılmış özetini** prompt'a vermek. (Aynı model + farklı bağlam → farklı cevap.)
- **Veri toplama (free dahil):** Tüm kullanıcılardan davranış verisi toplanır → free'de **kural-temelli** özellikleri besler (LLM yok); premium/trial'da **aynı veri LLM bağlamına** girer. (Açık rıza / KVKK.)
- **Akış:** ham olay → Postgres (RLS) → **kural motoru** özet/metrik (ucuz) → **Context Builder** (yapılandırılmış özet, ham değil, PII-min) → LLM (no-training) [+ gerekirse pgvector RAG = bilgi merkezi].
- **Context Builder içeriği (kompakt, niyet-kapılı, token-tavanlı):** statik profil (hedef/sınav/geri sayım) + performans (net trendi/zayıflık/saat/streak/plan) + durum (mood/tetik) + **Hafıza Profili** + son sohbet + mesaj.
- **Hafıza Profili:** kullanıcı başına **damıtılmış kalıcı özet** (motivasyon, zorluklar, desenler, taahhütler, ton) → koç "seni hatırlar". **Reflection loop** (async kuyruk, `JobQueuePort`): metrik = kural motoru, nitel = **seyrek** LLM-özet; her cevaba ucuzca enjekte. *(Gizlilik: ham itiraf değil, desen/flag tut.)*
- **Saklama:** kişisel/davranış verisi = Postgres (Neon, **RLS**, SQL). **pgvector yalnız içerik** (bilgi merkezi/forum), davranış verisi değil. LLM'e **PII'siz özet**; no-training API + üçüncü-taraf/yurt-dışı aktarım ifşası (KVKK).
- **Maliyet (§7):** sayılar kural motorundan (LLM uydurmaz, sadece anlatır); free = LLM yok, premium = rate-limit.
- **Model seçimi:** **metin = GPT-5 (OpenAI)** (şimdilik; **Türkçe-kalite testiyle** kesinleşir — Claude alternatif) · **vision = Gemini Flash** (foto-kategorize). Metin **tek model = tek ses** (sohbet/analiz-yorumu/grounded aynı). Metin-içi **tiering** aynı ailede (rutin ucuz / derin güçlü). **Opus & DeepSeek elendi** (pahalı / KVKK-Çin). **Tahmini maliyet ~$0.10–0.20/premium-kullanıcı/ay** (tiering; canlı kalibre), free ≈ $0. Çoklu sağlayıcı **Ports&Adapters** arkasında.

---

## 9. Roller, Paneller & Marketplace

### Yüzey → Platform haritası
> İlke: **4 ayrı mobil app yapma.** B2C tüketici (yaşam), diğer üçü yönetim/üretim (masaüstü iş).

| Kitle | Web | Mobil | Asıl ortam |
|---|---|---|---|
| **B2C öğrenci** | ✅ (responsive + SEO) | ✅ birincil *(uzun vade; **MVP web-first**, §10)* | Mobil — günlük ritüel |
| **Koç** | ✅ **birincil** (tam panel) | ⏳ Faz 2 (ince companion) | Web |
| **B2B kurum (org-admin)** | ✅ **tek** | ❌ | Web |
| **Admin (iç yönetim)** | ✅ **tek** (Cloudflare Access arkasında) | ❌ | Web |

Monorepo: `apps/web` (pazarlama+B2C), `apps/mobile` (B2C Expo), `apps/panel` (koç+B2B, rol-bazlı), `apps/admin` (iç araç, ayrı/korumalı).

### Rol sınırları: Koç vs B2B
- **Koç = öğrenci-seviyesi operatör** (kişisel koçluk yapar, *kazanır* → komisyon). Yaprak.
- **B2B kurum = yönetim/şemsiye katmanı** (koçları+öğrencileri yönetir, koçluk yapmaz, *öder* → koltuk lisansı). Koçların üstünde.
- Koç **bağımsız** (org yok, marketplace) **veya org'a bağlı** (org atar, marketplace'te satmaz) olabilir. **MVP: bir koç ya bağımsız ya tek org** (çoklu-org sonra).
- Kurum koçsuz da çalışabilir (sadece AI koç / kendi öğretmenlerini koç atar).
```
User.role: STUDENT | COACH | ORG_ADMIN | EDITOR | ADMIN
User.organization_id (nullable)
CoachStudent (coach_id, student_id, status, source: INVITE|MARKETPLACE)
Organization (lisans/koltuk, ayarlar)
```

### Koç ↔ Öğrenci bağlantısı (faza göre)
- **Faz 2 — "Dışarıdan öğrenci" (BYOS):** koç davet kodu/linki üretir → öğrenci girer → **çift-opt-in onay** (mahrem veriye erişim için şart, KVKK). App = takip aracı; **iletişim platform dışı** → chat/video gerekmez.
- **Faz 3 — Marketplace:** satın alma = **otomatik bağlantı** + AI "akıllı brief" koça; iletişim **platform-içi** (aracısızlaşma kalkanı).

### İletişim (chat/video)
- **Faz 2:** yok (dışarıdan iletişim).
- **Faz 3:** **async chat = taban** (platform-içi, kayıtlı, moderatable). **Canlı video ilk aşamada YOK**; gerekirse **3. parti SDK** (Daily/LiveKit/Twilio) — "build değil buy".

### Marketplace modeli & komisyon
- **Karar: managed marketplace — işlemden % komisyon (para platformdan akar).** Armut tarzı **lead-satışı DEĞİL** (lead-fee = aracısızlaşmayı davet eder; sürekli koçluk ilişkisine uymaz).
- **Keşif:** vitrin gez + platformdan satın al; erken **kürasyonlu** havuz (Faz 2), sonra açılır. Opsiyonel reverse-matching keşif olabilir ama para modeli yine komisyon.
- **Komisyon = yüzde** (sabit değil — sabit regresif); minik işlemler için opsiyonel minimum.
- **Tek seferlik DEĞİL → paket/abonelik** (her döngü komisyon). "Aylarca konuşurlarsa" sorununun çözümü tekrarlayan satış.
- **Süreyle azalan komisyon** (örn. %25→%15→%10): koç platformda kaldıkça daha çok cebine kalır → kaçma cazibesini düşürür.
- **İlk görüşme ücretsiz** ama **kısa + platform-içi + iletişim-maskeli** (en büyük kaçak deliği — çitlenmeli, suistimal limiti), sonra aylık aboneliğe dönüşüm + % komisyon.

### Fiyatlandırma
- **Güdümlü bantlar (taban + tavan), serbest piyasa değil** → fiyat-hassas kitlede "dibe doğru yarış"ı engeller.
- **Bantlar veriden:** koç mevcut ücretleri (Faz 0) + öğrenci ödeme gücü (§7) + rakip kıyas; **kademeli** (koç seviyesi); canlı veriyle kalibre.
- **Rekabet fiyatta değil, kalitede** (itibar sinyalleri).

### Sadakat & aracısızlaşma kalkanları
Aracısızlaşma kaçınılmaz → **yasakla değil, kalmayı kaçmaktan kârlı/güvenli kıl:**
1. İletişim bilgisini ifşa etme (chat'te numara/IBAN otomatik maskele).
2. Para platformdan aksın (iyzico escrow → komisyon otomatik).
3. **Platform-içi değer kilidi:** AI brief + takip + chat + ilerleme verisi → dışarı çıkmak iki tarafa da zarar.
4. **İtibar/sıralama kilidi:** kaçan koç görünürlüğünü kaybeder.
5. Ödeme güvencesi / iade → platform-içi ödeme daha güvenli.
6. Paket/abonelik + azalan komisyon (yukarıda).

**Sıralama/vitrin sadakati:**
- **Kalite-ağırlıklı** (saf "hacim" değil → erken koçu zirveye kilitlemesin): doğrulanmış puan + yanıt hızı + öğrenci tutma + forum ✓ katkısı + aktiflik.
- **Yorumlar sadece ödeme yapmış öğrenciden** (sahte yorum engeli).
- **Yeni koça şans** ("yükselen koç" görünürlüğü → cold-start).

**Kaçıranın cezası — havuç > sopa:**
- ToS yasağı + **tespit sinyalleri** (chat'te iletişim paylaşımı, "ilişki aktif ama ödeme durdu" deseni) + **kademeli ceza** (uyarı → askı → ban). Kalıcı ban = açık/ağır vaka, son çare (yanlış pozitif maliyetli + yan hasar).

### B2B akışı (hedef: küçük operatörler)
**Başlangıç hedefi:** bağımsız koçluk ofisleri, etüt merkezleri, kurslar (büyük dershane zinciri değil).

**Temel kavrayışlar:**
- **B2B = yeni ürün değil; mevcut öğrenci+koç deneyiminin üstüne org-admin yönetim katmanı + toplu raporlama + tenancy.** Düşük inşa maliyeti.
- **Konumlandırma: rakip değil tamamlayıcı** — "ders senden, takip/koçluk bizden" (§0 "ders öğretmiyoruz" burada avantaj).

**Küçük operatöre göre tasarım:**
- **Self-serve onboarding** (satış-destekli değil): org oluştur → koltuk ayarla → link/kodla toplu öğrenci davet.
- **Yalın özellik:** kadro listesi + durum + temel toplu dashboard + toplu davet + koltuk faturalama. (Grup/şube, derin analitik, white-label → sonra.)
- **Sahip = admin + koç örtüşmesi:** bir kullanıcı aynı anda ORG_ADMIN + COACH taşıyabilmeli (etüt merkezi sahibi hem yönetir hem koçluk yapar).
- **Ucuz koltuk-başı fiyat** (~20-50 öğrencili operatöre uygun).
- **Org öğrencisi premium'u org lisansından alır** (bireysel abone olmaz) → "org-sponsorlu erişim" mantığı.

**İki stratejik bonus:**
- **Organik yükselme:** bağımsız/marketplace koçu büyüyünce → küçük ofis (B2B). Koç ve B2B bir süreklilik, ayrı silo değil.
- **Ucuz edinim flywheel'i:** bir etüt merkezi 40 öğrencisini sokunca = 40 kullanıcı düşük maliyetle + sosyal katmanı besler (§7 "ucuz edinim" derdine çözüm).

### B2B — Topluluk, Sanal Sınıf & Koç Zekâ Katmanı (Faz 2/3)

**Topluluk erişimi (B7 kararı):** Org öğrencileri **genel topluluğa katılır** (anonim, kendi kimliği). **Profilde org etiketi YOK** → öğrenci özerk, anonimlik + KVKK korunur. Org ilişkisi içeride (`org_id`, yönetim katmanı), sosyalde görünmez. → **Özel org sosyal kohortu YOK** (önceki "gruplar=özel mahalle" fikri düştü); flywheel korunur. Org gruplama ihtiyacı = yönetim katmanı (duyuru/plan).

**Güçlü B2B farkı = Koç Zekâ Katmanı (WhatsApp'ın yapamadığı):**
İletişim/duyuru WhatsApp'ta bedava → fark olamaz. Fark = **veri + AI ile koçu "süper-koça" çevirmek:**
- **Akıllı brief + triyaj:** koç panele girince "kim geride, neden, ne yapmalı" otomatik öne çıkar.
- **Veri-tetikli müdahale uyarısı** ("Ayşe 4 gün inaktif → mesaj at").
- **AI koç öğrenciyi 7/24 destekler** (koçun ders araları yapamadığı ölçek = kaldıraç).
- **Otomatik plan/ödev takibi + rapor.**
- **ROI:** "aynı koç ekibiyle 2-3x daha çok öğrenciyi daha iyi takip."
- **Savunulabilir:** veri bizde olmalı → öğrenci app'i kullanır → WhatsApp kopyalayamaz (lock-in).

**AI → öğretmen güven çizgisi:**
- Öğretmene **GİDER:** performans (net/trend/zayıflık) + aktivite (saat/streak/plan) + **eyleme-dönük flag** ("motivasyon düşük görünüyor").
- Öğretmene **GİTMEZ:** öğrencinin AI'a **ham itirafları** → sadece sinyal/flag, içerik değil → **AI-yoldaş güveni** korunur (§0).
- Şeffaf + onaylı (öğrenci kurum altında, ilerlemesi öğretmene görünür — KVKK). B2C'de öğretmen yok (opsiyonel veli izleyici).

**Sanal sınıf (engagement/aidiyet yüzeyi — farkı besler):**
- Canlı **birlikte-çalışma** (body-doubling) + senkron Pomodoro
- **Koç/öğretmen varlığı** (office hours, check-in, moral — insani dokunuş)
- Sınıf panosu (duyuru/takvim/materyal) + sınıf **Q&A/yardımlaşma**
- **Kolektif hedef/streak** ("sınıfça X saat" — yarış değil, beraberlik) + etkinlik (deneme günü birlikte)
- Yarışma = **hafif/opsiyonel**; kullanılırsa **grup-bazlı + çaba-only + asla bireysel-utandırma** (bireysel lig yok).
- **Döngü:** sanal sınıf → öğrenci aktif → veri → koç zekâsı (brief/flag) → zamanında müdahale → öğrenci tutulur + kurum değeri.

### Panel içerikleri (özet)
- **B2C (web MVP; mobil = Faz 2 birincil):** onboarding, AI koç+check-in+sohbet, plan+geri sayım, Pomodoro+streak, deneme analizi(manuel+foto-kategorize), bilgi merkezi(okuma+grounded AI), hayal panosu, duygu check-in, ghost, abonelik; **(Faz 2)** mahalle+forum+ekonomi+canlı oda.
- **Koç (web tam panel + Faz2 ince native companion):** companion = öğrenci listesi/durum, bildirim, AI brief okuma, hızlı aksiyon; ağır iş (plan oluştur, rapor) → **in-app browser ile web panele köprü + token-devri otomatik giriş**. Web = plan/ödev, raporlar, forum cevap/doğrula, (Faz3) marketplace yönetimi.
- **B2B (web):** öğrenci grubu yönetimi, koç↔öğrenci atama, toplu plan/ödev, kurumsal raporlar, lisans/koltuk+faturalandırma.
- **Admin (web-only):** kullanıcı yönetimi, içerik/bilgi-merkezi editörlüğü (A/B/C+doğrulama), moderasyon kuyruğu, koç vetting, ekonomi yönetimi (coin/XP tavanları+suistimal), abonelik/ödeme/refund, mahalle yönetimi, metrikler (LLM maliyet/retention/dönüşüm).

### Pazar doğrulaması / referans modeller
Modelimiz kanıtlı; taktiklerimiz endüstri-standardı (icat değil, en iyi pratik):
- **En yakın şablon: BetterHelp / Talkspace** (abonelik + **async-öncelikli mesajlaşma** + opsiyonel video + algoritmayla eşleştirme + %20-50 komisyon). → "Canlı video şart değil, async chat taban" kararını doğrular.
- **% komisyon:** Wyzant %25, italki %15, Preply → tipik %15-25.
- **Aracısızlaşma kalkanları (hepsi sahada):** iletişim maskeleme (Fiverr/Upwork), ödemeye-kadar-gizleme (Airbnb), off-platform yasağı + askı/ban (Upwork), NLP/ML izleme (kaçak niyeti flag). Akademik literatür de var (Hagiu & Wright "platform leakage").
- **Reddettiğimiz model doğrulandı:** Thumbtack lead-satışı (=Armut) → işlemi tutmaz, kaçağı kabul eder.

### Yönetim Paneli & Moderasyon
**İç araç:** sadece sahip + ekip. Öğrenci/koç/B2B **erişemez** (ayrı `apps/admin`, Cloudflare Access, davetle hesap — self-signup yok).

**Alt-roller (panel-içi RBAC):** editör (içerik/bilgi merkezi+doğrulama), moderatör, destek, finans, süper-admin. **Audit log baştan** (her admin aksiyonu: kim/ne/ne zaman).
- **Yetki devri ≠ admin erişimi:** dış güvenilir kullanıcıya (koç, kıdemli topluluk) görev verilirse → **kendi yüzeyinde scoped izin**, admin paneline sokulmaz.

**Moderasyon:**
- **Otomatik tespit — MVP = Tier-1** (küfür listesi + regex iletişim/spam, **Türkçe normalizasyon**: küçült/deasciify/ayraç). AI sınıflandırıcı (Tier-2, bağlam/atlatma) **sonraki faz.**
- **Moderatör = soft "gizle"** (kullanıcıdan kalkar ama **DB'den silmez, geri-dönülebilir**) → admin paneline tag'li düşer → **kalıcı kaldırma yüksek yetki**, o da çoğunlukla soft (fiziksel silme yalnız KVKK/hukuki). Durum: GÖRÜNÜR→GİZLİ→KALDIRILDI/RESTORE.
- **Silme = backend yeteneği**, üç yüzeyde açılır: inline (uygulama-içi moderatör) + admin kuyruğu + otomatik tetikleyici; hepsi aynı `ModerationAction`'a loglanır. ("ID ile bul-sil" sadece fallback.)
- **Neleri:** forum, chat (kaçak+küfür), mahalle, profil/yorum/vitrin, yüklenen görseller.
- **İzleme:** otomatik tespit + kullanıcı raporu (şikayet butonu) + anomali (coin farming/Sybil) + metrikler + audit.

**Config yönetimi:** Tasarımın çoğu = **ayarlanabilir parametre** (deploy'suz kalibre).
- **Merkezi registry:** tipli + Zod-doğrulamalı + cache (MVP: in-memory/Postgres, Faz 2: Redis), makul varsayılan. Magic-number dağıtma.
- **Sık ayarlanan → admin UI** (coin/XP miktar+tavan, rate limit, küfür listesi, fiyat, eşikler). **Hassas (para/coin/komisyon) → bounds + audit** (yanlış girişle ekonomi çökmesin). Nadir → env/kod.
- **Katalog:** ekonomi (XP/coin/tavan/seviye), moderasyon (liste/rate/auto-gizle eşiği), forum (onay eşiği/`requires_approval`), mahalle (boyut/eşleştirme), AI-maliyet (LLM rate/tavan), fiyat (B2C kademe/free-tier/komisyon%/bant/B2B koltuk), ÖSYM takvim, bildirim şablon, **feature flags**.
- **MVP config çekirdeği:** küfür listesi + rate limit + LLM kullanım tavanı + B2C fiyat/free-tier + feature flags + ÖSYM takvim.

**Yönetim fonksiyonları (MVP çekirdeği):** kullanıcı yönetimi (askı/ban kademeli, destek, KVKK sil/dışa-aktar) · içerik/bilgi-merkezi editörlüğü · temel moderasyon kuyruğu · abonelik/refund · temel metrikler (retention/dönüşüm/**LLM maliyet**) · feature flags · audit log. *(Ekonomi/mahalle/marketplace/koç-vetting yönetimi → ilgili faz.)*

---

## 10. MVP Kapsamı

> **MVP = Responsive Web, B2C-odaklı.** (Mobil = #1 fast-follow / erken Faz 2.)

### Paneller
- **B2C öğrenci web app** (asıl ürün).
- **Admin (yalın):** içerik/bilgi-merkezi editörü + kullanıcı yönetimi + abonelik/refund + temel metrik + feature flags + audit log.
- ❌ Koç paneli, ❌ B2B paneli (Faz 2+). MVP'de doğrulayıcı = ekip + AI.

### B2C özellikleri (IN) — tier işaretli
**🆓 Tamamen ücretsiz** (premium boyutu yok): onboarding/teşhis · **Pomodoro + streak** · sınav geri sayımı · bilgi merkezi **okuma** (SEO sayfaları) · kural-temelli günlük check-in/hatırlatma
**🔵 Katmanlı** (free temel + premium AI üstü):
- Çalışma planı — temel / **AI adaptif**
- Deneme analizi — manuel net-zayıflık-trend / **AI yorum**
- Hayal panosu — picker+geri sayım+küratörlü içerik / **AI kişiselleştirme**
- Duygu check-in — mood yakalama / **AI adaptif cevap**
- Ghost (geçmiş-ben) — trend-kıyas / **AI anlatım**
- Bildirim — kural-temelli / **AI kişisel bağlamsal**

**⭐ Tamamen premium** (saf AI): AI koç **veri-grounded sohbet/soru-sor** · **AI deneme yorumu** · **grounded AI cevap** (bilgi merkezi; okuma free) · **foto→konu-kategorize** (vision, rate-limit)
**Abonelik:** freemium + **kartlı 7-gün trial** · aylık **+ döngü paketi** (3-6 ay "sınava kadar").
**🎯 Kazanılan AI hakkı (MVP-light):** görev (onboarding/alışkanlık/kilometre) + arkadaş daveti (**dönüşürse**) → coin/AI hakkı (foto/sohbet). Free'de **büyüme motoru** (self-funding), premium'da **top-up alternatifi**. *(Forum/koç-katkı → Faz 2. Detay §3/§7.)*

**Premium AI kullanım:** flat (sayaç yok) · AI koç sohbet sınırsız+görünmez günlük adil-kullanım · foto "ayda X dahil + top-up". AI-hak 3 kaynağı: abonelik / top-up (para) / kazanılan (§7).

### Freemium / Premium modeli (kilitli)
- **Free'de koşulsuz/süregelen AI yok** (maliyet ~0). AI'ı tattıran iki yol: **7 gün kartlı trial** (full premium, sonra otomatik ücretlenir) **+ kazanılan AI hakkı** (davet/görev → §3, self-funding). Koşulsuz metered tadımlık YOK.
- **3 kova:** 🆓 tamamen ücretsiz · 🔵 katmanlı (free temel + premium AI) · ⭐ tamamen premium (saf AI).
- **Altın kural:** katmanlı özelliklerde **free temel kendi başına gerçekten kullanışlı** (kasten kısıtlama / dark-pattern YOK); **premium = net "akıllı" yükseltme.**
- **Ücretsiz katman = AI'sız tam bir çalışma-takip + analiz + bilgi + motivasyon app'i** (edinim + veri akışı + premium huni). **Premium = AI koç katmanı.**
- *(Sosyal-ücretsiz-tier Faz 2'de eklenir.)*

### Deneme analizi tasarımı
- **Konu taksonomisi (önceden, küratörlü referans — ML dataset değil):** `ExamType → Section → Subject → Topic` + section soru sayıları. Editör ÖSYM yapısından tanımlar; onboarding/plan/analiz/AI'ı besler. Dikey büyürken generic.
- **MVP giriş = subject-bazlı** (sonuç kâğıdına uygun, ~1-2 dk): ders başına Doğru/Yanlış/Boş → **Net** (kural **per-exam config**: KPSS/YKS D−Y/4, LGS D−Y/3) + ders-seviyesi **zayıflık haritası** + **trend**. AI yok, copyright yok.
- **Premium (MVP): yanlış soru foto → AI konuya KATEGORİZE eder** (çözmez! §0) → **konu-seviyesi ince zayıflık haritası.** Premium farkı burada hissedilir. (Vision maliyeti → premium + rate-limit; halüsinasyon koruması: çözüm yok, sadece sınıflandırma.)
- **OCR giriş** (sonuç fotoğrafından D/Y/B **otomatik doldurma**) = fast-follow (MVP'de manuel hızlı giriş yeterli).

### Görünmez temeller (MVP'de kurulur)
Kendi JWT, Drizzle+Neon, Render, Cloudflare (WAF/Turnstile/R2/CDN), iyzico abonelik + e-arşiv, Cron+jobs kuyruğu (`JobQueuePort`), payments modülü, audit log. **Veri modeli `org_id`/koç ilişkilerine hazır** (kullanılmaz) → Faz 2/3 kırılmaz.

### Ertelenenler
- **Faz 2:** mahalle (sosyal) + **canlı çalışma odası** (kütle ister), forum + ödül ekonomisi, koç (BYOS) + companion, **mobil app (#1)**, B2B (yalın), Redis (presence/leaderboard), **B-katmanı bilgi merkezi**, **OCR giriş** (otomatik sayı doldurma), native push, yaratıcı özellikler (yol arkadaşı / deneme günü / sezon etkinlikleri / sesli check-in vb.)
- **Faz 3:** marketplace (koç keşfi/komisyon/chat/azalan komisyon/sadakat).

---

## 11. Veri Modeli Özeti (kavramsal)

> Kod/migration değil; varlıklar ve ilişkiler.

**Bilgi merkezi**
- `InfoArticle` (A) — title, body, category, exam_type, [güven üst-verisi]
- `InfoCategory`, `CalendarEvent` (sınav takvimi ÖSYM/MEB — tarih olarak sorgulanabilir)
- *(B-katmanı `CadrePlacement`/taban-puanı plandan çıkarıldı.)*

**Forum**
- `Zone` — type (BILGI/SOHBET/CALISMA_ODASI), reward_policy, requires_approval
- `Thread` — soru/tartışma/destek, status, accepted_post_id, view/saved_count, tags
- `Post` — body, status (AÇIK/TOPLULUK_ONAYLI/DOĞRULANDI/REDDEDİLDİ/AI_TABANINDA), score, is_accepted, verified_by, verification_tier (COMMUNITY/COACH/OFFICIAL), ai_ingested
- `Vote` — value (+1/-1), weight (oylayanın XP'sine göre), (user+post) benzersiz

**Kullanıcı & kurum**
- `User` — role: STUDENT / COACH / **ORG_ADMIN** / EDITOR / ADMIN (çoklu-rol mümkün: org-admin+coach) ; `organization_id` (nullable → bağımsız vs org'a bağlı)
- `Organization` — ad, lisans/koltuk, ayarlar (tenant)
- `CoachStudent` — coach_id, student_id, status (PENDING/ACTIVE/ENDED), source (INVITE/MARKETPLACE)

**Ekonomi & moderasyon** *(çoğu Faz 2)*
- `LedgerEntry` (defter) — currency (XP/COIN), amount (+/-), reason, ref, status (PENDING/CONFIRMED/REVERSED). **Bakiye = satırların toplamı; asla tek sayı tutma, asla silme.**
- `Badge` / `UserBadge` — statü + kimlik rozetleri
- `ModerationAction` — denetim izi (kim, neyi, neden onayladı/sildi/gizledi)

**C katmanına giriş:** `DOĞRULANDI` olan Post, AI'a bağımsız **snapshot** olarak kopyalanır (`source="forum, doğrulanmış, editör/koç, tarih"`), embedding'lenir, "düşük-otorite" etiketiyle sunulur.

---

## 12. Genel Açık Konular
- [x] ~~Bilgi merkezi kapsamı~~ → **MVP = A-only (küratörlü içerik → SEO sayfası + grounded AI, kaynaklı); B → Faz 2.** NotebookLM = iç editör aracı. (bkz. §1)
- [x] ~~B katmanı (taban puanı/scraping)~~ → **plandan çıkarıldı** (değer/risk dengesi olumsuz).
- [ ] Topluluk-onay eşiğinin kalibrasyonu (canlı veriyle).
- [ ] Koç vetting kriterleri (belge, mülakat, deneme katkısı) — netleştirilecek.
- [ ] **(Backlog) C-snapshot tazeleme** (Faz 2 forum ile): event-tetikli geçersiz kılma (major-edit / sil / kalite-düşüş / TTL) + tipo significance-gate + yeniden-doğrula. Tasarım taslağı hazır; uygulama **backlog**.
- [ ] **Wedge kararı** (§6): A-only kararıyla → **MVP edinim wedge'i bilgi-merkezi-SEO DEĞİL** (zayıf); içerik/organik + küçük-B2B flywheel + ücretsiz sosyal tier. Bilgi-merkezi-SEO wedge'i **Faz 2'de B-katmanı gelince güçlenir.** (Kesin edinim stratejisi açık.)
- [x] ~~Mobil zamanlaması~~ → **Karar: responsive web MVP; mobil = #1 fast-follow (erken Faz 2).** Push eksiği web-push+e-posta ile köprülenir.
- [ ] **Kazanılan ekonomi kalibrasyonu:** streak onarma + coin tavanları + **kazanç oranları (davet/görev → coin/AI hakkı)** + foto allowance + AI koç günlük adil-kullanım → hepsi config, **ödül ≤ eylem değeri** kuralıyla canlı veriden kalibre.
- [ ] **Kesin fiyatlandırma** (B2C kademe fiyatları, koç komisyon %'si, marketplace fiyat bantları taban/tavan, B2B öğrenci-başı fiyat) — gerçek WTP/rakip verisiyle **Faz 0 araştırması** ister.
- [ ] **Marketplace detayları (Faz 3):** azalan-komisyon takvimi, sıralama algoritması sinyalleri/ağırlıkları, ücretsiz-görüşme suistimal limiti, kaçak tespit sinyalleri, video SDK seçimi (gerekirse).
- [x] ~~B2B topluluk erişimi~~ → **Genel topluluğa anonim katılır, profilde org etiketi yok** (özerklik+KVKK+flywheel). Özel org sosyal kohortu yok. B2B sosyal/fark = **sanal sınıf + koç zekâ katmanı** (akıllı brief/triyaj/müdahale/AI-kaldıraç), AI→öğretmen güven çizgisiyle. (§9)
- [ ] **LLM maliyet ölçümü:** aktif kullanıcı başı hedef maliyet ve hibrit oranın (kural vs LLM) kalibrasyonu — canlıda doğrulanacak.
- [x] ~~Auth~~ → **Karar: kendi JWT** (NestJS, refresh rotasyon, Passport+argon2). authZ zaten custom; per-MAU maliyet/lock-in yok.
- [x] ~~ORM~~ → **Karar: Drizzle** (pgvector + RLS + Neon serverless + SQL-kontrol profilimize uyuyor; Prisma 7 sonrası ikisi de geçerli ama Drizzle daha iyi oturdu).
- [x] ~~Redis sağlayıcı~~ → **Karar: MVP'de Redis YOK** (kuyruk=**Render Cron + jobs tablosu** `JobQueuePort` arkasında, rate-limit=Cloudflare, cache ertelendi). **Redis + BullMQ Faz 2'de** (presence+leaderboard+kuyruk) eklenir; sağlayıcı = sabit managed (DO/Redis Cloud), hosting'le netleşir. *(pg-boss elendi — gerekçe §8 pattern tablosu.)*
- [x] ~~Hosting~~ → **Karar: Render (PaaS)** — Hobby→dev, Pro→production; güvenilir+Frankfurt+öngörülebilir. Bare Droplet değil. Docker → taşınabilir, geri-dönülebilir.
- [ ] **Ödeme/hukuk ön-hazırlık (lansman öncesi):** şirket kurulumu (şahıs vs Ltd), iyzico başvuru, web yasal sayfaları (mesafeli satış/gizlilik/iade/KVKK), mali müşavir/hukuk onayı (marketplace lisans + stopaj + cayma hakkı).
- [ ] **Faz 2 mobil ödeme (açık):** Web2App2Web (web'de sat → komisyon %0) vs IAP (SBP %15 → TR %50 iadeyle efektif ~%7,5). Öneri: **hibrit** (web-sell birincil + IAP opsiyonel). TR komisyon-iadesi uygunluğu + güncel anti-steering durumu → mali müşavir/hukuk teyidi. Güvenlik sorunu yok (iyzico hosted).
- [ ] (Taslaktan devam) Detaylı PRD + domain modeli, marka/domain.
