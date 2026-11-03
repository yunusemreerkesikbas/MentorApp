# YKS blog taslak paketi

**Durum: Yerel geliştirme ortamında yayımlandı.** Yedi yazı 3 Kasım 2026'da `localhost:5433/mentor` veritabanına mevcut içerik servisinden aktarıldı. [Yerel YKS blogunda](http://localhost:3000/blog?family=YKS) görülebilir. Yayın kaydı ve doğrulama sonuçları [publication-local.json](./publication-local.json) dosyasındadır. Bu kayıt canlı yayın anlamına gelmez. Başlıklar yıldan bağımsızdır. Her yazının başındaki kaynak kapsamı notu, kuralların ÖSYM'nin 2026 belgelerinden alındığını açıklar. Bu not yazının bir parçasıdır.

Metinler sakin, açıklayıcı eğitmen diliyle ve öğrenciye “sen” diye seslenerek yazıldı. Kaynakta yer alan kurallar ile çalışma önerileri ayrıldı. Eğitmen deneyimi, unvanı, öğrenci hikâyesi veya başarı iddiası uydurulmadı.

## Kapak görselleri

İkinci ve üçüncü paketteki toplam 16 yazıya da farklı Pexels kapakları eklendi ve bu yazılar yerel geliştirme ortamında yayımlandı. Böylece toplam 23 YKS yazısı kapaklarıyla yerelde yayında. [İkinci paket kapakları](./batch-02/images/README.md) · [Üçüncü paket kapakları](./batch-03/images/README.md) · [Toplu ön izleme](./draft-cover-preview.jpg). Yayın ve doğrulama kayıtları her paketin klasöründedir.

Yedi yazıya Pexels ve Unsplash'tan seçilen farklı temsili kapak fotoğrafları eklendi. Görseller 1200 × 630 WebP olarak hazırlandı; toplamları yaklaşık 272 KB. Türkçe alternatif metinleri, fotoğrafçı adları ve lisans bağlantıları kaydedildi. Fotoğraflar blog kartında, yazı başında ve paylaşım ön izlemesinde mevcut kapak alanından kullanılır. Ayrıntılı kaynaklar [media-sources.json](./media-sources.json), görseller ve kullanım notları [images/README.md](./images/README.md), yerel güncelleme kaydı [media-publication-local.json](./media-publication-local.json) içindedir.

Yazı kayıtları yalnız yerel veritabanında güncellendi. Görseller, bu yerel uygulamanın zaten kullandığı geliştirme medya alanına (`mentor-public`) eklendi; ayrı canlı medya alanlarına aktarılmadı. İlk yayın kaydı tarihsel olarak korunur; görsel eklendikten sonraki gövde özetleri medya güncelleme kaydındadır.

## Yazılar

Bu ilk pakete ek olarak [ikinci pakette dört yeni yazı](./batch-02/README.md) hazırlandı ve yerelde yayımlandı: açık lise başvuru koşulları, eğitim bilgisi onayı, cevap kâğıdı kodlama ve meslek lisesi ek puanı. İkinci paketin SEO alanları ve kaynak eşleştirmesi kendi klasöründedir.

Programlar ve kontenjanlar kılavuzundan [üçüncü pakette 12 yeni yazı](./batch-03/README.md) hazırlandı: tercih listesi, tablo okuma, başarı sırası koşulları, özel kontenjanlar, burs, hazırlık, M.T.O.K., kayıt ve özel yetenek başvuruları. Bu paket de kendi SEO alanlarını ve sayfa/koşul eşleştirmesini içerir; kapaklarıyla yerelde yayımlandı.

| Öncelik | Başlık | Ana arama ifadesi | Arama ihtiyacı |
| --- | --- | --- | --- |
| 1 | [TYT, AYT ve YDT farkları: Hangi oturumlara girmelisin?](./yks-tyt-ayt-ydt-farklari.md) | TYT AYT YDT farkları | Hedef puan türüne göre oturum seçmek |
| 2 | [YKS başvurusu nasıl yapılır? AİS ve ödeme adımları](./yks-basvurusu-nasil-yapilir.md) | YKS başvurusu nasıl yapılır | Başvuruyu kayıt ve ödeme adımlarıyla tamamlamak |
| 3 | [YKS aday başvuru formu ve sınav merkezi seçimi](./yks-aday-basvuru-formu-sinav-merkezi.md) | YKS aday başvuru formu | Formdaki alanları ve merkez koşullarını anlamak |
| 4 | [YKS sınav günü: Gerekli belgeler ve eşya kuralları](./yks-sinav-gunu-gerekli-belgeler.md) | YKS sınav günü gerekli belgeler | Sınav sabahına belge ve ulaşım hazırlığı yapmak |
| 5 | [YKS net hesaplama ve puanın hesaplanma koşulları](./yks-net-hesaplama-puan-kosullari.md) | YKS net hesaplama | Net hesabını ve asgari ham puan koşullarını anlamak |
| 6 | [OBP nasıl hesaplanır? Diploma notu ve kırık OBP](./obp-hesaplama-kirik-obp.md) | OBP hesaplama | OBP, katkı ve katsayı düşüşünü ayırt etmek |
| 7 | [YKS engelli aday başvurusu: AİS ve e-rapor adımları](./yks-engelli-aday-basvurusu-e-rapor.md) | YKS engelli aday başvurusu | Rapor, uygulama ve onay akışını izlemek |

