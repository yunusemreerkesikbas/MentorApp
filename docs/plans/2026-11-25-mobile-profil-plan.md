# Mobil parite · Durak 1 · Profil & ayarlar (A-002)

Tarih: 2026-11-25 · Agent A · Durum: **Sahip 2026-11-26 tüm önerileri onayladı (1a, 2a, 3 satır, 4 sheet); kod yazıldı**

Referans: web `/ayarlar` 390px (`apps/mobile/.expo/qa/web/2026-11-25-durak-1/`), kaynak `apps/web/src/app/[locale]/(app)/profile/_components/`. Mobil hedef: `apps/mobile/src/app/(app)/(tabs)/settings.tsx` (şu an kimlik + görünüm + sınav + telefon + koçum + davet + hesap kartı).

## Web sırası (390px) → mobil

Web'deki sıra korunur: kimlik → (koç: veri kapsamı) → bildirimler → bağlı hesaplar → telefon → Uygulama kartı → (sosyal) → (öğrenci: Kazanımlar) → Hesap kartı → yasal linkler.

| Web bileşeni | Mobil dosya | İş |
| --- | --- | --- |
| `profile-header.tsx` (avatar + kalem, ad, @kullanıcı adı, "E-postanı doğrula" hapı, "Topluluk profilim" linki) | `components/settings/settings-identity.tsx` | Kalem rozeti avatarın sağ altına; e-posta doğrulanmamışsa sarı hap → `POST /v1/users/me/verification-email` + toast; "Topluluk profilim" → `community-member` ekranı. |
| `profile-edit-form.tsx` (avatar seç/kaldır, ad, kullanıcı adı, hakkında 0/200, web sitesi, e-posta) | **yeni** `components/settings/profile-edit-sheet.tsx` | `FormSheet` içinde form. Avatar: `expo-image-picker` (kurulu) → `POST /v1/users/me/avatar-upload-url` → `putDevicePhoto` → `PATCH /v1/users/me`. JPEG/PNG, 2 MB sınırı, web hataları aynen. |
| `coach-scope-card.tsx` + modal | settings içinde satır + `FormSheet` | Yalnız koç. `GET /v1/mentorship/overview` satıra basınca; metinler mobilde zaten var (`coach_scope_*`, `coach-profile-view.tsx`). |
| `notification-settings.tsx` (3 anahtar) | mevcut `components/notifications/notification-channels-card.tsx` | Kart ayarlara da konur (aynı query key); "Bildirimler" satırı kalkar, bildirim listesi başlıktaki zilden açılıyor. |
| `google-account-card.tsx` | — | **Karar sorusu 1.** |
| `phone-verification-card.tsx` | mevcut | Web gibi: SMS kapalı + numara yoksa kart gizlenir (şu an kontrol et). |
| `application-support-card.tsx` (Dil, Görünüm, Çerez, Tavsiye et, Yardım Merkezi, Geri bildirim) | mevcut görünüm kartı genişler | Dil TR/EN ve Görünüm açık/koyu satır içi segment (web gibi, sheet yerine). Tavsiye et → RN `Share`. Yardım Merkezi → `knowledge` ekranı. Geri bildirim: web env URL'i; mobilde `EXPO_PUBLIC_PROFILE_FEEDBACK_URL` yoksa gizli. **Çerez tercihleri kapsam dışı.** |
| `social-follow-card.tsx` | **yeni** küçük kart | Web env'den (`NEXT_PUBLIC_MENTOR_*_URL`) gelir; mobilde `EXPO_PUBLIC_MENTOR_{YOUTUBE,TIKTOK,INSTAGRAM}_URL`. Hiçbiri yoksa gizli (web'de de şu an gizli). `Linking.openURL`. |
| `economy-section.tsx` (Kazanımlar: Bakiye, Görevler, Arkadaşını davet et → her biri sheet) | **yeni** `components/settings/economy-card.tsx` | Öğrenci için. Bakiye sheet'i (`/v1/economy/balance` + `uses` → `fetchEconomyUses` hazır), Görevler → panel'deki `quests-sheet.tsx` yeniden kullanılır, Davet → mevcut `friend-invite-card` sheet içine. `ECONOMY_DISABLED` (404) ise kart gizli. Coin kullanımlarında Premium satır/teşviki gizli. |
| `account-links-card.tsx` (Hedef sınav, Katılım, Abonelik, Koçum, Koç ol, Çıkış, Hesabımı sil) | mevcut hesap kartı + `exam-switcher-card` | Hedef sınav ayrı karttan satıra iner (sheet açar), "Katılım: Kasım 2026" salt okunur satır, Koçum → `my-coach`, Koç ol → `coach-application`. **Abonelik satırı gizli** (mobilde Premium satışı yok). `MyCoachCard` kalkar, yerine satır. |
| `settings-legal-footer.tsx` (6 belge) | **yeni** settings altı | **Karar sorusu 2.** `signup-legal.ts` slug haritası 6 belgeye genişler. |

## Durumlar

- Yükleniyor: kimlik + liste kartı iskeleti (web `ProfileSkeletonBlocks` gibi, panel-skeleton parçalarıyla).
- Hata: `GET /v1/users/me` hata verirse form hatası + "Tekrar dene".
- Boş: ayrı boş durum yok (web'de de yok). Ekonomi/sosyal/Google/telefon koşula göre gizlenir.
- Koç: Kazanımlar yok, veri kapsamı satırı var.

## Metinler

Web `profile`, `profile.edit`, `profile.support`, `profile.social`, `profile.earned`, `profile.account`, `economy.uses`, `legal` anahtarları mobil `settings` (ve gerekirse `profile`) namespace'ine birebir taşınır. ICU çoğulları bölünür.

## Paket

Yeni paket yok (`expo-image-picker`, `expo-linking`, `expo-sharing` kurulu). Uygulama içi yasal ekran seçilirse ek: bkz. soru 2.

## Kapsam dışı

Çerez tercihleri (web'e özgü) · Abonelik/Premium satırları ve teşvikleri · Davet kodu derin linki (mağaza build'i) · iOS.

## Açık sorular (sahip)

1. **Google hesabı bağlama mobilde olsun mu?** Bağlama akışı web OAuth'una dönüyor (`POST .../google/start` → `{url}`, dönüş adresi web). Seçenekler: (a) yalnız durum satırı (bağlı/bağlı değil), bağlama web'de; (b) tarayıcıda başlat, web'e döner, uygulama geri gelince durumu yeniler; (c) mobilde hiç gösterme. Önerim: **(a)**; tam akış API'de mobil dönüş adresi ister (B işi).
2. **Yasal belgeler uygulama içinde mi, web'de mi açılsın?** İçerik web kodunda (`apps/web/src/lib/legal.ts`), API'de değil. (a) puhukoc.com sayfasını uygulama içi tarayıcıda aç (`expo-web-browser` eklenir, uygulamadan çıkmadan); (b) sistem tarayıcısında aç (`Linking`, ek paket yok, kayıt ekranı bugün böyle); (c) uygulama içi yerel ekran: içeriğin core'a taşınması gerekir, web dosyası B'nin. Önerim: **(a)**; mağaza için link yeterli, içerik tek yerde kalır.
3. Hedef sınav ayrı kart olarak mı kalsın, web gibi Hesap kartında satır mı olsun? Önerim: web gibi satır.
4. Kazanımlar'daki "Arkadaşını davet et": mevcut mobil davet kartı sheet'e mi taşınsın (web gibi), yoksa kart olarak açık mı kalsın? Önerim: web gibi sheet.
