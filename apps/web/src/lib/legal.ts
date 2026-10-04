/**
 * Legal document registry (launch prerequisite).
 *
 * Turkish documents are the binding product copy; English documents are informational translations.
 * The registry is the single content source for both public and authenticated legal routes.
 *
 * GUARDRAIL: a `FINAL` document may not still contain `{{`. `assertPublishable` enforces it and
 * runs during static generation of every legal page, so an unfinished document cannot reach
 * production — `pnpm build` fails instead. This is deliberately NOT a unit test: `apps/web` has no
 * test runner, and a build-time failure is harder to skip than a test nobody runs.
 *
 * The product owner requested FINAL publication before counsel review. Future legal review should
 * revise this registry in place so consent links, public pages, and settings never drift apart.
 */

export const LEGAL_SLUGS = [
  "kvkk-aydinlatma",
  "gizlilik-politikasi",
  "kullanim-kosullari",
  "mesafeli-satis-sozlesmesi",
  "on-bilgilendirme-formu",
  "iade-ve-cayma-hakki",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** DRAFT → visible draft banner + noindex. FINAL → indexable, banner gone. */
export type LegalStatus = "DRAFT" | "FINAL";

export interface LegalDocContent {
  title: string;
  /** Markdown. Rendered by the shared ArticleMarkdown (no raw HTML). */
  body: string;
}

export interface LegalDoc {
  slug: LegalSlug;
  status: LegalStatus;
  /** ISO date shown to the reader — "son güncelleme". */
  updatedAt: string;
  tr: LegalDocContent;
  en: LegalDocContent;
}

/** Build guard retained so future revisions cannot accidentally publish placeholders. */
export const PLACEHOLDER_MARKER = "{{";

const CONTROLLER_TR =
  "Yunus Emre Erkesikbaş, Mustafa Sabri Küçükaşçı Caddesi No: 28/B, Karatay/Konya, info@mentor.com";
const CONTROLLER_EN =
  "Yunus Emre Erkesikbaş, Mustafa Sabri Küçükaşçı Avenue No: 28/B, Karatay/Konya, Türkiye, info@mentor.com";

const LEGAL_COPY = {
  kvkk: {
    tr: `## Veri Sorumlusunun Kimliği

6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu ${CONTROLLER_TR} adresindeki Yunus Emre Erkesikbaş'tır. Bu metin, Mentor web uygulamasındaki kişisel veri işleme faaliyetleri hakkında ilgili kişileri bilgilendirir.

## İşlenen Kişisel Veriler

Hesap ve iletişim verileri (ad soyad, kullanıcı adı, e-posta), üyelik ve güvenlik kayıtları, sınav türü ve hedefleri, çalışma planı ve seansları, deneme sonuçları, duygu check-in'leri, yüklenen görseller, yanlış defteri ve hedef panosu içerikleri, AI koç görüşmeleri, topluluk gönderileri ve etkileşimleri, insan koçluğu bağlantı ve ilerleme sinyalleri, abonelik ve ödeme işlem referansları, cihaz ve teknik günlükler işlenebilir. Kart bilgileri Mentor tarafından saklanmaz; ödeme sağlayıcısı iyzico tarafından işlenir. Doğum tarihi toplanmaz; kayıt sırasında yalnızca 13 yaş ve üzeri olunduğuna dair öz beyan alınır.

## İşleme Amaçları ve Hukuki Sebepler

Veriler; hesabın kurulması ve güvenli işletilmesi, sözleşmenin ifası, çalışma ve koçluk özelliklerinin sunulması, abonelik ve destek süreçleri, kötüye kullanımın önlenmesi, yasal yükümlülüklerin yerine getirilmesi ve bir hakkın tesisi, kullanılması veya korunması amaçlarıyla KVKK m.5/2 kapsamındaki uygun sebeplere dayanılarak işlenir. Zorunlu olmayan analitik, AI hafızası veya özel bir özellik açık rıza gerektiriyorsa rıza ayrıca alınır; aydınlatma metni açık rıza yerine geçmez.

## Aktarım ve Yurt Dışı Hizmet Sağlayıcıları

Hizmetin çalışması için veriler, amaçla sınırlı ve gerekli olduğu ölçüde Neon (veritabanı), Cloudflare (güvenlik, Turnstile ve R2 depolama), Postmark (işlemsel e-posta), iyzico (ödeme), Sentry (hata izleme), Google (OAuth ve yalnız izin verilirse Analytics), OpenAI (metin ve içerik tabanlı AI işlemleri) ve Gemini (görselden konu sınıflandırma) gibi hizmet sağlayıcılarla paylaşılabilir. AI sağlayıcılarına mümkün olduğunca kişisel veriden arındırılmış özet gönderilir; ödeme, kimlik ve iletişim bilgileri AI istemlerine kasıtlı olarak dahil edilmez. Sağlayıcıların yurt dışında bulunması veya yurt dışındaki altyapıdan hizmet vermesi halinde KVKK'nın yurt dışı aktarım hükümleri uygulanır.

## Saklama ve Güvenlik

Veriler yalnız işleme amacı, sözleşme ilişkisi, güvenlik ihtiyacı ve uygulanabilir yasal yükümlülükler için gerekli süre boyunca tutulur. Hesap silme talebinde profil ve davranışsal serbest metin silinir veya anonimleştirilir; ödeme, güvenlik, uyuşmazlık ve append-only defter kayıtları mevzuat ya da hakların korunması için gerekli olduğu ölçüde anonim veya sınırlı biçimde korunabilir. Erişim kontrolü, RLS, şifreleme, kısa ömürlü oturumlar, kayıt ve izleme tedbirleri uygulanır.

## İlgili Kişinin Hakları ve Başvuru

KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi isteme, amacı ve amaca uygun kullanımı öğrenme, aktarılan kişileri bilme, düzeltme, silme veya yok etme isteme, bu işlemlerin alıcılara bildirilmesini isteme, yalnız otomatik analiz sonucu aleyhe bir sonuca itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Kimliğinizi doğrulamaya elverişli talebinizi **info@mentor.com** adresine veya yukarıdaki posta adresine iletebilirsiniz.`,
    en: `## Data Controller

The data controller under Turkish Law No. 6698 is Yunus Emre Erkesikbaş at ${CONTROLLER_EN}. This notice explains personal-data processing in the Mentor web application. The Turkish version is binding.

## Data We Process

Mentor may process account and contact data, membership and security records, exam goals, study plans and sessions, mock-exam results, mood check-ins, uploaded media, notebook and vision-board content, AI-coach conversations, community activity, human-coaching links and progress signals, subscription and payment references, and device or technical logs. Card details are processed by iyzico and are not stored by Mentor. No date of birth is collected; signup records only a self-declaration that the user is at least 13.

## Purposes and Legal Grounds

Data is used to create and secure accounts, perform the service contract, provide study and coaching features, process subscriptions and support, prevent abuse, comply with legal duties, and establish or defend rights. Optional analytics, AI memory, or another consent-based feature uses a separate choice; this notice is not consent.

## Providers and International Transfers

Necessary data may be shared, in a purpose-limited way, with Neon, Cloudflare, Postmark, iyzico, Sentry, Google, OpenAI, and Gemini. AI requests use data-minimised summaries where possible and intentionally exclude payment and direct identity details. International-transfer requirements under applicable Turkish law are followed when a provider operates abroad.

## Retention, Security and Your Rights

Data is retained only for the service, security, legal duty, or dispute period that requires it. Account deletion removes or anonymises profile data and behavioural free text, while limited payment, security, dispute, and append-only ledger records may remain where legally necessary. You may exercise the rights listed in Article 11 of Law No. 6698 by writing to **info@mentor.com** or the postal address above.`,
  },
  privacy: {
    tr: `## Kapsam

Bu politika Mentor'un web uygulaması, hesap, AI koç, çalışma araçları, topluluk, insan koçluğu, abonelik ve destek özelliklerinde bilgilerin nasıl kullanıldığını sade dille açıklar. KVKK kapsamındaki ayrıntılı hukuki bilgilendirme için KVKK Aydınlatma Metni geçerlidir.

## Topladığımız ve Ürettiğimiz Bilgiler

Hesap bilgileri, sınav ve çalışma tercihleri, planlar, seanslar, deneme sonuçları, kullanıcının gönüllü yazdığı metinler ve yüklediği görseller, topluluk içerikleri, koçluk ilişkisi sinyalleri, abonelik durumu ve güvenlik günlükleri işlenebilir. Mentor, fotoğraftan soru çözmez; görsel yalnız konu sınıflandırması için kullanılır. Ham AI itirafları insan koça aktarılmaz; yalnız ürünün tanımladığı özet sinyaller paylaşılır.

## Bilgileri Nasıl Kullanırız

Bilgiler hesabı çalıştırmak, kişisel çalışma deneyimi sunmak, ilerlemeyi göstermek, AI ve insan koçluğu özelliklerini sağlamak, ödeme ve bildirimleri yürütmek, güvenliği korumak ve destek taleplerini yanıtlamak için kullanılır. Resmî sınav tarihleri ve süreç bilgileri AI tarafından serbestçe üretilmez; doğrulanmış editoryal içerikten sunulur.

## Sağlayıcılar, Analitik ve AI

Altyapıda Neon, Cloudflare, Postmark, iyzico ve Sentry; giriş ve izinli analitikte Google; AI metin işlemlerinde OpenAI; görsel konu sınıflandırmada Gemini kullanılabilir. Google Analytics yalnız açık tercih sonrasında yüklenir. AI sağlayıcılarına gönderilen içerik veri minimizasyonu ve maskeleme kurallarına tabidir; yine de kullanıcıların e-posta, telefon, kimlik veya ödeme bilgilerini sohbetlere yazmaması gerekir.

## Tercihleriniz ve Güvenlik

Analitik tercihi çerez tercihleri ekranından değiştirilebilir. AI hafızası ve insan koçluğu paylaşımı kendi ekranlarından yönetilir. Hesap ayarlarından verilerinize erişebilir, düzeltme isteyebilir veya hesap silme sürecini başlatabilirsiniz. Sorular ve hak talepleri **info@mentor.com** adresine gönderilebilir.`,
    en: `## Scope

This policy explains in plain language how Mentor uses information across accounts, AI coaching, study tools, community, human coaching, subscriptions, and support. The Turkish KVKK Notice contains the binding legal detail.

## Information and Uses

Mentor may process account details, exam and study preferences, plans, sessions, mock results, voluntarily submitted text and media, community content, coaching signals, subscription status, and security logs. Photos are used only to classify a topic, never to solve a question. Raw AI confessions are not disclosed to a human coach; only defined signals may be shared.

Information is used to operate accounts, personalise study tools, show progress, provide AI and human coaching, run payments and notifications, protect security, and answer support requests. Official exam facts come from verified editorial content rather than free-generated AI output.

## Providers, Analytics and AI

Mentor may use Neon, Cloudflare, Postmark, iyzico, Sentry, Google, OpenAI, and Gemini. Google Analytics loads only after an affirmative choice. AI payloads are minimised and masked, but users should not type identity, contact, or payment details into chats.

## Controls

Analytics choices can be changed on the cookie-preferences page. AI memory and human-coaching sharing have their own controls. Account settings provide access, correction, and deletion paths. Questions may be sent to **info@mentor.com**.`,
  },
  terms: {
    tr: `## Taraflar ve Kabul

Bu Kullanım Koşulları, hizmet sağlayıcı Yunus Emre Erkesikbaş ile Mentor hesabı oluşturan kullanıcı arasındadır. Hesap açan kişi koşulları kabul ettiğini ve en az 13 yaşında olduğunu beyan eder. 13 yaş altındaki kişiler hesap açamaz; yanlış yaş beyanı tespit edilirse hesap güvenlik ve yasal yükümlülükler gözetilerek askıya alınabilir veya kapatılabilir.

## Hesap ve Güvenlik

Kullanıcı doğru bilgi vermek, giriş bilgilerini korumak ve hesabındaki faaliyetlerden sorumludur. Hesap devredilemez. Şüpheli kullanım derhal **info@mentor.com** adresine bildirilmelidir. Mentor, güvenliği korumak için oturumları sonlandırabilir veya doğrulama isteyebilir.

## Hizmetin Kullanımı

Mentor bir sınava hazırlık yoldaşlığı ve çalışma organizasyonu hizmetidir; başarı, yerleşme veya belirli bir sonuç garanti etmez. Kullanıcı hukuka aykırı, yanıltıcı, taciz edici, başkasının hakkını ihlal eden içerik paylaşamaz; hizmeti otomatik kötüye kullanamaz, güvenliğini aşamaz veya başka kullanıcıların verilerine erişmeye çalışamaz. Topluluk ve koçluk alanlarında saygılı iletişim esastır.

## AI ve Resmî Bilgi Sınırları

AI çıktıları eğitim ve organizasyon desteğidir; hukuk, sağlık veya psikolojik tedavi hizmeti değildir. Acil risk halinde yetkili acil yardım kanallarına başvurulmalıdır. Fotoğraf özelliği yalnız konu sınıflandırır, soru çözmez. Sınav tarihleri, başvuru ve yerleştirme gibi kritik bilgiler doğrulanmış veri kartlarından sunulur; kullanıcı resmî kurum kaynağını ayrıca kontrol etmelidir.

## Fikri Mülkiyet ve Kullanıcı İçeriği

Mentor yazılımı, tasarımı ve editoryal içerikleri üzerindeki haklar saklıdır. Kullanıcı kendi içeriğinin haklarını korur ve içeriği yalnız hizmetin sunulması, saklanması, görüntülenmesi ve seçtiği paylaşım alanlarında iletilmesi için gerekli sınırlı kullanım iznini verir. Hukuka aykırı veya hak ihlali oluşturan içerik kaldırılabilir.

## Ücretli Hizmetler, Değişiklik ve Sona Erme

Ücretli özelliklerde fiyat, dönem, deneme ve otomatik yenileme bilgisi satın alma öncesinde gösterilir. Kullanıcı aboneliğini ilgili ekrandan yönetebilir. Mentor hizmeti güvenlik, mevzuat veya ürün gereksinimleri için değiştirebilir; esaslı değişiklikler uygun kanaldan duyurulur. Kullanıcı hesabını ayarlardan silebilir. İhlal, dolandırıcılık veya güvenlik riski halinde erişim sınırlandırılabilir.

## Sorumluluk ve Uyuşmazlık

Mentor hizmeti makul özenle sunar ancak internet, üçüncü taraf sağlayıcı veya kullanıcı kaynaklı kesintilerden mevzuatın izin verdiği ölçüde sorumlu değildir. Emredici tüketici hakları saklıdır. Türk hukuku uygulanır; tüketici hakem heyeti ve tüketici mahkemeleri dahil kanunen yetkili mercilere başvuru hakkı korunur.`,
    en: `## Parties and Acceptance

These Terms are between service provider Yunus Emre Erkesikbaş and the Mentor account holder. A person creating an account accepts the Terms and declares that they are at least 13. Accounts are not available to children under 13; a false age declaration may lead to suspension or closure subject to safety and legal duties.

## Account and Acceptable Use

Users must provide accurate information, protect credentials, and remain responsible for account activity. Accounts are not transferable. Users may not submit unlawful, deceptive, harassing, or rights-infringing content; automate abuse; bypass security; or access another person's data.

## Nature of the Service and AI

Mentor supports exam preparation and study organisation but does not guarantee success or placement. AI output is educational support, not legal, medical, or psychological treatment. Photo features classify topics and do not solve questions. Critical exam facts are supplied through verified data cards and should also be checked against the relevant authority.

## Content, Paid Services and Termination

Mentor retains rights in its software, design, and editorial content. Users retain their content and grant the limited permission needed to store, display, and deliver it through selected features. Price, billing period, trial, and renewal terms are shown before purchase. Users may manage subscriptions and delete their account in settings. Access may be restricted for breach, fraud, or security risk.

## Liability and Law

Mentor uses reasonable care but, to the extent permitted by law, is not liable for outages caused by networks, providers, or users. Mandatory consumer rights remain unaffected. Turkish law applies and statutory consumer authorities and courts remain available.`,
  },
  distance: {
    tr: `## Taraflar ve Konu

Sağlayıcı: ${CONTROLLER_TR}. Alıcı, elektronik ortamda Mentor aboneliğini satın alan kullanıcıdır. Bu sözleşme, sipariş özetinde gösterilen dijital abonelik hizmetinin uzaktan satışına ilişkindir.

## Hizmet, Bedel ve Ödeme

Paketin adı, kapsamı, vergiler dahil toplam bedeli, faturalama dönemi, varsa deneme süresi ve indirim satın alma ekranında siparişe özgü olarak gösterilir ve bu sözleşmenin ayrılmaz parçasıdır. Ödeme iyzico altyapısıyla alınır; Mentor kart numarası veya güvenlik kodu saklamaz. Abonelik ekranında aksi belirtilmedikçe plan seçilen dönem sonunda otomatik yenilenir ve kullanıcı yenilemeden önce iptal edebilir.

## İfa ve Dijital İçeriğe Erişim

Ödeme veya deneme başlangıcı doğrulandıktan sonra dijital hizmet kullanıcı hesabında erişime açılır. Kullanıcı, satın alma sırasında açıkça talep ederek hizmetin cayma süresi dolmadan başlamasını isterse dijital hizmetin niteliğine göre cayma hakkı istisnası doğabilir; bu husus ödeme onayından önce ayrıca gösterilir.

## Cayma, İptal ve İade

Emredici tüketici mevzuatındaki cayma hakları saklıdır. Cayma hakkının mevcut olduğu durumlarda kullanıcı on dört gün içinde açık bir bildirimle **info@mentor.com** adresine başvurabilir. Hizmetin derhal başlamasına ilişkin onay, tüketilmiş dönem, kampanya koşulları ve mevzuattaki dijital içerik/hizmet istisnaları iade değerlendirmesinde dikkate alınır. Teknik hata veya mükerrer tahsilat talepleri ayrıca incelenir.

## Başvuru ve Uyuşmazlık

Destek, iptal ve cayma bildirimleri **info@mentor.com** adresine iletilir. Kullanıcının tüketici hakem heyeti, tüketici mahkemesi ve diğer kanuni mercilere başvuru hakkı saklıdır.`,
    en: `## Parties and Subject

Provider: ${CONTROLLER_EN}. The customer is the user purchasing a Mentor subscription online. This agreement governs the distance sale of the digital subscription shown in the order summary. The Turkish version is binding.

## Service, Price and Payment

The plan, scope, tax-inclusive total, billing period, trial, and discount are displayed before purchase and form part of this agreement. Payments use iyzico; Mentor does not store card numbers or security codes. Unless stated otherwise at checkout, a plan renews at the end of its period and can be cancelled before renewal.

## Performance, Withdrawal and Refunds

Access begins after payment or trial confirmation. If the user expressly asks for immediate digital performance before the withdrawal period expires, a statutory digital-service exception may apply; the checkout must show that consequence before confirmation. Where withdrawal remains available, notice may be sent within fourteen days to **info@mentor.com**. Immediate-performance consent, consumed periods, campaign terms, duplicate charges, technical failure, and mandatory law are considered in a refund review.

## Disputes

Support and cancellation notices may be sent to **info@mentor.com**. Mandatory consumer authority and court rights remain unaffected.`,
  },
  preInfo: {
    tr: `## Sağlayıcı Bilgileri

Sağlayıcı ${CONTROLLER_TR}. Destek, şikâyet, iptal ve cayma talepleri aynı e-posta ve posta adresinden iletilebilir.

## Hizmetin Temel Nitelikleri

Mentor; seçilen pakete göre çalışma planı, analiz, AI koç, içerik, topluluk veya diğer dijital özelliklere süreli erişim sağlar. Satın alınan paketin güncel özellikleri, sınırları ve dönem bilgisi ödeme öncesindeki paket ve sipariş özetinde gösterilir.

## Bedel, Ödeme ve Yenileme

Vergiler dahil toplam bedel, ödeme yöntemi, deneme süresi, indirimli dönem ve sonraki yenileme bedeli sipariş ekranında açıklanır. Tahsilat iyzico üzerinden yapılır. Otomatik yenilenen planlar, kullanıcı iptal edene kadar belirtilen dönemlerde yenilenir; iptal geçmiş dönem kullanımını geriye dönük olarak kaldırmaz.

## İfa, Cayma ve Şikâyet

Dijital hizmet ödeme veya deneme onayından sonra hesapta açılır. On dört günlük cayma hakkı ve dijital hizmetin derhal başlamasına ilişkin kanuni istisnalar satın alma onayında ayrıca belirtilir. Cayma veya destek talebi **info@mentor.com** adresine gönderilebilir. Kullanıcının tüketici hakem heyeti ve tüketici mahkemesine başvuru hakkı saklıdır.

## Kayıt ve Onay

Kullanıcı siparişi tamamlamadan önce paket özetini, bu formu ve Mesafeli Satış Sözleşmesi'ni erişilebilir biçimde görür. Elektronik onay ve işlem zamanı uyuşmazlık halinde işlem kaydı olarak saklanabilir.`,
    en: `## Provider

The provider is ${CONTROLLER_EN}. Support, complaints, cancellation, and withdrawal notices may use the same contact details. The Turkish version is binding.

## Main Characteristics

Depending on the selected plan, Mentor provides time-limited access to study planning, analysis, AI coaching, content, community, or other digital features. Current features, limits, period, tax-inclusive total, payment method, trial, discount, and renewal price appear in the plan and order summary before purchase.

## Performance, Renewal and Withdrawal

Access begins after payment or trial confirmation. Recurring plans renew for the displayed period until cancelled. The fourteen-day withdrawal framework and any exception for immediate digital performance are shown before confirmation. Notices may be sent to **info@mentor.com** and mandatory consumer remedies remain available.

## Records

Before ordering, the user can access the order summary, this information form, and the Distance Sales Agreement. Electronic confirmation and transaction time may be retained as evidence of the transaction.`,
  },
  refund: {
    tr: `## Cayma Süresi ve Bildirim

Tüketici mevzuatının cayma hakkı tanıdığı durumlarda kullanıcı, sözleşmenin kurulduğu tarihten itibaren on dört gün içinde gerekçe göstermeden **info@mentor.com** adresine açık bir bildirim gönderebilir. Bildirimde hesap e-postası ve işlemi bulmaya yarayan ödeme referansı yer almalıdır; kart bilgisinin tamamı gönderilmemelidir.

## Dijital Hizmet İstisnası

Kullanıcının açık talebi ve bilgilendirilmiş onayıyla dijital hizmetin cayma süresi dolmadan başlaması halinde, mevzuattaki koşullar gerçekleşmişse cayma hakkı sona erebilir. Bu onay satın alma işlemi sırasında, ödeme onayından ayrı ve görünür biçimde alınır. Emredici tüketici hakları sözleşmeyle kaldırılamaz.

## İptal ve Bedel İadesi

Aboneliğin iptali sonraki yenilemeyi durdurur; aksi emredici mevzuattan doğmadıkça başlamış veya kullanılmış dönemi otomatik olarak geriye dönük iade etmez. Geçerli cayma, mükerrer tahsilat veya hizmetin sağlayıcı kaynaklı sunulamaması halinde iade, kullanılan ödeme aracına ve yasal süreler içinde yapılır. Banka veya ödeme kuruluşunun hesaba yansıtma süresi Mentor'un kontrolü dışında olabilir.

## İnceleme ve Başvuru

Talep alındığında abonelik, erişim başlangıcı, ayrı onaylar, kullanım ve tahsilat kaydı incelenir; sonuç kullanıcıya e-posta ile bildirilir. Kullanıcının tüketici hakem heyeti, tüketici mahkemesi ve diğer kanuni mercilere başvuru hakkı saklıdır.`,
    en: `## Withdrawal Notice

Where mandatory consumer law provides a right of withdrawal, the user may send an unambiguous notice within fourteen days of contracting to **info@mentor.com**. The notice should include the account email and payment reference, but never the full card details. The Turkish version is binding.

## Digital-Service Exception

If digital performance starts before the withdrawal period expires following the user's express request and informed acknowledgement, the statutory digital-service exception may end the withdrawal right when its legal conditions are met. Checkout presents this separately from payment confirmation. Mandatory consumer rights cannot be waived by contract.

## Cancellation and Refund

Cancellation stops the next renewal; it does not automatically refund a started or consumed period unless mandatory law requires it. Valid withdrawal, duplicate charges, or provider-caused non-delivery are refunded to the original payment method within applicable legal timeframes. Bank processing time may be outside Mentor's control.

## Review

Mentor reviews subscription, access, acknowledgement, usage, and payment records and communicates the result by email. Statutory consumer authorities and courts remain available.`,
  },
} as const;

export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDoc> = {
  "kvkk-aydinlatma": {
    slug: "kvkk-aydinlatma",
    status: "FINAL",
    updatedAt: "2026-09-17",
    tr: {
      title: "KVKK Aydınlatma Metni",
      body: LEGAL_COPY.kvkk.tr,
    },
    en: {
      title: "Personal Data Protection Notice",
      body: LEGAL_COPY.kvkk.en,
    },
  },

  "gizlilik-politikasi": {
    slug: "gizlilik-politikasi",
    status: "FINAL",
    updatedAt: "2026-09-17",
    tr: {
      title: "Gizlilik Politikası",
      body: LEGAL_COPY.privacy.tr,
    },
    en: {
      title: "Privacy Policy",
      body: LEGAL_COPY.privacy.en,
    },
  },

  "kullanim-kosullari": {
    slug: "kullanim-kosullari",
    status: "FINAL",
    updatedAt: "2026-09-17",
    tr: {
      title: "Kullanım Koşulları",
      body: LEGAL_COPY.terms.tr,
    },
    en: {
      title: "Terms of Use",
      body: LEGAL_COPY.terms.en,
    },
  },

  "mesafeli-satis-sozlesmesi": {
    slug: "mesafeli-satis-sozlesmesi",
    status: "FINAL",
    updatedAt: "2026-09-17",
    tr: {
      title: "Mesafeli Satış Sözleşmesi",
      body: LEGAL_COPY.distance.tr,
    },
    en: {
      title: "Distance Sales Agreement",
      body: LEGAL_COPY.distance.en,
    },
  },

  "on-bilgilendirme-formu": {
    slug: "on-bilgilendirme-formu",
    status: "FINAL",
    updatedAt: "2026-09-17",
    tr: {
      title: "Ön Bilgilendirme Formu",
      body: LEGAL_COPY.preInfo.tr,
    },
    en: {
      title: "Pre-Sale Information Form",
      body: LEGAL_COPY.preInfo.en,
    },
  },

  "iade-ve-cayma-hakki": {
    slug: "iade-ve-cayma-hakki",
    status: "FINAL",
    updatedAt: "2026-09-17",
    tr: {
      title: "İade ve Cayma Hakkı",
      body: LEGAL_COPY.refund.tr,
    },
    en: {
      title: "Refunds and Right of Withdrawal",
      body: LEGAL_COPY.refund.en,
    },
  },
};

export const isLegalSlug = (value: string): value is LegalSlug =>
  (LEGAL_SLUGS as readonly string[]).includes(value);

export function getLegalDoc(slug: string): LegalDoc | null {
  return isLegalSlug(slug) ? LEGAL_DOCUMENTS[slug] : null;
}

/**
 * Fails the build when a document claims to be FINAL but still carries pending markers.
 * Called from the legal page — static generation covers every slug × locale, so the check runs
 * on every build without a test runner.
 */
export function assertPublishable(doc: LegalDoc): void {
  if (doc.status !== "FINAL") return;
  for (const locale of ["tr", "en"] as const) {
    if (doc[locale].body.includes(PLACEHOLDER_MARKER)) {
      throw new Error(
        `Legal document "${doc.slug}" (${locale}) is marked FINAL but still contains ` +
          `${PLACEHOLDER_MARKER} placeholders. Paste the approved text or set status back to DRAFT.`,
      );
    }
  }
}

/** Documents safe to advertise (sitemap). DRAFT ones are noindex, so they stay out. */
export const publishedLegalDocs = (): LegalDoc[] =>
  LEGAL_SLUGS.map((s) => LEGAL_DOCUMENTS[s]).filter((d) => d.status === "FINAL");