Öncelikler editoryal öneridir. Arama hacmi veya rekabet ölçümü yapılmadı; sayı ya da trafik tahmini üretilmedi. Başvuru sezonu yaklaştığında başvuru ve form yazıları, sınav öncesinde sınav günü yazısı yeniden öne çıkarılabilir. Oturum, net ve OBP yazıları hazırlık döneminde birlikte kullanılabilir.

## Dosyaları nasıl kullanabilirsin?

- Her `.md` dosyası blogun **gövde** alanına karşılık gelir. H1 içermez; sayfanın ana başlığı `title` alanından gelir.
- [metadata.json](./metadata.json) her yazı için `slug`, `title`, `family`, `category`, `bodyFormat`, `metaTitle`, `metaDescription`, `source` ve `sourceUrl` alanlarını içerir. `bodyFile`, gövdenin bulunduğu dosyayı gösterir.
- `editorial` altındaki anahtar kelimeler, kaynak başvuruları ve ilgili yazılar planlama içindir; API alanı değildir. Dosya doğrudan API'ye gönderilecek bir istek gövdesi değildir.
- Yerel yayında kurumsal yazar `PuhuKoç`, doğrulayan alanı `ÖSYM kaynak karşılaştırması (otomatik)` olarak kaydedildi. `verifiedAt` ve `publishedAt` gerçekleşen işlem zamanlarını taşır. İnsan eğitmen adı veya unvanı uydurulmadı; `authorTitle` ve `authorBio` boş kaldı. Canlı aktarımda kaynak kapsamı ve doğrulama bilgileri yeniden değerlendirilmelidir.
- Önerilen adresler `/blog/{slug}` biçimindedir. Mevcut yazılarla aynı arama ihtiyacını karşılayan bir sayfa varsa yeni adres açmadan önce mevcut yazıyı güncelleme seçeneğini değerlendir. Bu pakette canlı veritabanı envanteri incelenmedi.

## İlgili yazılar nasıl bağlanmalı?

Her yazının `editorial.relatedArticles` alanında hedef yazı, bağlantı metni ve önerilen konum bulunur. Yerel yayın sırasında bütün hedefler aynı işlemde yayımlandı; gövdelere “İlgili yazılar” bölümü ve `http://localhost:3000/blog/...` bağlantıları eklendi. Markdown kaynak dosyaları ortama özgü bu ek bölümü içermez. Canlı aktarımda bağlantılar gerçek site adresiyle yeniden oluşturulmalıdır.

Mevcut Markdown göstericisi (`ArticleMarkdown`) yalnız `http://` ve `https://` bağlantılarını tıklanabilir çiziyor; göreli `/blog/...` bağlantıları metin olarak kalıyor. Bu nedenle yerel yayında tam adres kullanıldı. Bu pakette arayüz kodu değiştirilmedi.

Başlangıçta başvuru yazısını oturum, form ve engelli başvuru yazılarıyla bağlamak; net yazısını oturum ve OBP yazılarıyla ilişkilendirmek yeterli. Her sayfadan bütün yazılara bağlantı eklemek gerekmez.

## Kaynak ve güncelleme kapsamı

