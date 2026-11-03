# YKS blog paketi 2

**Durum: Dört yazı kapaklarıyla yerel geliştirme ortamında yayımlandı.** [Yerel YKS blogu](http://localhost:3000/blog?family=YKS). Başlıklar yıldan bağımsızdır; her gövdede 2026 kaynak kapsamı açıkça yazılıdır. Her Markdown dosyası blogun gövdesidir; ana başlık `metadata.json` içindeki `title` alanından gelir.

## Yeni yazılar

| Yazı | İlk paketten farkı | Ana arama ifadesi |
| --- | --- | --- |
| [Açık lise YKS başvuru şartları](./acik-lise-yks-basvuru-sartlari.md) | Genel başvuru adımlarını tekrar etmek yerine öğrenci/mezun ayrımı, kayıt tarihi ve toplam dönem koşulunu açıklar | açık lise YKS başvuru şartları |
| [Eğitim bilgisi güncelleme ve onaylama](./yks-egitim-bilgisi-guncelleme-onaylama.md) | OBP hesabından ayrı olarak kaynak kaydın düzeltilmesi, doğru bilginin seçilmesi ve birden fazla diploma durumunu işler | YKS eğitim bilgisi onaylama |
| [Cevap kâğıdı ve kitapçık kodlama](./yks-cevap-kagidi-kitapcik-kodlama.md) | Önceki sınav günü yazısındaki belge/eşya hazırlığının ardından salonda yapılacak evrak, kodlama ve teslim işlemlerini açıklar | YKS cevap kâğıdı nasıl doldurulur |
| [Meslek lisesi YKS ek puanı](./meslek-lisesi-yks-ek-puan.md) | Standart OBP anlatımını genişletmek yerine ek puan tablolarının kapsamlarını ve koşullu hesap örneğini açıklar | meslek lisesi YKS ek puan |

[SEO alanları ve ilgili yazı planı](./metadata.json) · [Kaynak ve kapsam eşleştirmesi](./source-map.md)

Başvuru, sınav ve onay için eski dönem takvim tarihleri gövdelere eklenmedi. Açık lise ve lisans ek puanı yazılarındaki tarih eşikleri, 2026 kılavuzunda hangi koşulun kime uygulanacağını belirleyen ölçütlerdir; kaynak gösterilerek tablo veya ilgili koşul içinde açıklandı. Bunlar yeni dönem başvuru tarihleri değildir.

İlk taslaklarda yazar, doğrulayan ve yayın zamanı alanları boş tutuldu. Yerel yayında kurum yazarı PuhuKoç olarak kaydedildi; kaynak karşılaştırmasının otomatik yapıldığı açıkça belirtildi ve gerçek yayın zamanı eklendi. [Yayın kaydı](./publication-local.json) · [Yayın sonrası kontrol](./publication-verification-local.json). Bağımsız insan editör onayı iddia edilmez.

## Kapak görselleri

Dört yazıya Pexels'tan seçilmiş farklı temsili kapaklar eklendi. [Kapakları incele](./images/README.md) · [Fotoğrafçı, lisans ve görsel kayıtları](./media-sources.json). Görseller 1200 × 630 WebP biçiminde, toplam yaklaşık 168 KB. Mevcut geliştirme görsel alanındaki adresler makalenin kapak alanlarına bağlandı; yerel dosya yolu da editoryal alanda kayıtlı. Kaynak kredileri yazı sonlarında bulunur. Görsel hazırlık kaydı tarihsel olarak korunur; ardından dört yazı yerel veritabanında yayımlandı.

Yerel yayında ilgili yazı bağlantıları gerçek `http://localhost:3000/blog/...` adresleriyle kayıt gövdesine eklendi. Markdown dosyaları ortama özgü bu ek bölümü içermez. Dört API detayı ve blog sayfası HTTP 200 döndü; kapaklar, gövde özetleri, SEO alanları ve kaynak kredileri eşleşti. İlk yedi yazı değiştirilmedi. Çevrimdışı yayın işlemi çalışan API'nin embedding dinleyicisini çağırmadı.

Kontrol: Dört yazının alanları mevcut makale şemasıyla doğrulandı; başlık ve açıklamaların benzersizliği, dosya ve kaynak eşleşmeleri, 2026 kapsam notları ve ilgili yazı hedefleri denetlendi. Ek puan örneği yeniden hesaplandı. Son okumada emir veren veya küçümseyici duyulabilecek ifadeler sadeleştirildi.

## Bu PDF'lerden sonra hangi kaynağa geçelim?

İlk yedi yazı ile bu dört taslak, bu kaynak grubunun genel başvuru ve sınav uygulaması konularını büyük ölçüde kapsıyor. Aynı bilgiyi daha küçük başlıklara ayırarak yeni sayfalar açmayı önermiyorum. Bu değerlendirme arama hacmi ölçümüne değil, kaynak kapsamı ve içerik tekrarına dayanıyor.

Bir sonraki paket için en yararlı kaynak **YKS Yükseköğretim Programları ve Kontenjanları Kılavuzu** olur. İlgili yılın güncel sürümünü ve varsa düzeltme duyurularını birlikte kullanmak gerekir. Bu kaynakla program koşulları, kontenjan türleri, tercih listesi işlemleri ve kayıt aşaması daha sağlam ele alınabilir. Ek yerleştirme için ayrıca **YKS ek yerleştirme kılavuzu** gerekir.

Okul birinciliği, özel kontenjanlar, yurt dışı eğitim ve özel yetenek başvuruları bu dosyalarda tamamen yok değildir. Ancak her birini kapsamlı rehbere dönüştürmek için ilgili tercih veya uygulama kılavuzuyla tamamlamak daha doğru olur. Bu ikinci pakette kişisel uygunluk veya yerleşme garantisi verilmez.
