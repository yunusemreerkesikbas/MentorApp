# Bekleme listesi ve davetli kayıt (mobil öncesi)

Tarih: 2026-11-05 · Branch: `feature/APP-137` · Tuval: https://claude.ai/artifact/CLedRf3gaAyDtrajcyiDKX (yön A)

## Neden
Uygulama canlıya alındığında mobil uygulama henüz hazır olmayacak. O güne kadar dışarıdan kimse
kendi kendine hesap açamamalı. Yalnızca admin'in içeri aldığı kişiler (ve mevcut hesaplar) girebilmeli.
Landing'e gelip "başlamak" isteyen herkes bir bekleme listesine yazılmalı, kapı açılınca davetini almalı.
Bu durum deploy gerektirmeden, admin config'den açılıp kapanabilmeli; mobil hazır olunca kayıt tek
anahtarla herkese açılır.

**Başarı:** canlıda tek bir yabancı hesap açılmaz; landing'den gelen ilgi kaybolmaz (bekleme listesi dolar);
admin bir e-postayı tek tıkla davet eder ve kişi kendi başına kayıt olur.

## Hedefler
- Kayıt modunu dinamik yönetmek: **açık**, **davetli**, **kapalı**.
- Davetli ve kapalı modda landing ve kayıt girişlerinde bekleme listesi modalı.
- Bekleme listesi ve davet listesi tek tablo; admin panelinde liste, davet, silme.
- Davet e-postası (Puhu tonu) ve davet linkiyle mevcut kayıt formu.
- KVKK: amaç ve süre aydınlatma metninde, süre dolunca otomatik silme.

## Hedef olmayanlar
- Admin'in hesap açması / şifre belirlemesi (seçenek B reddedildi).
- Listeye katılınca onay e-postası (kota korunur, kararla dışarıda).
- Kayıt açılınca bekleyenlere toplu "kapılar açıldı" e-postası. Gerekirse ayrı iş.
- Sıra numarası, "N kişi bekliyor" sayacı, referans/öne geçme mekaniği.
- Mobil uygulama tarafı.

## Anti-hedefler (çalışsa bile başarısızlık sayılır)
- Formu dolduran birinin sonunda "kayıt kapalı" hatası görmesi (bugünkü durum).
- Davet listesinde kimin olduğunun dışarıdan anlaşılabilmesi (e-posta sızdırma / enumeration).
- E-postanın URL'de taşınması (KVKK, tarayıcı geçmişi, log).
- Mevcut kullanıcıların girişinin etkilenmesi.
- Modalın ziyaretçiye "davetle giriliyor" demesi ya da saklama süresi gibi hukuki bilgiyi göstermesi.

## Mevcut durum (incelendi)
- `signup.enabled` (config, kill-switch) ve `signup.pilot.enabled` (davetli mod) zaten var.
  Kontrol `apps/api/src/modules/identity/application/signup-admission.ts`, şifreli kayıt
  (`auth.service.ts:67`) ve Google kayıt (`google-auth.service.ts:138`) ortak kullanıyor.
- Davet listesi bugün env'de: `PILOT_INVITED_EMAILS` (`config/pilot-invited-emails.ts`,
  `env.validation.ts`), değişmesi API restart istiyor; kapasite `signup.pilot.max_invited_emails` (50).
  Pilot modu canlıda hiç açılmadı, taşınacak veri yok.
- `/v1/app/availability` (`common/config/app-availability.service.ts`, web: `lib/app-availability-server.ts`)
  `studentSignup` dönüyor ama web öğrenci kaydı için kullanmıyor; landing/`/hosgeldin`/giriş sayfasındaki
  kayıt linkleri koşulsuz.
- Landing'deki "Ücretsiz başla" butonları `/kayit`'a değil `/hosgeldin`'e (`/welcome`) gider; slayt sonu
  `/kayit`'a, slaytı gören dönüş ziyaretçisi `welcome-guard.tsx:36` ile doğrudan `/kayit`'a.
