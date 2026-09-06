# Güvenlik yayın kontrol listesi

> 2026-09-05 güvenlik paketinin gerçek Cloudflare, Render, Neon ve R2 ortamında tamamlanması için.
> Yerel testlerin geçtiğini üretim ayarlarının doğrulandığı anlamına getirmez.

## Dağıtım sırası

1. Kısıtlı runtime DB rolünü ve ayrı migration rolünü hazırla. Runtime rolü superuser, BYPASSRLS,
   tablo/şema/veritabanı sahibi veya bu yetkileri miras alan bir rol olmamalı.
2. `0102_security-hardening` migration'ını migration rolüyle uygula. API'yi kısıtlı runtime URL ile
   başlat ve başlangıç rol denetiminin geçtiğini kaydet.
3. HTTPS `APP_URL`, açık HTTPS `CORS_ORIGINS`, gerçek Turnstile secret/hostname, Google callback,
   VAPID ve R2 ayarlarını kontrol et. Doğrudan Render origin erişiminin Cloudflare korumalarını
   atlamadığını dışarıdan doğrula.
4. Dağıtımdan sonra bütün eski oturumları sonlandır ve `CRON_SECRET` değerini yenile. Geçmiş uygulama,
   platform ve Sentry loglarında cookie, refresh/access tokenı, cron sırrı veya OAuth kodu arayıp erişim
   kapsamı ile saklama süresini değerlendir; gerekiyorsa kayıtları sil ve ilgili kimlik bilgilerini döndür.
5. Defter/hayal panosu için eski genel R2 nesnelerini özel anahtarlara taşı veya yeniden yüklet; veri
   referanslarını doğrula, ardından genel kopyaları ve CDN cache'lerini temizle. Sahip olmayan kullanıcıyla
   okuma denemesi yap ve imzalı URL'nin beş dakika içinde sona erdiğini doğrula.

## Yayın kapıları

- Tam CI, üretim bağımlılığı taraması ve sır taraması yeşil.
- Chrome, Firefox ve Safari'de giriş, sekmeler arası refresh/logout, Google bağlama, görsel yükleme ve
  bildirim bağlantısı elle doğrulandı.
- Askıya alma ve rol kaldırma mevcut erişim tokenını bir sonraki istekte durduruyor.
- Eşzamanlı refresh/logout/parola reset sonrasında çalışan erişim veya refresh tokenı kalmıyor.
- İç ağ push hedefi, sahte MIME, fazla boyut, kullanılmış yükleme yetkisi ve başka kullanıcının özel
  medyası gerçek dağıtımda reddediliyor.
- Cloudflare Access yönetici API yollarını kapsıyor; Render origin doğrudan erişime kapalı. Yönetici MFA,
  CSP ve tarayıcıda kalıcı admin tokenının kaldırılması takip paketinde tamamlanmadan genel yayın onayı verme.

## İzleme ve geri dönüş

- Oturum doğrulama 401 oranı, refresh replay, upload 413/validation, push DNS/policy redleri ve kalıcı
  silme job dead-letter sayıları için alarm oluştur.
- Migration ileri yönlüdür. Geri dönüş gerekirse eski kodu yeni tablolar dururken çalıştır; migration'ı
  geri alma veya uygulanan dosyayı değiştirme. Kapalı test ortamında bir defalık yeniden giriş beklenir.
