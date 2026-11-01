# Haftalık sandık · web dilimi (uygulama planı)

> Uygulama: bu oturumda, kullanıcı "Evet, başla" dedi (2026-11-01). Arka uç: `2026-11-01-weekly-chest-backend.md`.

**Amaç:** Panelde dokunulabilir sandık, bilgi penceresi, "Masa lambası" açılış sahnesi ve başka sayfada "hazır" bildirimi.

**Spec:** `docs/superpowers/specs/2026-11-01-weekly-chest-opening-design.md` (Durumlar, Sahne, Metinler, Gelen medya).
**Tuval:** https://claude.ai/artifact/1EdSa1LKCQ3JffZwHFFgTd (Main, Sheet, A-Masa).

## Sabitler
- Veri tek kaynaktan: `GET /v1/economy/weekly-chest` (`WeeklyChestView`); sandık artık quest listesinden okunmaz.
- Varlıklar `public/visuals/chest/`: `chest-closed.webp`, `chest-open.webp` (384², şeffaf, açık hali 33 px
  yukarı hizalı), `desk-chest-closed.webp` / `desk-chest-open.webp` (klibin ilk/son karesi, 720²), `chest-open.mp4` (720², 5 sn).
- Lambalar kod katmanı: ikon şeridi x 0.241–0.748, y 0.656–0.740; sahne şeridi x 0.333–0.667, y 0.838–0.893; kilit (gözlük) merkezi sahnede (0.5, 0.768).
- Sahne kendi gece paletini taşır (`.weekly-chest-night`, DESIGN §9 istisnası, `html.dark` izlemez). Not dili `.pcs-*` ile aynı: kâğıt, bant, Caveat.
- Kopya `weeklyChest` ad alanında (TR/EN), em dash yok.

## Dosyalar
- `lib/weekly-chest.ts`: `fetchWeeklyChest`, `openWeeklyChest(periodKey)`, `WEEKLY_CHEST_REASON`, bildirim anahtarı.
- `components/weekly-chest/weekly-chest-model.ts` (+ `.spec.ts`): `chestLamps`, `daysLeft`, `focusParts`, `noteLines`, `isHeldChestReceipt`.
- `components/weekly-chest/chest-art.tsx`: görsel + lamba katmanı.
- `components/weekly-chest/chest-info-sheet.tsx`: PROGRESS'te dokununca alt pencere içeriği.
- `components/weekly-chest/chest-scene.tsx` (kabuk) + `chest-scene-note.tsx` (not, Coin / balon) + `weekly-chest.css`.
- `components/weekly-chest/weekly-chest-notice.tsx`: uygulama kabuğunda; panel dışında READY ilk görüldüğünde bir kez bildirim, "Aç" → `/dashboard?chest=open`.
- Değişen: `today-path-model.ts` (chest = view), `today-path.tsx` (`ChestNode` → button), `daily-quests-card.tsx` (yeni satır),
  `today-path-card.tsx`, `use-panel-data.ts` (`weeklyChest`), `panel-shell.tsx` (sheet + sahne + derin bağlantı),
  `economy-sync.tsx` (taze sandık makbuzu kutlanmaz, onaylanmaz; sahne onaylar), `app-shell.tsx` (bildirim), mesajlar.

## Kararlar
- Ekonomi kapalıyken de sandık çizilir; Coin satırları yok.
- 14 günden eski sandık makbuzu EconomySync'te yine onaylanır (sandık artık açılamaz, makbuz sonsuza dek beklemesin).
- Bildirim tetikleyicisi `ECONOMY_CHANGED_EVENT` (eylem ve sayfa değişimi); panelde ve `/coach`'ta sessiz; 60 sn'de en fazla bir istek;
  bu haftanın sandığı bir kez görüldüyse (panelde ya da bildirimde) bir daha istemez.
- Kullanım satırı ("3 Puhu sohbeti eder") bu turda yok: ayrı istek ister, sonra eklenir.
- Açılış isteği "Sandığı aç"a basınca gider; not, video bitince ya da atlanınca ve yanıt gelince görünür.

## Doğrulama
- Birim: `weekly-chest-model.spec.ts`, `today-path-model.spec.ts`.
- Tarayıcı: gerçek API, 375 ve 1280; PROGRESS / READY / devreden / OPENED / ekonomi kapalı; azaltılmış hareket; bildirim.
- `pnpm --filter @mentor/web typecheck`, lint (dokunulan dosyalar), test.

## Durum (2026-11-01)

- Uygulandı, commit yok. e2e 10/10, web birim testleri yeşil, lint temiz; typecheck'teki tek hata başka oturumun `e2e/panel.spec.ts` dosyasında.
- QA'de düzeltilenler: boş gün noktaları kesikli çerçeve, "İçinde" satırları sıcak zemin, `coin.svg` yerine lucide `Coins`, mobil yolda kesilen "Dokun, açalım" → "Aç bakalım".
- Açık: isteğe bağlı bekleme döngüsü klibi yapılmadı; `panel.quests_chest*` anahtarları kullanılmıyor.
