# Arkadaş daveti: ödeyen kullanıcı getiren davet akışı

> 2026-10-25 · Durum: uygulandı · Branch: `feature/APP-119`
> İlgili: [`economy.md`](../../features/economy.md), [`docs/copy/voice.md`](../../copy/voice.md),
> bileşen `apps/web/src/app/[locale]/(app)/profile/_components/economy-invite-card.tsx`.

## Neden

Profildeki "Davet et" kartı bugün çalışıyor ama amacına hizmet etmiyor. 2026-10-25'te gerçek API'ye
karşı 12 senaryo koşuldu (4 test hesabı, sahte ödeme sağlayıcısı). Çalışan: kod üretimi, kendi kodunu
kullanma / olmayan kod / ikinci kullanım / premium reddi, ödeme sonrası davet edene +20 Coin, iade
geri alımı. Sorunlar:

1. Metin yanlış söz veriyor: "Kayıt olup aktif olunca ikinize de hak düşer." Davet edilen hiçbir şey
   almıyor (`onboarding.invite-redeemed` görevi `economy.quest.disabled_ids` ile kapalı), şart "aktif"
   değil ilk ödeme. "Hak düşer" kullanıcıya bir şey anlatmıyor.
2. Kod büyük/küçük harfe duyarlı: doğru kod küçük harfle yazılınca "Davet kodu geçersiz."
3. Bağlantı yok; arkadaş kayıttan sonra Ayarlar → Davet et'i kendisi bulmalı. Yandaki "Tavsiye et"
   satırı kodsuz genel link paylaşıyor; atıf kayboluyor.
4. Deneme (TRIALING) premium sayıldığı için deneme başlatan arkadaş kodu artık giremiyor.
5. Davet eden ilerlemesini göremiyor (`InviteService.summary` var, endpoint/ekran yok).
6. Kod kullanıldıktan sonra form aynen duruyor.
7. Koç arayüzde gizli ama API kod veriyor ve kullandırıyor.
8. Kart açılınca odak dialoga geçmiyor (erişilebilirlik).

## Hedef (kullanıcının kararı)

Davet **ödeyen kullanıcı getirmek** için var. Davet edenin ödülü arkadaşın **ilk gerçek ödemesinde**
düşer (bugünkü kural, değişmiyor: deneme, sponsor, 0 TL ve yenilemeler saymaz; kaynak ödemenin iadesi
ödülü geri alır).

### Hedef olmayanlar

- Davet edilene uzatılmış deneme (kullanıcı reddetti).
- "Birlikte geçin" (Spotify Duo tarzı ikili indirim) — ikinci tur fikri, bu kapsamda değil.
- Davet edene Premium gün/indirim — Coin'de kalıyor.
- Mobil mağaza (IAP) tarafında davet teklifi — mobil uygulama yok; o aşamada ayrıca tasarlanır.

### Anti-hedefler (çalışsa bile başarısızlık sayılır)

- Ödeme ekranının tutmayacağı bir indirimi vaat etmek (karşılama ekranı, kart, bildirim).
- Davet edene başka birinin ödeme durumunu **isimle** göstermek (KVKK).
- Piyango / FOMO dili ("hak kazan!", "kaçırma!"), suçlama.
- Koçların davet ekonomisine girmesi.

## Kararlar

### Kim ne yaşar

| Kişi | Deneyim |
|---|---|
| Davet eden (ücretsiz veya premium öğrenci) | Kartta kişisel bağlantısını paylaşır; katılan arkadaşları isimle, Premium'a geçenleri yalnız sayıyla görür; arkadaş ilk ödemesini yapınca Coin kutlaması. |
| Davet edilen (henüz hiç ödeme yapmamış öğrenci) | Bağlantıdan gelirse karşılama ekranı → kayıt → onboarding → kod kendiliğinden uygulanır. Premium'a geçerken davet indirimi. Davet edenle çalışma arkadaşı bağı. |
| Koç | Akışın tamamen dışında: kart yok (bugün olduğu gibi), API de kod vermez/kullandırmaz. |

