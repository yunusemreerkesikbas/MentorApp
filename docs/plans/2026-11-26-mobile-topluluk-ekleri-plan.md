# Mobil parite · Durak 3 · Topluluk ekleri (A-011 kalan kısım)

Tarih: 2026-11-26 · Agent A · Durum: **Kuruldu, B doğrulaması bekleniyor** (4 öneri onaylandı)

Referans: B'nin web referansı (`apps/mobile/.expo/qa/web/2026-11-25-durak-3/`, ledger “Durak 3 · kaynak referansı”), kaynak `apps/web/src/app/[locale]/(app)/community/` (`_components/use-forum-image-picker.ts`, `composer-attach-button.tsx`, `attachment-gallery.tsx`, `comment-row.tsx`, `feed/_components/global-composer.tsx`, `question-composer-dialog.tsx`, `question/[threadId]/_components/answer-composer.tsx`, `comment/[postId]/_components/comment-shell.tsx`).

Mobil bugün: paylaşım/soru sheet'i (`community-composer-sheet.tsx`), gönderi detayında alt yanıt çubuğu (`community-thread.tsx`), yorum kartı (`community-reply-card.tsx`). Ek yükleme yok; **gönderilerdeki ekler de hiç gösterilmiyor** (web'den gelen görselli gönderi mobilde yalnız metin). Yoruma yanıt ve yorum detayı yok.

## Web → mobil

| Web | Mobil | İş |
| --- | --- | --- |
| `use-forum-image-picker` + `composer-attach-button` | yeni `components/community/attachment-picker.tsx` + `lib/forum-attachments.ts` | Ataş düğmesi → Galeri / Kamera. En çok 4 ek, görsel ≤5 MB, jpeg/png/webp. `POST /v1/forum/attachments/upload-url` → `putDevicePhoto` → `{key, mimeType, width, height}`. Küçük önizleme, ✕ ile çıkar, hata metinleri `community.attach_*` (web'den). |
| `global-composer`, `question-composer-dialog` | `community-composer-sheet.tsx` | Paylaşım ve soruda ek; ankette ek yok (web gibi). |
| `answer-composer`, mesaj/yorum yanıtı | `community-thread.tsx` alt çubuk | Yorum ve cevaba ek: çubuğa ataş, seçilenler çubuğun üstünde şerit. |
| `attachment-gallery` | yeni `components/community/attachment-gallery.tsx` | Akış kartı, gönderi detayı, yorum ve cevap kartlarında görseller (1 tam genişlik, 2–4 ızgara, oran `width/height`). Dokununca tam ekran görüntüleyici (kaydırarak geçiş). Dosya ekleri (PDF/Office) çip olarak, dokununca uygulama içi tarayıcı. |
| `comment-row` (yanıt sayısı) + `/topluluk/yorum/[postId]` | yeni ekran `app/(app)/community-comment.tsx` | Yorum kartında yanıt sayısı + “Yanıtla”; dokununca yorum detayı: yorum, doğrudan yanıtları, alt çubukta ekli yanıt (`POST /v1/forum/posts/:postId/replies`). Yanıta dokununca aynı ekran o yanıt için açılır (web'deki iç içe gezinme). Tepki, kaydet, şikâyet mevcut kart davranışıyla. `?highlight=` ile gelen yanıt vurgulanır. |
| — | `lib/forum-api.ts` | `getCommentDetail`, `postReply`, mevcut `postThreadComment` / `postQuestionAnswer` çağrılarına `attachments`. |

## Durumlar

Yükleniyor (yorum detayı iskeleti), hata + Tekrar dene, topluluk kapalıysa (`availability.forum`) “kısa mola”, silinmiş yorum, yanıt yokken boş satır. Yükleme sürerken gönder düğmesi kilitli; bir ek yüklenemezse o ek hata gösterir, metin kaybolmaz.

## Paket

Yok (görseller için `expo-image-picker` ve `expo-file-system` kurulu). Soru 1 (b) seçilirse `expo-document-picker`.

## Kapsam dışı

Topluluk yönetimi · GIF/emoji seçici · görsel düzenleme/kırpma · yakınlaştırma (pinch) · iOS.

## Açık sorular (sahip)

1. **Dosya eki (PDF, Word, Excel, PowerPoint) yüklensin mi?** Web görsel + dosya kabul ediyor. (a) Mobilde yalnız görsel yükle, dosya eklerini göster ve aç; (b) dosya yüklemeyi de ekle (`expo-document-picker`, yeni paket, 10 MB sınırı). Önerim: **(a)**. Telefonda paylaşılan ekler büyük oranda fotoğraf (soru fotoğrafı, defter sayfası); dosya yüklemeyi kullanım görülürse ekleriz.
2. **Görsel kaynağı:** (a) Galeri + Kamera (Yanlış Defterim'deki gibi); (b) yalnız Galeri. Önerim: **(a)**, soru fotoğrafı çekmek en sık senaryo.
3. **Yorum detayına giriş:** (a) yorum kartındaki yanıt sayısı / “Yanıtla” + bildirimden gelen yorum yanıtı; (b) yalnız kart. Önerim: **(a)**; bildirim yönlendirmesi mevcut bildirim eşlemesine bir satır.
4. **Durak bölünsün mü?** 3a Ekler (seçici, yükleme, galeri, görüntüleyici; tüm composer'lar) → 3b Yorum detayı. Önerim: **hayır**, iş ~1.200 satır, tek parça doğrulanabilir.
