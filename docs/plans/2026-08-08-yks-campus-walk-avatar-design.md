# YKS Kampüs Yürüyüşü ve Öğrenci Avatarı Tasarımı

## Amaç

Selçuk Üniversitesi pilotundaki mevcut 3D kampüs turunu, kullanıcıya kampüste bulunma hissi veren
iki katmanlı bir deneyime dönüştürmek:

- 3D kuşbakışı görünüm kampüsü ve duraklar arasındaki ilişkiyi anlatır.
- Google Street View kapsaması bulunan duraklarda yürüyüş modu açılır.
- Kullanıcının stilize öğrenci avatarı yürüyüş sırasında ekranın alt-ortasında görünür.
- Mentor maskotu durak içeriklerinde rehber olarak kalır; avatarın yerine geçmez.

İlk sürüm serbest dolaşılan bir oyun değildir. Google Street View'un izin verdiği bağlantılı panorama
noktaları üzerinde gezinilir. Özel üç boyutlu kampüs, karakter modeli veya Three.js sahnesi üretilmez.

## Deneyim akışı

1. Simülasyon mevcut 3D kuşbakışı kampüs görünümüyle açılır.
2. Kullanıcı bir durak seçtiğinde kamera durağı bağlamıyla gösterecek, okunabilir bir mesafeye uçar.
3. Uygulama seçili durağın yakınında Street View panoraması olup olmadığını sessizce kontrol eder.
4. Kapsama varsa `Yürüyüş` seçeneği etkinleşir; yoksa kuşbakışı deneyim kesintisiz devam eder.
5. Kullanıcı yürüyüşe geçtiğinde tek bir Street View panorama örneği oluşturulur ve sonraki duraklarda
   tekrar kullanılır.
6. Panorama bağlantısında ilerleme avatarı kısa süre `WALKING`, yeni noktaya varış `ARRIVING`, durağan
   görüntü `IDLE` durumuna taşır.
7. Kullanıcı istediği anda `Kuşbakışı` seçeneğiyle 3D bağlama döner.

## Görsel ve erişilebilirlik kararı

- Varsayılan avatar, arkadan görünen ve ürün renklerini kullanan tek bir 2.5D öğrenci illüstrasyonudur.
- Avatar dekoratiftir; Street View kontrollerini veya Google atıflarını kapatmaz ve pointer event almaz.
- Hareket azaltma tercihi açıkken avatar ve kamera animasyonları çalışmaz.
- Mod seçici klavye ile kullanılabilir, en az 44 piksel dokunma alanına sahiptir ve seçili durumunu
  `aria-pressed` ile bildirir.
- Yürüyüş kapsaması yoksa kullanıcı teknik hata görmez; sakin bir açıklama ile kuşbakışında kalır.

## Teknik sınırlar

- `@googlemaps/js-api-loader` yalnız simülasyon route'unda dinamik olarak yüklenmeye devam eder.
- Maps loader tek bir adaptörde yapılandırılır; `maps3d` ve `streetView` kütüphaneleri aynı ayarları kullanır.
- Panorama kimlikleri kalıcı veri olarak saklanmaz; her durak koordinat ve yarıçap ile çalışma anında çözülür.
- İlk kapsama araması panorama oluşturmadan `StreetViewService` ile yapılır.
- Başarılı yürüyüş oturumunda tek `StreetViewPanorama` örneği kullanılır.
- Street View veya 3D hatası tercih senaryosunu ve kampüs insights panelini devre dışı bırakmaz.

## İlk sürüm dışında

- Avatar editörü, kıyafet mağazası ve kişisel avatar kaydı
- WASD ile koordinat tabanlı serbest hareket
- Three.js karakter modeli, çarpışma, derinlik veya bina içine girme
- Kullanıcı konumunun gerçek zamanlı izlenmesi
- Street View kapsaması olmayan yollar için yapay panorama üretimi

## Hover kartı giriş noktası

Selçuk pilotu, hedef olarak seçilmeden de masaüstü üniversite hover kartından açılabilir. Simülasyon
erişimi ve Selçuk kampüs deneyimi sayfa açılışından sonra bir kez kontrol edilir; hover sırasında
Google Maps veya yeni bir API isteği başlatılmaz. Kart tek bir iç içe etkileşim alanı değildir:
üniversite ayrıntısını açan düğme ile `3D simülasyonu aç` bağlantısı semantik olarak iki kardeş
aksiyondur. Mobilde hover bulunmadığından mevcut dokunma → üniversite ayrıntısı akışı korunur.