### 1. Davet edilene indirim (kullanıcının kararı)

- Mevcut `promotions` modülüne yeni kural tipi **`INVITED`** ("davetle gelen") eklenir:
  `PromotionRuleType` (`@mentor/types`), `evaluateRule` içinde bir case + testi, `rule_type` CHECK
  constraint'i için migration, admin kampanya formunda seçenek, `@mentor/validation` kural parametresi.
- Kural, kullanıcının bir davet kodu kullanmış olması **ve** hiç ödeme yapmamış olmasıyla eşleşir.
  Parametre: `{ withinDays }` — kodu kullandıktan sonra kaç gün geçerli (varsayılan 30).
- **İndirim oranı ve süresi koda gömülmez:** admin bir kampanya satırı oluşturur (öneri: ilk ay %30,
  `appliesToPeriods: 1`). Kampanya kodsuz (otomatik) olur; arkadaş ödeme ekranında ayrıca kod yazmaz.
- **Bağımlılık kısıtı:** `EconomyModule` zaten `PaymentsModule`'ü import ediyor; ödeme tarafı ekonomiyi
  import edemez (döngü). "Bu kullanıcı davetle mi geldi, ne zaman?" sinyali `shared/ports` altında
  küçük bir port ile verilir (ekonomi uygular, ödeme tüketir) — `payments.port.ts` ile aynı desen.
  Sinyal hem `PromotionUserContext`'e (servis girdisi) hem `PromotionRuleContext`'e
  (`promotion-rule.ts`, kuralın okuduğu) `invitedAt: Date | null` olarak eklenir. Kural ayrıca
  ödeme tarafından **"hiç pozitif ödemesi oldu mu"** sinyaline ihtiyaç duyar; `hadAnySubscription`
  bunun yerine geçmez (ücret çekilmemiş deneme için de true).
- **Kötüye kullanım sınırları (kullanıcının kararı):**
  - Kod yalnız hesap açıldıktan sonraki **ilk 7 gün** içinde redeem edilebilir (`users.created_at`
    üzerinden; süre config kataloğunda, örn. `economy.invite.redeem_window_days`, varsayılan 7).
    Süre dolmuşsa yeni hata kodu, companion metin.
  - İndirim **doğrulanmış telefon** gerektirir ve **telefon başına bir kez** uygulanır. Deneme
    süresindeki telefon parmak izi deseni (`PhoneTrialService` / `getVerifiedPhoneFingerprint`)
    yeniden kullanılır. Telefonu doğrulanmamış davetliye ödeme ekranında indirim gösterilmez,
    telefon doğrulama yolu gösterilir (bugünkü deneme akışı gibi).
  - Davet edenin Coin'i bu sınırlardan etkilenmez; yalnız gerçek ödemede düşer (bugünkü cap'ler
    dahil).
- **Benim kararım — elle yazılan kupon:** bugünkü davranış kalır: ödeme ekranında başka bir kupon
  yazılırsa yalnız o değerlendirilir ve otomatik davet indirimi düşer. Ödeme ekranı ödemeden önce
  gerçek fiyatı zaten gösteriyor, yani tutulmayan bir vaat oluşmaz. Promotions'ın genel çözümleme
  mantığı değişmez.
- **Kanal kısıtı:** kodda yazdığı gibi kampanya indirimi yalnız **web** ödemesinde uygulanır
  ("mağazalar kendi fiyatını keser") ve web satın alma bayraklara bağlı
  (`payments.web.enabled`, `payments.web.redirect_to_mobile`). Web satışı kapalıyken indirim
  **gösterilmez**; karşılama ekranı ve kart indirimsiz metne düşer (bkz. Metin). Bu, ilk sürümde
  indirimin ancak web ödemesi açıldığında görüneceği anlamına gelir.