- Koç kaydı ayrıca `mentorship.applications.open`'a bağlı: kapalıyken API COACH kaydını reddeder
  (`auth.service.ts:71`), koç CTA'ları gizlenir (`landing-nav.tsx:66`, `landing-after.tsx:18`,
  `signup/page.tsx:260`) ve koç formu "kapalı" ekranı gösterir (`signup/page.tsx:156`).
- Google kayıt yolu niyet (rol) taşımaz (`google-auth.service.ts:143-152`); Google callback hataları her zaman
  `/giris?googleErrorCode=…`'a döner (`auth.controller.ts:144-150`); giriş modunda bilinmeyen Google e-postası
  admission'dan önce `AUTH_GOOGLE_ACCOUNT_NOT_FOUND` ile düşer (`google-auth.service.ts:129-136`).
- Admin'de kullanıcı oluşturma ve bekleme listesi yok (`apps/admin/.../leads` şablon sahte veri, ilgisiz).

## Kullanıcının kararları
1. **Admin içeri alma = davet listesi (A).** Admin e-postayı listeye ekler veya bekleyen satırı davet eder;
   kişi davet linkinden kayıt formuna gelir, KVKK onayını kendisi verir, hesabını kendisi açar.
2. **Landing:** "Ücretsiz başla" ve "Koç olarak başla" modalı açar. "Hesabım var" normal girişe gider.
   Giriş sayfasındaki "Kayıt ol" linki ve doğrudan `/kayit` adresi de modalı gösterir.
3. **Modal sadece e-posta ister.**
4. **E-posta:** listeye katılınca e-posta yok; yalnızca admin davet edince davet e-postası.
5. **KVKK:** kişi kayıt olunca satırı silinir; kayıt olmayanlar **6 ay** sonra silinir.
6. **Davet e-postası Puhu tonunda** (metin aşağıda).
7. **Koçlar aynı listede**, "koç" etiketli; koç davet linki koç kayıt akışını açar.
8. **Modal tasarımı yön A · "Senin penceren"** (tuvaldeki `Main.dc.html` ve `A-Mobile.dc.html`).
9. **Koç daveti başvuru anahtarını geçer.** Davetli/kapalı modda "Koç olarak başla" her zaman görünür ve
   modalı açar; `koç` rollü davetli, `mentorship.applications.open` kapalı olsa da koç hesabı açar.
   Başvuru anahtarı yalnızca açık modda (herkese açık kayıt) koç kaydını yönetir.

## Kim ne görür

| Mod (config) | Ziyaretçi landing'de | `/kayit` | Davet linkiyle gelen | Mevcut kullanıcı |
|---|---|---|---|---|
| **Açık** `signup.enabled=true`, `signup.pilot.enabled=false` | Bugünkü gibi, form | Form | Form | Giriş |
| **Davetli** `true` / `true` | "Başla" → modal | Modal | Form; API yalnızca davetli e-postayı kabul eder | Giriş |
| **Kapalı** `signup.enabled=false` | "Başla" → modal | Modal | Modal (kimse kayıt olamaz) | Giriş |

Canlıya çıkış ayarı: **davetli**. Mobil hazır olunca: **açık**.

## Nasıl (kararlaştırılan iskelet)

### Config ve availability
- Yeni config anahtarı yok; üç mod mevcut iki bayrakla ifade edilir.
- `AppAvailabilityDto`'ya (`packages/types/src/app-availability.ts`) tek anahtar: **`signupWaitlist`** =
  `!(signup.enabled && !signup.pilot.enabled)`. Web modal/form kararını yalnızca buna göre verir.
  Deploy sırası: önce API, sonra web (`economy` anahtarındaki gibi).
  `signupWaitlist` true iken koç CTA'ları `coachSignup`'tan bağımsız olarak görünür (karar 9);
  false iken bugünkü `coachSignup` kuralı aynen geçerli.
- `signup.pilot.max_invited_emails` korunur, anlamı değişir: aynı anda **davetli ama henüz kayıt olmamış**
  satır sayısı üst sınırı. Aşılırsa yalnızca admin'in yeni "Davet et" işlemi hata alır; zaten davetli
  olanların kaydı hiçbir zaman kapanmaz (sınırı mevcut sayının altına indirmek dahil). Bugünkü
  "liste büyükse herkese kapat" davranışı kalkar. Üst sınır 50'den 1000'e çıkar, varsayılan 50 kalır.
  Açıklaması güncellenir. *(benim kararım)*
