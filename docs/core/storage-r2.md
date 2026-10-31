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

## Current naming and launch scope (2026-10-29)

Bucket names are resource identifiers; they do not have to match `puhukoc.com`. Keep the
existing `mentor-public` / `mentor-private` dev/test buckets and their data. The separate
retained staging pair is `puhu-s1-public` / `puhu-s1-private`.

The planned trial pair is **`puhu-prod-public` / `puhu-prod-private`**, jurisdiction **`eu`**.
For the selected bounded trial, both buckets remain provider-private and media uses the existing
API domain. Do not attach `media.puhukoc.com` or enable r2.dev access. The optional paid
`render.yaml` retains its earlier direct/public-media configuration; it is not the selected trial
profile. No new buckets or migration of old objects has been performed by this source work.

Production acceptance requires matching bucket env values, scoped credentials and exact API
origins. Browsers do not contact bounded-trial buckets, so the old `infra/r2/cors-*.json` browser
policies must not be applied to them. Those policies belong to the retained direct/dev setup.
Bucket labels do not replace access controls or billing stops. Follow the
[free-first spending/release gates](../qa/2026-10-28-free-first-launch.md) before provisioning.

## Bounded trial profile (2026-10-31)

Set `STORAGE_ACCESS_MODE=bounded`, `STORAGE_PROVIDER=r2`, `R2_JURISDICTION=eu`, the exact
account/bucket scope and `R2_PUBLIC_BASE_URL=<actual HTTPS API origin>/v1/storage/media/public`.
Use a new independent `MEDIA_READ_SECRET` of at least 32 characters on the API only. It is local
signing material, not a Gemini/OpenAI key. Keep both AI providers disabled for this trial.

| Trial-wide allowance | Initial ceiling | Refill |
| --- | ---: | --- |
| Stored objects plus unresolved writes | 524288000 bytes (500 MiB) | Confirmed settled deletion only |
| Class A attempts | 10000 | None automatically |
| Class B attempts | 100000 | None automatically |
| Media payload transfer | 1073741824 bytes (1 GiB) | Never by deletion/month/restart |

Registry keys are `storage.budget.max_stored_bytes`, `max_class_a`, `max_class_b` and
`max_transfer_bytes` under the same prefix. All have positive bounded schemas. A lower setting
never rewrites usage; raising the compiled ceiling requires review. PUT charges its validated
payload, reads charge the known full manifest size, and used/uncertain transfer stays charged.
Server-side copy/list/delete and empty-bucket probes reserve no object payload bytes. HTTP
HEAD uses authorized manifest metadata without R2 work. This counter does not measure HTTP
headers, pages/assets, database traffic or other projects; monitor shared Render consumption.

The guarded raw port reserves under the singleton transaction lock before network work. It
pins one SDK wire attempt and disables region redirects. A failed/null/timeout/uncertain result
does not refill an allowance. Pending PUT capacity is retained even if a cleanup DELETE wins a
race before that PUT finishes. Tombstones prevent reusing keys. Copies require a known source.

Public prefixes use `/v1/storage/media/public/*key`; private links use the same API origin at
`/v1/storage/media/private?grant=...`. Grants expire within 300 seconds and bind key, owner and
the actual HTTP session. Session revocation is rechecked before R2. Minting URLs does not spend
allowance. Both responses are no-store/no-referrer/nosniff. Private images bypass Next image
optimization. Failed photos preserve DTO keys/text and block incomplete board exports.

### Attended initialization

Only after exact-commit CI, approved provider setup and the separately reviewed remote migration:

1. Verify both new EU buckets are empty and provider-private. Scope Object Read & Write credentials
   to this pair only; do not grant bucket management. Do not reuse the dev/staging/Craftive tokens.
2. Apply the reviewed forward migrations 0133–0135 through the separate migration connection.
   Existing migrations are immutable. Runtime uses the restricted role, never the owner URL.
3. Prepare a private runtime file with explicit production/bounded DB and R2 values. Exclude
   `DATABASE_MIGRATION_URL`. Never put credentials in command arguments, source, logs or chat.
4. Run `pnpm --filter @mentor/api storage:initialize-trial` with `--env-file`, `--expected-host`,
   `--expected-database`, `--expected-user`, `--expected-account-id`, `--expected-public-bucket`
   and `--expected-private-bucket` from the approved action package. The script rejects URL
   connection overrides and requires TLS verify-full; it validates the actual runtime role.
5. The script seals the account/bucket/jurisdiction fingerprint and reserves two Class A probes
   before sending `ListObjectsV2(MaxKeys=1)`, once per bucket. It prints only attempt/status,
   never connection strings, signing material or provider responses. READY requires two explicit
   successful empty results. A nonempty/ambiguous/error result remains blocked with usage retained.

An interrupted VERIFYING attempt requires an attended `--abandon <recorded-attempt-UUID>` with
the same target assertions before a new explicit attempt. It does not refund probes or delete
objects. Never manually change a counter to zero to make startup pass. Unknown historical
transfer facts remain null and normal bounded access fails closed; only a provably untouched
unbound state can initialize zero. Used older scopes require reviewed operator reconciliation.
There is no public initialization, reconciliation or budget reset endpoint.

