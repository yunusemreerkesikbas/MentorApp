# Cloudflare R2 kurulumu

> Nesne depolama (§8). Bu doküman sıfırdan çalışır bir R2 kurulumuna götürür ve sonunda
> **dashboard'a bakmadan** çalıştığını kanıtlar.
> İlgili: [`integrations.md`](./integrations.md) · [`infra/r2/`](../../infra/r2/) ·
> `apps/api/src/shared/adapters/storage/r2-storage.adapter.ts`
>
> **Dev/test kurulumu tamam (2026-08-07):** `mentor-public`/`mentor-private` (default jurisdiction),
> r2.dev açık, CORS uygulandı, hesap kapsamlı Object Read & Write token. `storage:check` **34/34**
> yeşil (beş prefix × presign/CORS/PUT/GET/readObject/deleteObject + private-bucket reddi). Vision
> board görsel yüklemesi tarayıcıda uçtan uca doğrulandı. **Kalan:** production için ayrı,
> `-J eu` bucket çifti — bugünkü kurulum yalnız dev/test.

## Ne saklıyoruz

İki bucket. Ayrım keyfi değil: deneme fotoğrafları kişisel veri ve sadece kullanıcının kendi
AI hattına servis ediliyor, geri kalanı sayfada gösterilmek üzere yükleniyor.

| Prefix | Bucket | Üreten | Sınır |
|---|---|---|---|
| `avatars/` | public | `identity/application/users.service.ts` | 2 MB · jpeg, png |
| `forum-attachments/` | public | `forum/application/forum-thread.service.ts` | 5 MB görsel / 10 MB dosya |
| `content/` | public | `content/application/content.service.ts` | 5 MB · jpeg, png, webp |
| `vision-board/` | public | `coaching/application/vision-board-image.service.ts` | 5 MB · jpeg, png, webp |
| `mock-exams/` | **private** | `ai/application/photo-upload.service.ts` | 5 MB · jpeg, png |

Prefix listesi tek yerde: [`apps/api/src/shared/storage/storage-prefixes.ts`](../../apps/api/src/shared/storage/storage-prefixes.ts).
Yeni bir yükleme özelliği eklerken prefix **oraya** eklenir; R2 adapter'ı ve dev fake controller'ı
ikisi de oradan okur. Bu dosya, iki listenin ayrışması yüzünden forum eklerinin R2'de tamamen
kırık olmasının ardından oluşturuldu.

---

## 0 · Hesapta R2'yi etkinleştir

**İlk seferde bu adım atlanırsa her şey burada durur.** R2 hesap üzerinde ayrıca açılması gereken
bir ürün; açılmadan `wrangler` şunu döner:

```
X [ERROR] A request to the Cloudflare API (/accounts/<id>/r2/buckets) failed.
  Please enable R2 through the Cloudflare Dashboard. [code: 10042]
```

Dashboard → **R2 Object Storage** → açılış ekranındaki etkinleştirme akışını tamamla. Bu yalnızca
dashboard'dan yapılabiliyor; wrangler'ın karşılığı yok.

**Ne kadara mal olur:** aylık ücretsiz kota **10 GB depolama · 1M Class A (yazma/listeleme) ·
10M Class B (okuma)**, ve R2'de **egress her zaman ücretsiz** — bu projenin öngörülebilir
kullanımı kotanın çok altında. Aşımda: $0.015/GB-ay, $4.50/M Class A, $0.36/M Class B.
Yine de §7'deki bütçe alarmını kurmakta fayda var.

## 1 · Bucket'ları oluştur

```bash
npx wrangler login
npx wrangler r2 bucket create mentor-public
npx wrangler r2 bucket create mentor-private
```

Dashboard'dan da yapılabilir (**R2** → **Create bucket**), ama CLI komutu kopyalanabilir olduğu
için ortam kurmayı tekrarlanabilir kılıyor.

**Jurisdiction, bucket oluşturulurken verilen ve geri alınamayan bir karar.** Adapter endpoint'i
`R2_JURISDICTION=eu` iken `<account>.eu.r2.cloudflarestorage.com` olarak kuruluyor; default
jurisdiction'da açılmış bir bucket o endpoint'te **404 verir**.