- `PILOT_INVITED_EMAILS` env'i ve `pilot-invited-emails.ts` kaldırılır (`.env.example`, `render.yaml`,
  spec'ler dahil).

### Veri
Tek tablo, ör. `signup_invitations`:
- `email` (mevcut paylaşılan e-posta normalizasyonuyla, benzersiz), `role` (`student` | `coach`),
  `status` (`waiting` | `invited`), `created_at`, `invited_at`, `invited_by`.
- Bekleme listesinden gelen satır `waiting` başlar; admin daveti `invited` yapar. Admin'in doğrudan
  eklediği e-posta doğrudan `invited` olur.
- Kayıt başarılı olunca (şifreli veya Google) satır silinir.
- Silme kuralı: `waiting` satırlar `created_at`'ten, `invited` satırlar `invited_at`'ten 6 ay sonra silinir.
  Davet etmek saati sıfırlar, böylece geç davet edilen kişinin de 6 ayı olur. *(benim kararım)*
- AGENTS.md §4 "org-ready schema" kuralına uyulur (gerekiyorsa org kolonu).

### Kayıt kontrolü
`assertSignupAdmission` env listesi yerine tabloya bakar: davetli modda e-posta için `invited` satır yoksa
`AUTH_PILOT_INVITATION_REQUIRED`. Kapalı modda bugünkü gibi `AUTH_SIGNUP_CLOSED`. Giriş, hesap bağlama,
CAPTCHA, KVKK kontrolleri değişmez; davet abonelik veya AI hakkı vermez.

**Rol davet satırından gelir** *(benim kararım)*. Davetli modda hesabın öğrenci mi koç mu olacağını URL'deki
`rol=koc` ya da formdaki niyet değil, satırdaki `role` belirler. Böylece:
- Davetli öğrenci `?rol=koc` ile koç olamaz.
- Davetli koç öğrenci formundan girse de koç olur.
- Google ile kayıt olan koç davetlisi de koç olur. Rol satırdan okunduğu için OAuth state'ine rol
  taşımak gerekmez.

`koç` satırı `auth.service.ts:71`'deki `mentorship.applications.open` kontrolünü geçer (karar 9).
Açık modda bugünkü niyet + başvuru anahtarı kuralı aynen kalır.

### API uçları
- **Herkese açık** `POST /v1/waitlist` `{ email, role }`:
  - Turnstile (mevcut `turnstile.service.ts`, yeni action) ve IP limiti (yeni `identity.auth_rate.waitlist_ip_limit`).
  - Her geçerli istekte **aynı başarı cevabı**: e-posta zaten listede, zaten davetli ya da zaten kullanıcıysa
    da. Kullanıcıysa satır açılmaz. Mod açıkken de aynı cevap ama satır açılmaz (amaçsız veri tutulmaz).
    *(benim kararım, enumeration koruması + KVKK veri azaltma)*
  - Geçersiz e-posta formatında 400.