### Stop, rollback and remaining acceptance

If verification fails, stop the attended probe, keep buckets private and preserve DB facts and
uncertain holds. Do not retry an uncertain write under its old reservation. A compatible rollback
must keep bounded enforcement; direct mode or a bucket rename is rejected against a sealed DB.
Retain object/operation history. If no compatible artifact exists, keep admission closed.

A database restore can rewind READY status and lifetime usage while R2 still contains later
objects or charges. Keep admission and media access closed during recovery. Preserve the
current accounting/reservation evidence before restoring, then reconcile it against retained
objects and provider evidence before reopening. An old READY row or a successful restore alone
does not establish a safe allowance; unknown operations/transfer must remain blocked.

The generic `storage:check`, migration/private-media tools and direct URL examples below belong
to the older direct/dev configuration. Do not point them at bounded trial buckets: that would
bypass reservations. No extra staging environment or hosted service is required. Complete the
[attended hosted acceptance package](../qa/2026-10-31-bounded-trial-storage-verification.md)
before admission; local tests alone do not establish hosted cold starts, mail, TLS or recovery.

## Ne saklıyoruz

İki bucket. Ayrım keyfi değil: deneme, yanlış defteri ve hayal panosu fotoğrafları kişisel veri;
yalnız sahibine veya sahibinin işlem hattına kısa ömürlü yetkiyle servis ediliyor.

| Prefix | Bucket | Üreten | Sınır |
|---|---|---|---|
| `avatars/` | public | `identity/application/users.service.ts` | 2 MB · jpeg, png |
| `forum-attachments/` | public | `forum/application/forum-thread.service.ts` | 5 MB görsel / 10 MB dosya |
| `content/` | public | `content/application/content.service.ts` | 5 MB · jpeg, png, webp |
| `vision-board/` | **private** | `coaching/application/vision-board-image.service.ts` | 5 MB · jpeg, png, webp |
| `notebook/` | **private** | `coaching/application/mistake-notebook.service.ts` | 5 MB · jpeg, png, webp |
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
10M Class B (okuma)** (Standard storage), ve R2'de **egress ücretsiz**.
Aşımda: $0.015/GB-ay, $4.50/M Class A, $0.36/M Class B.

