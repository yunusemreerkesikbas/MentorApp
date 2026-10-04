# Koç ↔ Öğrenci bildirimleri: denetim ve tasarım (APP-094)

> 2026-09-14 · Durum: uygulandı · Kayıtlar: [`notifications.md`](../../features/notifications.md),
> [`mentorship.md`](../../features/mentorship.md) timeline girdileri.

## Soru

Koç→öğrenci ve öğrenci→koç bildirim akışları çalışıyor mu, nasıl geliştiririz?

## Denetim sonucu

- **Çalışan:** iki yöndeki bütün mentorship olayları gelen kutusuna yazılıyor, zil SSE ile anında
  güncelleniyor, dedupe `user_notifications (user_id, dedupe_key)` partial unique index'inde, takip
  bildirimleri metin taşımıyor ve teslimde erişimi yeniden kontrol ediyor.
- **P0:** web push istemcisi yoktu. APP-017 (`10c85d16`, 2026-06-30) abonelik kodunu silmişti; toggle
  yalnız bayrak yazıyor, bütün push işleri sıfır aboneliğe gidiyordu.
- **P1:** koçun ödev düzenleme ve silmesi hiçbir event yaymıyordu; öğrenci planının değiştiğini
  öğrenmiyordu. Ters yön (öğrenci siler → koç) çalışıyordu.
- **P1:** mentorship bildirimleri yalnız in-app kalıyordu; listener yorumu push ve e-postanın
  gönderildiğini iddia ediyordu.
- **P2:** takip-vadesi dispatcher'ında koç başına hata izolasyonu yoktu.

## Kararlar

- Kapsam: P0, iki P1 ve dispatcher. Gürültü azaltma ve küçük temizlikler backlog.
- Push yalnız öğrenciye, üç aile:
  - ödev verme, düzenleme, silme: öğrenci başına günde 1, ortak anahtar;
  - takip kararı paylaşımı: karar başına 1;
  - etkinlik oluşturma, güncelleme, iptal: işlem başına anahtar, güncelleme günde 1 (tek günlük
    anahtar aynı gün oluşturulan etkinliğin iptal push'unu yutardı).
- Koça push yok (risk özetindeki "koçun gününü bölmemeli" kararı).
- In-app her zaman yazılır; push yalnız satır gerçekten yazıldıysa ve tercih açıksa.
- Ödev değişikliğinin in-app satırı öğrenci başına günde 1, görev başlığı taşımaz.

## Tasarım

- **Tek kapı:** `NotificationsService.createFromTemplate(..., { push: { template, dedupeKey } })`.
  Teslim, retry, SSRF politikası ve ölü abonelik temizliği `SendPushHandler`'da kaldı.
  `notification_deliveries` benzersizliği `(user, channel, template, dedupe_key)` olduğu için ortak
  günlük anahtar ortak şablon ister (`DeliveryTemplate.MENTORSHIP_PLAN`).
- **Koçun ödev değişikliği:** `mentorship.assignments.changed`, W8 servisinden commit sonrası,
  öğrenci başına. W2 değişmedi.
- **Web istemcisi:** `lib/web-push.ts` + ayarlardaki push toggle'ı; `sw.js` açık sekmeyi yeniden
  kullanır.
- **Dispatcher:** koç başına `try/catch`. E-posta işi in-app dedupe'unda da kuyruğa girer: çöken
  koşunun e-postası kaybolmaz, `SendEmailHandler` claim'i çift gönderimi engeller.

## Kapsam dışı

Koç tamamlama bildirimlerinin günlük özeti · etkinlik in-app dedupe'u · kullanıcı locale kolonu ·
`pushsubscriptionchange` · iOS için PWA manifest · takip topic'lerinin sabitlere taşınması · takip
bildirimleri için API e2e.

## Doğrulama

- Birim: `notifications.service`, `send-push.handler`, `mentorship-events.listener`,
  `plan-event-notifications.listener`, `mentorship-followup-due.service`,
  `mentorship-assignment.service`, web `web-push`.
- e2e: API `mentorship.e2e-spec.ts` (koç tarihi taşır → öğrenci kutusu), web `profile.spec.ts`
  (toggle → abonelik + tercih).
