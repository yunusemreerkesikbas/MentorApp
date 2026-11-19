# F4 "Puhu'yla bir gün": gerçek ekranlar (kısa tasarım)

Tarih: 2026-11-17 · Parça: `marketing/social/src/pieces/F4.tsx` · Yayın: 19 Kasım 19:00 (Metricool, taslak değil)

## Neden
Sahip, kartlardaki telefon ekranlarını beğenmedi. Ekranlar elle çizilmiş sade kutular: alt yarıları boş, durum
çubuğu ve alt menü yok, taslak çizim gibi duruyor. Hedef: telefona bakan öğrenci "uygulama gerçekten böyle" desin.

## Hedefler / hedef olmayanlar
- Hedef: kart 1–4'teki telefonların içi uygulamanın gerçek ekran görüntüsü olsun, kart metinleriyle birebir eşleşsin.
- Hedef olmayan: kart düzeni, başlıklar, Puhu çizimleri, 5. kart, gönderi metni. Bunlar aynen kalır.
- İstenmeyen: test hesabı izi (garip isimler, "test", boş durumlar, hata mesajları), Expo Go geliştirici düğmesi, okunmayacak kadar küçük yazı.

## Yaklaşımlar
- **A · Gerçek ekran görüntüsü (seçilen).** En inandırıcısı. Bedeli: API + web + emülatör çalıştırmak ve demo verisi kurmak.
- B · Ekranları kitte uygulamanın tasarımıyla yeniden çizmek. Kontrol tam, ama yine çizim kalır.
- C · Canvas tasarımları. Oradaki telefonlar da çizim, sorunu taşır.

## Tasarım
| Kart | Kaynak | Ekran | Görünmesi gereken |
|---|---|---|---|
| 1 Sabah | mobil (emülatör) | Panel, "Bugünün yolu" | Puhu'nun hazırladığı 3 görev, biri bitmiş |
| 2 Öğlen | web, 390 px telefon genişliği | Masa (seans odası) | Masada 4 kişi, çalışan sayaç |
| 3 Akşam | mobil (emülatör) | Haftalık özet hikâyesi | "Gizli Kahraman" lakabı (gerekirse toplam odak sayfası) |
| 4 İstersen | web, 390 px | Koçum | Koçtan "Bu hafta harika gidiyorsun." mesajı |

- Demo hesabı: Türkçe gerçekçi isim, YKS, gerçekçi görevler (ör. "40 paragraf çöz", "10 dk tekrar"), sınır içi sayılar.
- Görüntüler `marketing/social/public/screens/F4-1…4.png` olarak kite girer; `Phone` bileşeni ekranı `<Img>` ile, üstten hizalı doldurur.
- Ekranda metin farklı çıkarsa kart altı yazısı değil ekran verisi düzeltilir; olmuyorsa sahibe sorulur.
- Render sonrası 4 kart Metricool'daki 19 Kasım gönderisinde değiştirilir (5. kart aynı), gönderi yine kendiliğinden yayınlanır.

## Kurucuya kalanlar
Hangi hesap ve verinin nasıl kurulacağı, ekran görüntüsü yöntemi (adb / Playwright), kırpma.