The free allowance is shared account usage, not a hard invoice cap. Budget alerts notify
only; they do not stop usage or charges. An enforceable account-wide R2 spending stop has
not been verified. Do not enable production usage until the free-first release gates are
met. Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[budget alert behavior](https://developers.cloudflare.com/billing/manage/budget-alerts/).

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
- **Production (planned, not executed):** create `puhu-prod-public` and `puhu-prod-private`
  with `-J eu` (dashboard: **Specify jurisdiction → EU**). Keep `R2_JURISDICTION=eu` and
  the matching bucket names. Do not reuse the dev/test commands or apply the optional paid
  Blueprint as part of a Free rehearsal.

Test ve production bucket'ları zaten ayrı olmalı, dolayısıyla farklı jurisdiction sorun değil.

> `--location` (`weur`, `eeur` …) ile `--jurisdiction`'ı karıştırma: ilki sadece coğrafi
> yerleştirme **ipucu**, veri ikametgahı garantisi vermez. KVKK/GDPR için gereken `-J eu`.

## 2 · Public okuma yolunu aç

Sadece **`mentor-public`** için: bucket → **Settings** → **Public Development URL** → **Enable** →
kutuya `allow` yaz → **Allow**. Çıkan `https://pub-….r2.dev` adresi `R2_PUBLIC_BASE_URL` olur.

`mentor-private` için **açma.** Orada public erişim olmamalı; `getPublicUrl` zaten özel prefixler
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

**Private bucket'ın da CORS'a ihtiyacı var.** Defter ve hayal panosu görselleri sahibi kontrol
edildikten sonra en fazla beş dakikalık imzalı `GET` URL'siyle tarayıcıya gelir. Private CORS yalnız
`GET` açar. Yükleme PUT'u R2'ye tarayıcıdan gitmez; kimlik, oturum, limit ve gerçek dosya biçimini
doğrulayan NestJS yükleme yetkisi üzerinden sunucu tarafında yazılır.

Public bucket yalnız `GET` alıyor. `GET` iki iş için: normal görsel gösterimi ve **vision board
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

Ayrıca **`apps/web/.env.local`** (veya production'da `mentor-web` ortam değişkenleri) içinde tarayıcı CSP'sinin (`img-src`, `connect-src`, `media-src`) R2 görsellerine izin vermesi için `WEB_CSP_STORAGE_ORIGINS` tanımlanmalıdır (`@aws-sdk/client-s3` varsayılan olarak virtual-hosted style kullandığı için private bucket adı subdomain olarak başa gelir: `https://pub-....r2.dev,https://mentor-private.<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`; EU production'da `https://media.puhukoc.com,https://puhu-prod-private.<R2_ACCOUNT_ID>.eu.r2.cloudflarestorage.com`).

**Optional paid Render Blueprint:** `render.yaml` already pins the production bucket names,
media URL and EU jurisdiction; account/access credentials are supplied separately with
`sync: false`. Source values do not create the R2 buckets or authorize deployment.

## 6 · Doğrula

```bash
pnpm --filter @mentor/api storage:check
```

Her prefix için sunucu PUT'u → yetkili tarayıcı GET'i + CORS başlığı → `readObject` →
`deleteObject` → gerçekten silindi mi. Başarısız her satır **hangi adımın eksik olduğunu** söyler.
Beklenen: bütün prefixler ✅, özel prefixler için "private key has no public URL" ve imzalı GET ✅.

Ardından `pnpm dev` ile tarayıcıda, **giriş yapmış halde**:

1. `/hedef/pano` → görsel yükle → **Kaydet** → sayfayı yenile → görsel duruyor mu
   (yenilemeden sonrası artık `blob:` önizleme değil, gerçek R2 URL'i)
2. Aynı sayfada **İndir** → PNG iniyor mu. Onun yerine "görseller indirmeye kapalı geldi"
   mesajını görüyorsan CORS `GET`'i eksik.
3. Profil → avatar · Topluluk → **foruma görsel ekle** · Analiz → deneme fotoğrafı
   (sonuncusu private bucket + sunucu tarafı `readObject` yolunu geçer)

## 7 · Custom domain'e geçiş

The selected public media domain is `media.puhukoc.com`. After the production gates pass,
attach it only to `puhu-prod-public`: bucket → **Settings** → **Custom Domains** →
**Connect Domain**. Keep `puhu-prod-private` private; the bucket name need not match the domain.
Cloudflare documents [custom-domain attachment](https://developers.cloudflare.com/r2/buckets/public-buckets/)
as a setting on the selected bucket. Then:

1. `R2_PUBLIC_BASE_URL`'i yeni domain'e çevir. Mutlak URL saklanmaz; public nesneler yalnız key
   tutar ve URL her okumada türetilir. Özel defter/pano nesneleri bu public domain'i kullanmaz.
2. `infra/r2/cors-*.json` içindeki origin'leri güncelle ve yeniden uygula.
3. **Cache purge** — CORS politikası değişince önceden cache'lenmiş objeler eski başlıklarla
   servis edilmeye devam eder.
4. İstersen public development URL'i kapat (WAF/Access kullanacaksan **kapatmalısın**, yoksa
   bucket r2.dev üzerinden açık kalır).

## Eski genel defter ve pano nesnelerini taşı

Önce yalnız planı ve toplamları al:

```bash
pnpm --filter @mentor/api storage:migrate-private
```

Public ve private bucket ayarlarını, veritabanı referanslarını ve kapalı ortam yedeğini kontrol
ettikten sonra geçişi uygula:

```bash
pnpm --filter @mentor/api storage:migrate-private -- --apply
```

Araç `notebook/` ve `vision-board/` prefixlerini sayfalı gezer. Her nesneyi private bucket'a
`Cache-Control: private, no-store` ile kopyalar, hedef boyutunu doğrular ve yalnız başarılı
doğrulamadan sonra public kaynağı siler. Anahtarlar loglara yazılmaz. Uygulama sonrasında veri
referanslarını örnekle, sahip olmayan hesapla erişimi reddet ve Cloudflare CDN cache'ini temizle.
Başarısız toplam sıfır olmadan geçiş tamamlanmış sayılmaz.

## Tuzaklar

- **Yükleme yetkisi kısa ömürlü ve tek kullanımlık.** Sunucu `Content-Length` değerine güvenmez;
  akış baytlarını sayar, özellik sınırında keser ve gerçek dosya imzasını R2 yazımından önce doğrular.
  Aynı kullanıcı aynı anda bir yetki ve günde toplam 100 MiB kullanabilir; değerler config registry'dedir.
- **Özel okuma URL'si en fazla beş dakika.** URL'yi loglama veya kalıcı istemci durumunda saklama;
  süresi dolunca sahibi API'den yeni URL alır.
- **Orphan süpürme:** `vision-board/` için 6 saatte bir çalışıyor, 24 saatten eski ve hiçbir
  kayıtlı panoda geçmeyen objeleri siliyor (`VisionBoardMaintenanceService`). Forum'un kendi
  süpürmesi var. `avatars/` ve `content/` için yok — oralarda yükleme hep bir kayda bağlanıyor.
- **Lifecycle (opsiyonel):** bucket → Settings → Object lifecycle rules → tamamlanmamış multipart
  upload'ları 7 gün sonra iptal et. Tek parça PUT kullandığımız için risk düşük, bedava sigorta.
- **Budget alerts:** Manage Account → Billing → Billable Usage. Alerts do not cap or pause
  usage. Check the shared allowance and actual stop controls; do not assume the Free quota
  or a notification prevents an unexpected invoice.
- **Orphan süpürmesinin işlem maliyeti ihmal edilebilir:** `listObjects` bir **Class A** işlem ve
  süpürme 6 saatte bir çalışıyor — API instance başına ayda ~120 istek, 1M'lik kotaya karşı hiç.