Temel kaynaklar, kullanıcı tarafından sağlanan dört PDF'dir. Kaynak kimlikleri, dosya özetleri ve iddia eşleşmeleri [source-map.md](./source-map.md) içinde bulunur. ÖSYM'nin [kılavuz sayfasındaki](https://www.osym.gov.tr/2026yuksekogretim-kurumlari-sinavi-yks-kilavuzu) ve [SSS sayfasındaki](https://www.osym.gov.tr/2026-yks-sikca-sorulan-sorular-20260406110510264) resmî belge bağlantıları da kontrol edildi.

Yayın hazırlığında dört PDF resmî adreslerinden yeniden indirildi. Başvuru formu, SSS ve engelli başvuru kılavuzu yerel dosyalarla birebir eşleşti. Ana kılavuzun dosya boyutu ve dosya özeti farklı olsa da 146 sayfanın çıkarılan metni, boşluk farkları kaldırılarak karşılaştırıldığında aynı çıktı. Bu karşılaştırma kaynak sürümlerini destekler; sonraki resmî duyuru veya değişikliklerin takibi yine gerekir.

Sonraki yılın kılavuzu yayımlandığında yalnızca “2026” ibarelerini değiştirmek yeterli olmaz. Şu alanlar yeniden okunmalı:

1. Oturumlar, süreler, testler ve puan hesaplama koşulları.
2. Başvuru kanalları, ödeme/muafiyet kuralları ve bilgi güncelleme işlemleri.
3. Form alanları, sınav merkezi kısıtları ve dil seçimi.
4. Kabul edilen kimlikler, eşya kuralları ve sağlık istisnaları.
5. OBP katsayıları, önceki yerleştirme hükümleri ve özel durumlar.
6. E-rapor akışı, rapor geçerliliği, uygulama ve onay koşulları.

Başvuru, ödeme, sınav ve onay için kesin takvim tarihleri gövdelere taşınmadı. Tarihler uygulamanın doğrulanmış takvim/veri kartlarından gösterilmeli. Yazılardaki 2026 etiketli süreler ve sayısal kurallar, yeni dönemin doğrulanmış bilgisi gibi sunulmamalı.

## SEO yaklaşımı

Her yazı farklı bir soruya cevap verir. Başlık ve ilk paragraf o ihtiyacı doğrudan karşılar; hesaplar örnekle, süreçler işlem sırasıyla açıklanır. Tekrarlayan “YKS nedir?” girişleri, anahtar kelime yığınları, sonuç garantileri ve yapay uzmanlık iddiaları kullanılmadı. Bu yaklaşım Google'ın [insanlar için yararlı ve güvenilir içerik](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) rehberiyle uyumludur.

Başlık ve açıklamalar ayrı yazıldı. Uzunlukları bir yazım tercihi olarak kısa tutuldu; arama sonucunda aynen gösterilecekleri veya sıralama sağlayacakları varsayılmadı. Yalnız Türkçe içerik hazırlandı; İngilizce karşılığı varmış gibi metadata üretilmedi. Mevcut sayfa şablonunun canonical ve dil işaretleri yayın sırasında ayrıca değerlendirilmeli.

## Yapılan kontroller

- Formun görsel düzeni ve puan türü tablolarının sütun eşleşmeleri PDF sayfaları üzerinden incelendi; tablo renderında bazı yazı tipleri eksik olduğundan Türkçe başlıklar metin çıkarımıyla da karşılaştırıldı.
- Net ve OBP örnekleri yeniden hesaplandı.
- Her yazının birincil kaynağı, kategori değeri, dosyası ve ilgili yazı hedefleri denetlendi.
- Gövdelerde H1, uzun çizgi, “lütfen”, yer tutucu ve uydurma yazar bilgisi bulunmadığı kontrol edildi.
- Yedi aktarım girdisi mevcut `upsertArticleSchema` şemasından geçti. Yazılar tek dış işlem içinde `ContentService.upsertArticle` ve `publishArticle` ile kaydedildi; mevcut yazıların üzerine yazılmadı.
- Yerel API'de yedi yazının da yayımlanmış olduğu ve gövde özetlerinin eşleştiği doğrulandı. Yedi blog adresi HTTP 200 döndü; başlık ve SEO açıklamaları HTML çıktısında görüldü. Tarayıcıda altı liste kaydı ve bir öne çıkan yazı birlikte doğrulandı.
- Liste kısa süre eski boş sonucu önbellekten gösterdi; yenileme sonrasında yedi yazı göründü. Uygulamanın liste yenileme süresi 5 dakikadır.
- Uygulama kodu veya çalışma biçimi değiştirilmediği için uygulama testleri çalıştırılmadı. Doğrulama yerel geliştirme kapsamındadır; canlı yayın veya arama motoru indekslenmesi doğrulanmadı. Çevrimdışı aktarım sürecinin yayın olayları kayda alındı; çalışan API'nin embedding dinleyicisi bu süreçte çağrılmadı.
