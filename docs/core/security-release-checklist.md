# Güvenlik yayın kontrol listesi

> 2026-09-05 güvenlik paketinin gerçek Cloudflare, Render, Neon ve R2 ortamında tamamlanması için.
> Yerel testlerin geçtiğini üretim ayarlarının doğrulandığı anlamına getirmez.

## Dağıtım sırası

1. Kısıtlı runtime DB rolünü ve ayrı migration rolünü hazırla. Runtime rolü superuser, BYPASSRLS,
   tablo/şema/veritabanı sahibi veya bu yetkileri miras alan bir rol olmamalı.
2. `0102_security-hardening` ve `0104_cultured_morgan_stark` migration'larını migration rolüyle uygula. API'yi kısıtlı runtime URL ile
   başlat ve başlangıç rol denetiminin geçtiğini kaydet.
3. HTTPS `APP_URL`, açık HTTPS `CORS_ORIGINS`, gerçek Turnstile secret/hostname, Google callback,
   VAPID, R2, `CLOUDFLARE_ACCESS_TEAM_DOMAIN` ve `CLOUDFLARE_ACCESS_AUD` ayarlarını kontrol et.
   Admin web ve `/v1/admin/**` aynı Access uygulaması/politikası kapsamında olmalı; MFA zorunlu
   tutulmalı. Doğrudan Render origin erişiminin imzasız veya sahte Access header'ıyla admin API'ye
   ulaşamadığını dışarıdan doğrula.
4. Dağıtımdan sonra bütün eski oturumları sonlandır ve `CRON_SECRET` değerini yenile. Geçmiş uygulama,
   platform ve Sentry loglarında cookie, refresh/access tokenı, cron sırrı veya OAuth kodu arayıp erişim
   kapsamı ile saklama süresini değerlendir; gerekiyorsa kayıtları sil ve ilgili kimlik bilgilerini döndür.
5. `storage:migrate-private` ile önce dry-run al, sonra kontrollü ortamda `--apply` çalıştır. Veri
   referanslarını doğrula, ardından kalan genel kopyaları ve CDN cache'lerini temizle. Sahip olmayan kullanıcıyla
   okuma denemesi yap ve imzalı URL'nin beş dakika içinde sona erdiğini doğrula.
6. Onaylı KVKK/gizlilik metninde AI sağlayıcısına yurt dışı aktarımı, veri minimizasyonunun sınırı,
   saklama ve no-training taahhüdünü yayımla; sağlayıcı hesabındaki veri işleme ayarını doğrula.

## Yayın kapıları

- Tam CI, üretim bağımlılığı taraması ve sır taraması yeşil.

- Chrome, Firefox ve Safari'de giriş, sekmeler arası refresh/logout, Google bağlama, görsel yükleme ve
  bildirim bağlantısı elle doğrulandı.
- Askıya alma ve rol kaldırma mevcut erişim tokenını bir sonraki istekte durduruyor.
- Eşzamanlı refresh/logout/parola reset sonrasında çalışan erişim veya refresh tokenı kalmıyor.
- İç ağ push hedefi, sahte MIME, fazla boyut, kullanılmış yükleme yetkisi ve başka kullanıcının özel
  medyası gerçek dağıtımda reddediliyor.
- Cloudflare Access yönetici API yollarını kapsıyor; Render origin doğrudan erişime kapalı ve Access
  politikasında MFA zorunlu. Nonce tabanlı CSP cevapta mevcut; admin tokenı local/session storage'a
  yazılmıyor ve eski anahtar açılışta temizleniyor.
- Prod API'de `APP_ENV` boş ya da `production`: `GET /v1/admin/config` cevabında
  `dev.email.console_enabled` yok, Ayarlar'da "Test ortamı (stage/dev)" bölümü görünmüyor. Stage
  `APP_ENV=staging` ile bu anahtarı açık getirir ve stage platform logları bilerek e-posta alıcısı ile
  doğrulama/sıfırlama linki içerir; madde 4'teki token araması prod loglarına uygulanır.
- Rewarded Coin üretimde `SERVER_VERIFICATION_UNAVAILABLE` ile kapalı. İmzalı sunucu doğrulaması
  sağlayan bir reklam formatı seçilmeden etkinleştirme.
- AI aylık bütçe rezervasyonları eşzamanlı çağrılarda tavanı koruyor; süresi dolmuş rezervasyonlar
  temizleniyor ve kullanım kaydı rezervasyonu aynı kilit/işlem altında kapatıyor. Rezervasyon tutarı
  izin verilen en pahalı model çağrısının ölçülen üst sınırından düşük değil.

## Account security release gate (2026-10-07)

1. Apply the new forward-only `auth_rate_limits` migration with the migration role, then boot with
   the restricted runtime role. Verify SERVICE access and denial for anonymous/student/admin RLS
   contexts; the table must have both ENABLE and FORCE ROW LEVEL SECURITY.