- **Admin** (`SUPPORT` rolü, her işlem audit'li) *(rol benim kararım)*:
  - Listeleme: durum ve rol filtresi, e-posta araması, sayfalı.
  - Bekleyen satırı davet et; e-postayla doğrudan davet ekle (e-posta + rol); davet e-postasını yeniden gönder; sil.

### Davet e-postası
Mevcut Puhu hoş geldin şablon ailesi (`shared/adapters/email/email-render.ts`), iş kuyruğuyla (`JobQueuePort`).
- **Konu:** Pencerenin ışığı yandı, davetin geldi!
- **Gövde:** Sıra sana geldi! PuhuKoç'taki yerin hazır. Davetin bu adrese özel, kayıt olurken bu e-postayı kullan.
- **Buton:** Hesabımı aç → `<WEB_URL>/kayit?davet=1` (koç: `&rol=koc`). Link e-posta veya token taşımaz;
  güvenliği API'deki e-posta eşleşmesi sağlar. *(benim kararım)*
- **Alt not:** Bu daveti sen istemediysen görmezden gelebilirsin.

### Web
- **Modal** (yeni client bileşen; masaüstünde ortalanmış dialog, `sm` altında alt sayfa):
  - `role="dialog"`, odak tuzağı, Esc ve dış tıklamayla kapanır, kapanınca odak tetikleyen butona döner.
  - Tasarım tuvaldeki yön A'nın birebir karşılığı; değerler DESIGN.md ve landing tokenlarından
    (`--landing-night-*`, `--landing-lamp`, `--play-radius`, LEDGE butonu).
  - Gönderince W1 görseli W2'ye geçer, pencereye ışık parlaması gelir (ışık yalnızca görselde, metinde değil).
    Hareket azaltmada yalnızca görsel değişir.
  - Hangi butondan açıldığına göre `role` gizli gönderilir. *(benim kararım)*
  - Turnstile widget'ı mevcut `signup-turnstile.tsx` deseniyle.
- **Tetikleyiciler** (`signupWaitlist` true iken; false iken bugünkü link aynen kalır). Karar 2 gereği
  landing'deki "Başla" butonları slaytları atlayıp modalı doğrudan landing'de açar:
  - `/welcome`'a giden tüm "Ücretsiz başla" linkleri: `city-panels.tsx:91` ve `:236`, `landing-after.tsx:108`,
    `landing-nav.tsx:72`, `career-picker.tsx:73`, `landing-premium.tsx:77`.
  - Koç CTA'ları: `landing-nav.tsx`, `landing-after.tsx` koç bandı, `for-coaches/*`. Karar 9 gereği
    `coachSignup` kapalıyken de görünürler.
  - `/hosgeldin` doğrudan adresle açılırsa slaytlar çalışır, son slayt "Başla" modalı açar
    (`welcome-carousel.tsx`). Dönüş ziyaretçisi yönlendirmesi (`welcome-guard.tsx:36`) `/kayit` yerine modal
    gösterir.
  - Giriş sayfası "Kayıt ol" linki (`login/page.tsx`).
  - `/kayit` (`signup/page.tsx`): `davet=1` yoksa modal açık gelir, kapatınca `/`'a döner. `davet=1` varsa form;
    koç formunun "kapalı" ekranı (`signup/page.tsx:156`) `davet=1` iken gösterilmez.
  - Sunucu bileşenlerindeki `Link`'ler modalı açan küçük client adalarına dönüşür.
- **Google hataları** *(benim kararım)*:
  - `/kayit?davet=1`'den başlayan Google akışı dönüş yolunu OAuth state'inde taşır. Kayıt modundaki
    callback hataları `/giris` yerine `/kayit?davet=1&googleErrorCode=…`'a döner; form davet hatasını gösterir.
  - `/giris`'te davetli/kapalı modda `AUTH_GOOGLE_ACCOUNT_NOT_FOUND`, `AUTH_SIGNUP_CLOSED` ve
    `AUTH_PILOT_INVITATION_REQUIRED` hata metni yerine modalı açar. Diğer Google hataları bugünkü gibi metin.
- **Davet linkiyle gelen ama başka e-posta yazan:** form hatası
  "Bu adres davet listesinde yok. Davetin geldiği adresi yaz."
- i18n: `waitlist.*` anahtarları, `tr.json` + `en.json`, `docs/copy/voice.md` kurallarıyla.

### Admin paneli
Yeni "Bekleme listesi" sayfası (`apps/admin/src/app/(general)/`):
- Tablo: e-posta, rol (Öğrenci/Koç), durum, katılım ve davet tarihi.
- Satırda "Davet et" / "Yeniden gönder" / "Sil"; üstte "E-postayla davet et" formu.
- `config-hints.ts`'e üç modun açıklaması.

### KVKK ve silme
- Aydınlatma metnine bekleme listesi bölümü eklenir: amaç (açılış ve davet haberi göndermek), hukuki
  sebep, 6 aylık saklama süresi ve silme kuralı. Bu bilgiler modalda yazılmaz.
- Günlük silme, mevcut günlük tetikte çalışır: `trial-maintenance.yml` → `dispatch-daily-reminders`
  zaten süresi dolan auth-rate ve telefon satırlarını siliyor; bekleme listesi silmesi oraya eklenir.

## Modal metni (son hali, kullanıcı seçimi "Çok yakında")
Kurallar (kullanıcı kararı):
- Modal ziyaretçiye **davet** ya da kısıtlama anlatmaz; ne yapacağını söyler.
- Saklama süresi, amaç gibi KVKK bilgileri modalda yazılmaz, yalnızca aydınlatma metnine girer.
  Modalda aydınlatma metni linki de yok (kullanıcı kararı, 2026-11-05); metne landing alt
  bilgisindeki yasal linklerden ulaşılır.
- `docs/copy/voice.md` landing kuralı gereği metin pencere/ışık/gece benzetmesine yaslanmaz;
  sahneyi görsel anlatır.

Bekleme:
- Rozet: Çok yakında
- Başlık: Yerini şimdiden ayıralım!
- Gövde: PuhuKoç'u senin için hazırlıyoruz. E-postanı bırak, açıldığında ilk sana haber verelim.
- Etiket: E-posta adresin · Yer tutucu: ornek@eposta.com
- Buton: Beni listeye ekle
- Hata: Bu adres eksik görünüyor. Bir daha yazar mısın?
- Ağ hatası: Şu an kaydedemedik. Birazdan tekrar dener misin? *(benim kararım)*
- Alt: Hesabın var mı? **Giriş yap**

Listedesin:
- Rozet: Yerin hazır · Başlık: Harika, listedesin!
- Gövde: Açıldığımızda ilk haber **{email}** adresine gelecek.
- Buton: Tamam · Alt: Adresi yanlış mı yazdın? **Düzelt**

Koç için aynı metin. *(benim kararım)*

## Sanat
Kullanıcı üretir (promptlar sohbette verildi; landing stil bloğu + enerjik Puhu).
- **W1:** karanlık pencere ve fenerli Puhu, 1536×1024.
- **W2:** pencere yanmış, Puhu zıplıyor; W1'in düzenlenmiş hali.

Puhu ve pencere görselin ortadaki %60'ında; masaüstünde 392×210, telefonda yaklaşık 358×168 kırpılır.
WebP/AVIF olarak `apps/web/public/visuals/waitlist/` altına gider. Sanat gelene kadar
`visuals/landing/city-facade.webp` (W1) ve `room-puhu.webp` (W2) yer tutucu olarak kullanılır.

## Builder'a kalanlar
Tablo/kolon adları, migration numarası, DTO ve modül yerleşimi, modal bileşen bölünmesi, admin sayfa
düzeni, Turnstile action adı, IP limiti varsayılanı, test dosya adları.

## Doğrulama
- **Birim testleri:**
  - Admission: davetli, davetsiz, kapalı; rol satırdan (öğrenci `rol=koc` ile koç olamaz, koç davetlisi
    başvurular kapalıyken koç olur, Google koç davetlisi koç olur).
  - Davet sınırı: sınır dolunca yeni davet reddedilir, mevcut davetliler kayıt olabilir.
  - Waitlist servisi: tekrar, mevcut kullanıcı ve açık mod için aynı cevap; normalizasyon.
  - Silme kuralı.
  - Availability `signupWaitlist` hesabı.
- **API e2e:** `signup-admission.e2e-spec.ts` env yerine tabloyla; waitlist ucu (Turnstile, limit); admin uçları + RBAC.
- **Web e2e:**
  - Landing → modal → başarı.
  - `/kayit` modal; `/kayit?davet=1` form.
  - Giriş sayfası linki; açık modda eski davranış.
  - `pilot-signup.spec.ts` güncellenir.
  - Prod build ile (dev server yanlış kırmızı veriyor).
- **Tarayıcı kontrolü:**
  - 375 ve 1440 genişlikte ekran görüntüsü.
  - Klavye ile tüm akış.
  - Hareket azaltma.
- **Doküman:** `docs/features/identity.md` zaman çizelgesi; `docs/core/deployment.md` çıkış ayarı
  (`signup.pilot.enabled=true`, "public signup" notu güncellenir).