### 2. Kod kullanma kuralları

- Kod formatı: **`PUHU-XXXXXXXX`** — 8 karakter, karışan harfler yok (alfabe `0/O/1/I` hariç
  büyük harf + rakam). Üretici çakışmada bugünkü gibi yeniden dener.
- Eski `MENTOR-…` kodlar migration ile `PUHU-…` önekine çevrilir (sonek aynı kalır; `invites.code` ve
  `invite_redemptions.code`). Girişte normalizasyon: `trim → toUpperCase → ^MENTOR- → PUHU-`. Bu tek
  adım hem büyük/küçük harf hatasını hem eski kodları çözer; DTO/servis sınırında uygulanır.
- Premium kontrolü değişir: "şu an premium mu" yerine **"hiç başarılı pozitif ödemesi oldu mu"**.
  Deneme sırasında kod girilebilir. **Benim kararım:** kampanya fiyatı checkout'ta sabitlendiği
  (`promotions.reserve` checkout transaction'ında) için deneme sırasında giren arkadaşa indirim
  uygulanmaz; davet edenin Coin'i yine ilk ödemede düşer. Kart bu durumda indirim vaat etmez.
  Ödeme yapmış kişi giremez (yeni hata kodu veya mevcut
  `INVITE_ALREADY_PREMIUM` yeniden adlandırılır; mesaj "Zaten Premium'a geçmişsin" çizgisinde).
- Koç: `GET /economy/invite` ve `POST /economy/invite/redeem` koç rolüne 403 (veya mevcut rol
  gözcüsü). Mevcut "kendi kodu / ikinci kullanım" kuralları aynen kalır.
- **Benim kararım — sonradan koç olanlar:** sahibi koç olan bir kod redeem'de ve herkese açık
  okumada "geçersiz" sayılır. Dönüşüm anında davet eden **ya da** davet edilen koçsa Coin verilmez
  (outcome `DISABLED` benzeri yeni bir değer, örn. `COACH_SKIPPED`). Veritabanında temizlik yok;
  kontrol çalışma anında.
- **Benim kararım — pilot kayıt kapısı:** davet kodu `signup.pilot.enabled` allowlist'ini **aşmaz**.
  Karşılama ekranı kayıt sayfasına yönlendirir; kapı açıksa kayıt sayfasının bugünkü mesajı geçerli.

### 3. Çalışma arkadaşı bağı (kullanıcının kararı)

Bugünkü sistem kişi başı **bir** aktif çalışma arkadaşına izin veriyor (`BuddyService`). Kod
kullanıldığında (redeem başarılı olduktan sonra, best-effort — redeem'i asla düşürmez):

| Durum | Ne olur |
|---|---|
| Davet edenin aktif çalışma arkadaşı ve bekleyen giden isteği yok, davet edilenin de yok | Davet edilenden davet edene çalışma arkadaşı **isteği** oluşturulur ("Ayşe senin davetinle geldi, birlikte çalışalım mı?"). Davet eden kabul eder. |
| Herhangi biri zaten eşleşmiş ya da bekleyen isteği var | İstek oluşturulmaz. İkisi birbirini **karşılıklı takip eder** (takip sınırsız). |

`FollowService`/`BuddyService` bugün kullanıcı adıyla çalışıyor; id ile çağıran bir servis metodu
eklenebilir. Ekonomi zaten `IdentityModule`'ü import ediyor.

### 4. Bağlantı ve karşılama (kullanıcının kararı)

- Bağlantı: `puhukoc.com/davet/PUHU-XXXXXXXX` (tr) / `/en/invite/...` (en) — `routing.ts`
  pathname'i. Sayfa herkese açık (oturum gerektirmez), `(app)` dışında; `join-room` deseni.
- Karşılama ekranı: davet edenin **yalnız görünen adı** + indirim (web satışı ve `INVITED` kampanyası
  canlıysa) + kayıt / giriş butonları. Kullanıcı adı, avatar, profil linki yok. Geçersiz kod: sakin
  bir boş durum + kayıt butonu (kod olmadan).
- Kod, kayıt ve onboarding boyunca hatırlanır (masa davetindeki `pending-invite.ts` deseni, ayrı
  anahtar, saklanan değer yalnız kodun kendisi, okurken yeniden doğrulanır) ve onboarding bitince
  kendiliğinden redeem edilir. Başarılıysa kısa bir onay; hata (ör. kendi kodu) sessizce yutulmaz,
  Ayarlar'daki kart gibi mesaj gösterir.
- **Benim kararım — oturumu açık biri bağlantıya tıklarsa:** otomatik redeem **yok**. Karşılama
  ekranı tek bir onay butonu gösterir ("Daveti kabul et"). Redeem geri alınamaz, çalışma arkadaşı
  isteği/takip oluşturur ve davet edene isim gider; herkese açık paylaşılmış bir linke tıklayan
  biri habersiz bağlanmamalı. Yeni kayıt olan için onboarding sonrası otomatik redeem kalır
  (bağlantıyla gelip kayıt olmak zaten bu niyeti gösterir).
- Karşılama ekranı için API: kodu → görünen ad (+ kampanya canlı mı) döndüren herkese açık bir
  okuma; kimlik doğrulamasız olduğu için hız sınırı (mevcut auth throttle deseni) gerekir.
- **Açıklama satırı (kullanıcının kararı):** karşılama ekranında ve Ayarlar'daki "Bir davet kodun
  var mı?" formunda, kod kullanılmadan önce görünür: *"{ad} katıldığını görecek. Premium'a geçersen
  ona Coin düşer."* (Ayarlar formunda ad bilinmiyorsa "Davet eden kişi…".) Bu satır, davet edenin
  kartında katılanların isimle ve Premium'a geçenlerin sayıyla gösterilmesinin dayanağıdır; companion
  ton, emoji yok. Hukuki yeterlilik KVKK danışmanıyla teyit edilecek (geliştirmeyi bekletmez).
- **Kayıt formuna kod alanı eklenmez.** Ayarlar'daki "Bir davet kodun var mı?" alanı ağızdan duyulan
  kodlar için yedek olarak kalır.

### 5. Davet kartı (`economy-invite-card.tsx`)

- **Kopyala → Paylaş:** `navigator.share` ile bağlantıyı paylaşır (telefonda WhatsApp vb.);
  desteklenmiyorsa bağlantıyı kopyalar. Kod kartta görünmeye devam eder.
- **İlerleme satırı:** "3 arkadaşın katıldı · 1'i Premium'da". Katılanlar isimle listelenebilir
  (kodu kendi isteğiyle girdiler); Premium'a geçenler **yalnız sayı**. **Benim kararım:** sayı
  "ilk ödemesi iade edilmemiş" redemption'ları sayar (`status='CONVERTED'` ve ödül geri alınmamış /
  outcome `REFUNDED` değil); "şu an Premium'da" için ödeme tarafına kişi başı sorgu yapılmaz.
  Metin buna uyar ("1'i Premium'a geçti"). `InviteService.summary`
  bugün `{ invited, converted }` döndürüyor; isim listesi için genişletilir. 0 katılımda satır yok
  ya da davet eden bir boş durum metni.
- **Kod kullanılmışsa** "Bir davet kodun var mı?" formu yerine durum: "Ayşe'nin davetiyle geldin"
  (+ indirim canlıysa "indirimin ödeme ekranında"). Bunun için `GET /economy/invite` yanıtı
  davet edilenin kendi redemption durumunu da taşır.
- **Ödeme yapmış kullanıcı** formu görmez (girmesi zaten reddedilir); paylaşım kısmı kalır.
- Erişilebilirlik: açılışta odak dialoga (kapat butonu veya başlık) geçer, Tab dialog içinde döner,
  kapanınca odak tetikleyen satıra geri gelir.
- Bileşen ~400 satır; ilerleme/durum parçaları alt bileşenlere bölünür (frontend standardı ~250–300).

### 6. "Tavsiye et" satırı

`application-support-card.tsx` → genel `shareUrl` yerine kişisel davet bağlantısını paylaşır.
Ekonomi kapalıysa (`economy.enabled` false, davet kodu yok) bugünkü genel linke düşer. Koçta
bugünkü genel link kalır.

### 7. Bildirimler

| Olay | Kime | Metin yönü |
|---|---|---|
| Arkadaş kodu kullandı | Davet eden | "Ayşe davetinle geldi!" (çalışma arkadaşı isteği oluştuysa bildirim onu da işaret eder; tek bildirim) |
| Arkadaş ilk ödemesini yaptı | Davet eden | Bugünkü Coin kutlaması / ledger receipt (`invite.converted`) — isim yok |

Yeni bir bildirim kategorisi/dedupe anahtarı gerekir (redemption id başına bir).

### 8. Metin ve ses

- Davet kartı, karşılama ekranı ve "davetinle geldi" bildirimi **Duolingo tarzı enerjik Puhu**
  (topluluk ekranlarındaki kural: kısa, sıcak, cümle başına en çok bir "!", satır başına en çok bir
  emoji, `aria-label`'da emoji yok). Hata ve ödeme satırları **companion** (sakin) kalır.
- "Hak düşer" bu akıştan kalkar; ne düştüğü açıkça söylenir ("20 Coin", "%30 indirim").
- Yön (son metni yazan karar verir): başlık "Arkadaşını getir!"; alt metin indirim canlıysa
  "İlk ayı %30 indirimli, üstelik birlikte çalışırsınız. Premium'a geçince sana 20 Coin.";
  canlı değilse indirim cümlesi düşer. Rakamlar API'den gelir (Coin: `economy.invite.reward_coin`,
  indirim: kampanya özeti), koda gömülmez.
- `docs/copy/voice.md`: davet overlay'ini Puhu tablosunda tamamen Puhu'ya taşı, 78–80. satırlardaki
  "invite" örneklerini güncelle, `invite_subtitle` / `redeem_pending` companion listesinden çıkar.
- tr ve en birlikte; `apps/web/messages/{tr,en}.json`, API hata metinleri `i18n/locales/{tr,en}`.

## Kısıtlar

- AGENTS.md §4: Coin para değildir; davet ödülü Coin olarak kalır, indirim ayrı ve gerçek para
  indirimi olarak `promotions` üzerinden yürür (Coin'le karıştırılmaz).
- Modül sınırları: modüller birbirinin tablolarını okumaz; sinyaller servis/port üzerinden.
- Tasarım değerleri DESIGN.md token'larından (`@mentor/ui`); yeni sayfa için yükleme iskeleti.
- Web ödemesi bir iş/vergi kararına bağlı (özelge); bu tasarım web ödemesini açmaz, yalnız açıldığında
  indirimin hazır olmasını sağlar.

## Geliştiriciye kalanlar

- Port adı/şekli, yeni hata kodu adı, migration sırası, bildirim kategorisi adı.
- Karşılama ekranının görsel tasarımı (davet kartının mor kahraman dilini paylaşması beklenir).
- Uçtan uca test: mevcut `apps/api/test/economy-invite.e2e-spec.ts` genişletilir (normalizasyon,
  deneme sırasında redeem, ödeme sonrası red, koç reddi, çalışma arkadaşı/takip yan etkisi,
  `INVITED` kampanyasının checkout fiyatına yansıması); web tarafında karşılama → kayıt →
  onboarding → otomatik redeem için Playwright senaryosu; `evaluateRule` birim testi.
- `docs/features/economy.md` (ve promotions/identity feature dokümanları) timeline girdileri.
