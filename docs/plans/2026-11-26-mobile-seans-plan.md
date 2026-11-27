# Mobil parite · Durak 2 · Seans & masalar (A-005 + A-011 masa kısmı)

Tarih: 2026-11-26 · Agent A · Durum: **Onaylandı 2026-11-26 (4 önerinin hepsi); 2a ve 2b kuruldu, B doğrulaması bekleniyor**

Referans: web `/seans` 390px (`apps/mobile/.expo/qa/web/2026-11-25-durak-2/`), kaynak `apps/web/src/app/[locale]/(app)/study-session/_components/` (~7.500 satır). Mobil bugün: `app/(app)/study-session.tsx` (334 satır: süre kartı, mod chip'leri, serbest metin ders, bitiş kartı) + masalar Topluluk içinde (`components/community/study-rooms-view.tsx`).

## Web → mobil

| Web | Mobil | İş |
| --- | --- | --- |
| `session-stage`, `session-focus-backdrop`, `room-backdrop` (Kütüphane/Kafe/Ev fotoğrafı) | `components/session/session-stage.tsx` | Tam ekran sahne: tema fotoğrafı + koyu örtü. 9 webp (~2,1 MB) `assets/seans-theme/` altına kopyalanır. Tema son seçimi cihazda saklanır (web `session-scene`). |
| `session-top-bar` (tema seçici · ortam sesi) | `session-top-bar.tsx` | Cam hap: tema menüsü + müzik notası → ses sheet'i. |
| `session-timer-ring`, `session-idle-view`, `session-controls` | `session-timer-ring.tsx` (react-native-svg) + idle/odak/mola görünümleri | Kadran, −/+ (5 dk), Süresiz / 25/5 / 50/10 chip'leri, "25 dk odak · 5 dk mola · bitiş 23:36" satırı, Başla. Odakta: Duraklat, "Seansı bitir ve kaydet" (kesilmez, A-005), iptal ikincil metin buton (A-005). |
| `session-ambient-picker` + `use-session-ambient-sound` | `session-ambient-sheet.tsx` + `use-ambient-sound.ts` | Sahne / Kütüphane / Kafe / Ev / Kapalı; ambiyans + kısık müzik iki katman, döngü. **Soru 1.** |
| `session-subject-picker` | `session-subject-sheet.tsx` | Serbest metin yerine sınav taksonomisinden ders listesi. |
| `session-today-card` | `session-today-card.tsx` | Bugünkü odak dakikası / hedef, son seanslar, "Tüm geçmiş". |
| `session-history` (+ row) | **yeni ekran** `app/(app)/study-session-history.tsx` | Sayfalı liste, boş/yükleniyor/hata. Web'de çekmece; mobilde ayrı ekran. |
| `session-buddy-card` | `session-buddy-card.tsx` | Yol arkadaşı durumu, iste/bitir; 60 sn yenileme (web gibi). |
| `session-done-state`, `-stats`, `-checkin` | mevcut `session-done-card.tsx` genişler | İstatistikler, check-in, "1 dk 30 sn" doğru yazılır (yuvarlama, A-005). |
| `session-share-sheet`, `-preview` (polaroid) | `session-share-sheet.tsx` | `react-native-view-shot` + `expo-sharing` (kurulu). |
| `session-room-list`, `room-create-sheet`, `room-invite-sheet` | `components/session/rooms/*` | "Masaların" kartı; masa kur sheet'i (ad, tema karuseli, kapasite 2–10), davet sheet'i (kod, paylaş, yenile), kodla katıl. **Soru 2.** |
| `room-shell`, `room-seats`, `room-seat-layout`, `room-theme-switcher`, `room-sheet` | **yeni ekran** `app/(app)/study-room.tsx` | Masa sahnesi: başlık, tema okları, koltuk yerleşimi (`room-seat-layout.ts` saf mantığı core'a yeni dosya + spec), boş koltukta "Davet et", "Bu masada çalışmaya başla", ⋯ menü (yeniden adlandır, ayrıl/sil). Varlık 30 sn yoklama (web gibi). |
| — | Küçükler | "‹ Panele dön" geldiğin yere döner (`router.back()`, yoksa panel). |

## Durumlar

Yükleniyor (sahne iskeleti), hata + Tekrar dene, boş (masa yok: Puhu + "Masa kur / Kod ile katıl"; geçmiş boş). `coaching.study_rooms.enabled` kapalıysa masa kartı gizli. Koç bu ekrana zaten giremiyor.

## Paket

`expo-audio` (yalnız Soru 1 a/b seçilirse). Diğerleri kurulu (`react-native-svg`, `react-native-view-shot`, `expo-sharing`).

## Kapsam dışı

`/masaya-katil` ve `rooms/[id]` derin linki (mağaza build'i) · iOS · tamamlanma kutlama sahneleri (mobilde var, dokunulmaz).

## Açık sorular (sahip)

1. **Ortam sesi nasıl gelsin?** Web 6 dosya kullanıyor (3 tema × ambiyans + müzik, ~10 MB). (a) uygulamaya göm: çevrimdışı çalışır, uygulama ~10 MB büyür; (b) puhukoc.com'dan akış: boyut artmaz, internet ister; (c) şimdilik yok. Önerim: **(a)**, haftalık hikâye videolarında da gömme seçildi.
2. **Masalar nerede dursun?** Web'de seans ekranında "Masaların" kartı. (a) seans ekranına taşı, Topluluk'taki Masalar sekmesi aynı kartı göstersin; (b) yalnız seans ekranı; (c) yalnız Topluluk. Önerim: **(a)**.
3. **Durak ikiye bölünsün mü?** 2a Seans (sahne, ses, ders, bugün, buddy, bitiş + polaroid, geçmiş, küçük düzeltmeler) → B doğrular → 2b Masalar (liste, kur/davet, masa sahnesi). Önerim: **evet**, iş ~3.000 satır, parça parça doğrulanır.
4. **Masa sahnesinde masa/koltuk çizimleri** web'deki fotoğraflı webp'ler mi olsun? Önerim: **evet**, aynı 9 dosya; yüklenmezse düz renk yedeğe düşer.
