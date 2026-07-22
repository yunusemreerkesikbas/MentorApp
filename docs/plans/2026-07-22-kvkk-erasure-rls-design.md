# KVKK silme tamamlama + RLS izolasyon kanıtı (WP-K)

**Date:** 2026-07-22 · **Tracks:** cross-cutting (account, forum, identity, notifications, db)

## Decision

Production-readiness taraması iki yüksek-sonuçlu boşluk buldu ve WP-K bunları kapattı:

1. **KVKK hesap silme eksikti** — `DELETE /v1/account` forum/community/notifications verisine hiç
   dokunmuyordu; kullanıcının serbest metin gönderileri (tam KVKK-hassas kategori) silmeden sonra
   duruyordu ve akışın e2e'si yoktu (yalnız mock'lu unit).
2. **RLS hiç kanıtlanmamıştı** — tüm e2e'ler superuser `mentor` ile koşuyor (RLS bypass); "çift
   kemer"in ikincisi hiç bağlanmamıştı.

Kullanıcı kararları: forum içeriği **redaksiyon** (hard delete değil); yaklaşım **test-first**
(e2e önce kırmızı, eksik tablolar çıktıda görünür).

## Shape

### Erasure (A1/A2)

- **Kapsam tablosu:**

  | Veri | Aksiyon |
  |---|---|
  | `forum_threads` (title+body), `forum_posts` (body) | Redakte: `"[silinmiş içerik]"` — satır durur, `is_accepted` korunur |
  | `forum_reactions/bookmarks/zone_members/reports(reporter)/attachments` | Hard delete (+ storage best-effort) |
  | `user_follows` (iki yön), `buddy_pairs` (her status) | Hard delete |
  | `push_subscriptions`, `notification_preferences`, `notification_deliveries`, `user_notifications` | Hard delete |
  | `ledger_entries`, `payment_transactions`, `subscriptions` | DURUR (yasal saklama / append-only) |
  | `users` | Anonymize (mevcut) |

- Her modül KENDİ tablolarını siler (workstreams §2): `ForumErasureService`+repo,
  `SocialErasureService` (identity), `NotificationsErasureService`. `AccountErasureService` yalnız
  sıralar: cancel → ai → coaching → forum → social → notifications → anonymize → revoke → storage.
- Redaksiyon sabiti ham DB değeri, i18n değil (görüntü katmanı zaten "Silinmiş Kullanıcı" gösterir).
- Kanıt: `test/account-erasure.e2e-spec.ts` — 10 test, tablo tablo assert, komşu kullanıcının verisi
  bozulmaz, idempotent ikinci DELETE.

### RLS kanıtı (A3)

- `test/rls-isolation.e2e-spec.ts` kendi `rls_probe` rolünü (NOSUPERUSER/NOBYPASSRLS) idempotent
  kurar — init-script/CI değişikliği GEREKMEDİ (plandaki init-test-db.sql + CI psql adımı yerine
  self-provisioning seçildi: her ortamda aynı, sıfır altyapı bağımlılığı).
- 4 temsili tablo (`mood_checkins`, `plan_tasks`, `coach_messages`, `ledger_entries`):
  cross-user SELECT → 0; kendi satırları → >0; context'siz → 0 + INSERT reddi.
- **Bulgu:** `coach_messages` policy'si (0044) `app.user_id`'yi `::uuid` cast'ler — boş string
  context'te sorgu filtrelemek yerine hata verir (yine deny; diğer policy'ler text karşılaştırır).
  Gotcha olarak kayıtlı; migration düzeltmesi bilinçli olarak bu tura alınmadı.

## Out of scope

Deploy plumbing (Dockerfile/render.yaml) · Turnstile widget · web Sentry · KVKK self-service export
(backlog) · zone OWNER silinince sahipsiz zone (MVP kabulü, transfer backlog) · 0044 policy
normalize migration'ı.
