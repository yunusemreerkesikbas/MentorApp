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
- Rewarded Coin üretimde `SERVER_VERIFICATION_UNAVAILABLE` ile kapalı. İmzalı sunucu doğrulaması
  sağlayan bir reklam formatı seçilmeden etkinleştirme.
- AI aylık bütçe rezervasyonları eşzamanlı çağrılarda tavanı koruyor; süresi dolmuş rezervasyonlar
  temizleniyor ve kullanım kaydı rezervasyonu aynı kilit/işlem altında kapatıyor. Rezervasyon tutarı
  izin verilen en pahalı model çağrısının ölçülen üst sınırından düşük değil.

## İzleme ve geri dönüş

- Oturum doğrulama 401 oranı, refresh replay, upload 413/validation, push DNS/policy redleri ve kalıcı
  silme job dead-letter sayıları için alarm oluştur.
- Migration ileri yönlüdür. Geri dönüş gerekirse eski kodu yeni tablolar dururken çalıştır; migration'ı
  geri alma veya uygulanan dosyayı değiştirme. Kapalı test ortamında bir defalık yeniden giriş beklenir.