2. Configure HTTPS `APP_URL` and `ADMIN_APP_URL` origins, both explicitly in `CORS_ORIGINS`, on
   subdomains of the same primary domain as the API. Keep the existing host-only Secure,
   HttpOnly, SameSite=Lax cookies. Supply independent random `AUTH_RATE_LIMIT_SECRET` and
   `EDGE_ORIGIN_SECRET` values (at least 32 characters); use the same rate secret on all API
   instances. Changing the rate secret resets counter identity, so rotate deliberately.
3. Proxy the API hostname through Cloudflare. Add a Request Header Transform Rule with **Set
   static**, overwriting `x-mentor-origin-secret` with `EDGE_ORIGIN_SECRET` for that hostname.
   Never use "add" or preserve the visitor's value. Ensure `CF-Connecting-IP` remains present
   (do not enable a transform that removes it). Never put either secret in frontend variables,
   screenshots, request logs or response headers.
4. Protect the admin web hostname, `/v1/admin/**` and `/v1/auth/admin/**` with Cloudflare Access.
   Require MFA in the Access policy and the intended application audience. Confirm login and
   refresh reject an assertion whose email differs from the application account.
5. Configure the Turnstile site key/secret and web hostname. Exercise signup, login and password
   recovery with the correct actions; reject absent/replayed tokens, wrong action/hostname and
   provider failure before password verification or mail enqueue.
6. From a disposable client, verify direct Render login/API/OAuth access and fake/missing edge
   headers are denied before body parsing. Only GET `/v1/health`, GET `/v1/health/ready` and POST
   cron with the valid existing cron secret may bypass the edge. Incorrect/missing/`null` Origin
   must fail web/admin auth POSTs; preflight OPTIONS still works through the edge.
7. Using synthetic accounts, confirm shared web/admin login quotas across two API processes and
   restart, fixed-window expiry, success not resetting attempts, and the same unknown-email
   policy. IP rejection must return 429 with `Retry-After`; account-limited recovery still returns
   `{ ok: true }` and sends no mail. Daily maintenance removes expired counters.
8. Confirm an old session stays old after refresh, email changes and self-deletion request explicit
   re-login after ten minutes, and returning from password/Google login never repeats the action.
   Race old verification/reset links against email change, then verify all old access/refresh
   sessions are unusable and only the new email can be verified.
9. With the exact production start command, bind hostname and reverse proxy, open `/giris`,
   `/sifremi-unuttum`, `/ayarlar` and the reauthentication return flow. Require successful page
   loads without repeated 307 redirects. Isolated QA reproduced a self-redirect on `/giris`
   when Next.js bound to `127.0.0.1`; binding to `localhost` resolved the local reproduction.
   Passing browser tests on localhost does not validate Render's production bind configuration.

Record actual Cloudflare/Render evidence before release. Source changes and local fixture tests do
not satisfy this gate. Production dependency/secret scans and full CI remain mandatory.

References: [Cloudflare request header transforms](https://developers.cloudflare.com/rules/transform/request-header-modification/),
[Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## İzleme ve geri dönüş

- Oturum doğrulama 401 oranı, refresh replay, upload 413/validation, push DNS/policy redleri ve kalıcı
  silme job dead-letter sayıları için alarm oluştur.
- Migration ileri yönlüdür. Geri dönüş gerekirse eski kodu yeni tablolar dururken çalıştır; migration'ı
  geri alma veya uygulanan dosyayı değiştirme. Kapalı test ortamında bir defalık yeniden giriş beklenir.

## Web browser security release gate (2026-10-08)

- Set the web runtime WEB_CSP_STORAGE_ORIGINS to the exact public CDN and signed R2 origins
  (including the configured jurisdiction). Verify upload PUT and private/public GET, images,
  avatars, board photos and exports without CSP violations. No wildcard or presigned URLs.
- On the actual Cloudflare/Render deployment verify TR/EN document hydration, nonce renewal
  on reload, real framework/inline nonce agreement, prefetch and SPA navigation. Ensure edge
  rules do not cache nonce HTML or add a second conflicting CSP. Assets should remain cached.
- Verify the enforced production script policy has no unsafe-inline/unsafe-eval. Exercise
  real Turnstile, consent-gated Analytics, Maps/Street View, eligible limited/rewarded ads
  with SafeFrame, Google login, payment redirects, image capture, clipboard and sharing.
  Provider mocks do not establish compatibility. Maps/GPT documentation includes eval in
  examples; any violation needs a deliberate provider solution before release, not a blanket
  global eval permission. Check Analytics page_location/referrer for reset/verification tokens.
- Measure public-page TTFB and Render CPU/memory after all documents become dynamically
  rendered. Approve the capacity/performance result before enabling production traffic.
- Run full CI and existing performance budgets before merge/release; targeted local security
  checks alone are insufficient. Record actual deployment/provider evidence with dummy accounts.