- **Test/geliştirme:** yukarıdaki komutlar (jurisdiction yok), `.env`'de `R2_JURISDICTION=auto`.
- **Production:** `npx wrangler r2 bucket create mentor-public -J eu` (dashboard'da
  **Specify jurisdiction → EU**). `render.yaml`'da `R2_JURISDICTION: eu` sabit ve KVKK açısından
  doğru olan bu.

Test ve production bucket'ları zaten ayrı olmalı, dolayısıyla farklı jurisdiction sorun değil.

> `--location` (`weur`, `eeur` …) ile `--jurisdiction`'ı karıştırma: ilki sadece coğrafi
> yerleştirme **ipucu**, veri ikametgahı garantisi vermez. KVKK/GDPR için gereken `-J eu`.

## 2 · Public okuma yolunu aç

Sadece **`mentor-public`** için: bucket → **Settings** → **Public Development URL** → **Enable** →
kutuya `allow` yaz → **Allow**. Çıkan `https://pub-….r2.dev` adresi `R2_PUBLIC_BASE_URL` olur.

`mentor-private` için **açma.** Orada public erişim olmamalı; `getPublicUrl` zaten `mock-exams/`
için `FORBIDDEN` atıyor, bu onun altyapı tarafındaki karşılığı.

> r2.dev Cloudflare tarafından açıkça "production için değil" deniyor: saniyede yüzlerce istekte
> `429`, bant genişliği kısıtlanabiliyor, cache/WAF/Cache-Control yok. Test için yeterli.
> Domain belirlendiğinde §7'ye bak — geçiş tek bir env değişkeni.

## 3 · CORS politikalarını uygula

Politikalar repoda: [`infra/r2/cors-public.json`](../../infra/r2/cors-public.json) ve
[`cors-private.json`](../../infra/r2/cors-private.json). Origin'leri gerçek değerlerle
güncelledikten sonra:

```bash
npx wrangler login
npx wrangler r2 bucket cors set mentor-public  --file infra/r2/cors-public.json
npx wrangler r2 bucket cors set mentor-private --file infra/r2/cors-private.json
npx wrangler r2 bucket cors list mentor-public
```

> ⚠️ R2 aynı politika için **iki farklı şema** kabul ediyor: wrangler
> `{"rules":[{"allowed":{…}}]}` bekler, dashboard'ın JSON sekmesi ise S3 tarzı
> `[{"AllowedOrigins":…}]` ister. Birini diğerine yapıştırmak hata verir.
> `infra/r2/*.json` **wrangler şemasında**; detay [`infra/r2/README.md`](../../infra/r2/README.md).

**Private bucket'ın da CORS'a ihtiyacı var.** Presigned URL kimlik doğrulamayı taşır ama tarayıcı
yine CORS uygular; politika olmadan deneme fotoğrafı yüklemesi geçerli bir URL'le bile başarısız
olur. Sadece `PUT` alıyor — `GET` yok, çünkü o objeler hiçbir sayfadan okunmamalı.

Public bucket `GET` + `PUT` alıyor. `GET` iki iş için: normal görsel gösterimi ve **vision board
PNG export'u** — export, görselleri canvas'a çizip geri okuduğu için CORS'suz "tainted canvas"
hatası verir (`BoardExportTaintedError` bunu ayrı bir mesajla gösterir).

## 4 · API token üret

> Bu adım ve §2 (r2.dev toggle) dashboard'dan yapılmak zorunda — wrangler'ın karşılığı yok.
> Kurulumun geri kalanı CLI'dan tekrarlanabilir.


R2 → **Manage R2 API Tokens** → **Create API token**.
- Permission: **Object Read & Write**
- Scope: **Apply to specific buckets** → sadece bu iki bucket
- TTL: kalıcı (rotasyon Faz 0 ops işi)

Çıkan **Access Key ID** ve **Secret Access Key** bir daha gösterilmez. `R2_ACCOUNT_ID` R2 genel
bakış sayfasında.

## 5 · Env'leri doldur

Lokal `.env` (şablon: [`.env.example`](../../.env.example)):

```
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BUCKET=mentor-public
R2_PRIVATE_BUCKET=mentor-private
R2_PUBLIC_BASE_URL=https://pub-....r2.dev
R2_JURISDICTION=auto
```

Altısı da zorunlu — biri eksikse API **boot etmez** (`env.validation.ts`). Production'da
`STORAGE_PROVIDER=fake` ayrıca yasak.

**Render:** `render.yaml`'da bu anahtarlar `sync: false`, yani değerleri dashboard'dan giriliyor
(`STORAGE_PROVIDER` ve `R2_JURISDICTION` hariç — onlar dosyada sabit).

## 6 · Doğrula

```bash
pnpm --filter @mentor/api storage:check
```

Her prefix için presign → CORS preflight → PUT → (public ise `Origin` başlıklı GET + CORS başlığı
kontrolü) → `readObject` → `deleteObject` → gerçekten silindi mi. Başarısız her satır **hangi
adımın eksik olduğunu** söyler. Beklenen: beş prefix ✅, `mock-exams/` için "private key has no
public URL" ✅.

Ardından `pnpm dev` ile tarayıcıda, **giriş yapmış halde**:

1. `/hedef/pano` → görsel yükle → **Kaydet** → sayfayı yenile → görsel duruyor mu
   (yenilemeden sonrası artık `blob:` önizleme değil, gerçek R2 URL'i)
2. Aynı sayfada **İndir** → PNG iniyor mu. Onun yerine "görseller indirmeye kapalı geldi"
   mesajını görüyorsan CORS `GET`'i eksik.
3. Profil → avatar · Topluluk → **foruma görsel ekle** · Analiz → deneme fotoğrafı
   (sonuncusu private bucket + sunucu tarafı `readObject` yolunu geçer)

## 7 · Custom domain'e geçiş

Domain belirlendiğinde: bucket → **Settings** → **Custom Domains** → **Connect Domain**
(domain Cloudflare'da olmalı). Sonra:

1. `R2_PUBLIC_BASE_URL`'i yeni domain'e çevir — **tek değişiklik bu.** Mutlak URL hiçbir yerde
   saklanmıyor; `vision_boards.board` gibi belgeler yalnız key tutuyor ve URL her okumada
   türetiliyor, dolayısıyla eski içerik de anında yeni domain'den servis edilir.
2. `infra/r2/cors-*.json` içindeki origin'leri güncelle ve yeniden uygula.
3. **Cache purge** — CORS politikası değişince önceden cache'lenmiş objeler eski başlıklarla
   servis edilmeye devam eder.
4. İstersen public development URL'i kapat (WAF/Access kullanacaksan **kapatmalısın**, yoksa
   bucket r2.dev üzerinden açık kalır).

## Tuzaklar

- **Presign ömrü 15 dakika** ve **süresi dolmuş presigned URL `403` dönerken CORS başlığı
  taşımaz** → tarayıcı JS'i hatayı okuyamaz, kullanıcı sessiz bir başarısızlık görür. Dosya seçip
  uzun süre bekleyen kullanıcıda görülebilir.
- **Boyut sınırları R2'de zorlanmıyor.** Presigned PUT ne gönderilirse kabul eder; tablodaki
  limitler client kontrolü + dev fake yolunda geçerli. Gerçek koruma orphan süpürme ve lifecycle.
- **Orphan süpürme:** `vision-board/` için 6 saatte bir çalışıyor, 24 saatten eski ve hiçbir
  kayıtlı panoda geçmeyen objeleri siliyor (`VisionBoardMaintenanceService`). Forum'un kendi
  süpürmesi var. `avatars/` ve `content/` için yok — oralarda yükleme hep bir kayda bağlanıyor.
- **Lifecycle (opsiyonel):** bucket → Settings → Object lifecycle rules → tamamlanmamış multipart
  upload'ları 7 gün sonra iptal et. Tek parça PUT kullandığımız için risk düşük, bedava sigorta.
- **Kullanım alarmı:** R2 → Overview → **Create budget alert** ile hesap düzeyinde dolar eşiği
  kur. Ücretsiz kota (10 GB · 1M Class A · 10M Class B) bu proje için fazlasıyla yeterli;
  alarm sürpriz bir döngü/yanlış yapılandırmaya karşı.
- **Orphan süpürmesinin işlem maliyeti ihmal edilebilir:** `listObjects` bir **Class A** işlem ve
  süpürme 6 saatte bir çalışıyor — API instance başına ayda ~120 istek, 1M'lik kotaya karşı hiç.
