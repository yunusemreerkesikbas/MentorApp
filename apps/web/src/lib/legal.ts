/**
 * Legal document registry (launch prerequisite).
 *
 * The bodies below are **section skeletons only** — no legal claim is invented here. A lawyer /
 * mali müşavir supplies the real text; the developer pastes it in and flips `status` to `FINAL`.
 * Every spot awaiting that text carries the `{{…}}` marker.
 *
 * GUARDRAIL: a `FINAL` document may not still contain `{{`. `assertPublishable` enforces it and
 * runs during static generation of every legal page, so an unfinished document cannot reach
 * production — `pnpm build` fails instead. This is deliberately NOT a unit test: `apps/web` has no
 * test runner, and a build-time failure is harder to skip than a test nobody runs.
 *
 * ponytail: one file. Split per document if the real texts make it unwieldy.
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

/** The token marking text the lawyer still has to supply. */
export const PLACEHOLDER_MARKER = "{{";

const PENDING = {
  tr: "> {{Hukuki metin bekleniyor.}}",
  en: "> {{Legal text pending.}}",
} as const;

/** Turn a heading list into a skeleton body — every section gets the same pending marker. */
const skeleton = (sections: readonly string[], locale: keyof typeof PENDING): string =>
  sections.map((s) => `## ${s}\n\n${PENDING[locale]}`).join("\n\n");

export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDoc> = {
  "kvkk-aydinlatma": {
    slug: "kvkk-aydinlatma",
    status: "DRAFT",
    updatedAt: "2026-07-31",
    tr: {
      title: "KVKK Aydınlatma Metni",
      body: skeleton([
        "Veri Sorumlusunun Kimliği",
        "İşlenen Kişisel Veriler",
        "Kişisel Verilerin İşlenme Amaçları",
        "Hukuki Sebepler",
        "Kişisel Verilerin Aktarılması",
        "Saklama Süresi",
        "İlgili Kişinin Hakları",
        "Başvuru Yöntemi",
      ], "tr"),
    },
    en: {
      title: "Personal Data Protection Notice",
      body: skeleton([
        "Data Controller",
        "Personal Data Processed",
        "Purposes of Processing",
        "Legal Grounds",
        "Data Transfers",
        "Retention Period",
        "Your Rights",
        "How to Apply",
      ], "en"),
    },
  },

  "gizlilik-politikasi": {
    slug: "gizlilik-politikasi",
    status: "DRAFT",
    updatedAt: "2026-07-31",
    tr: {
      title: "Gizlilik Politikası",
      body: skeleton([
        "Topladığımız Veriler",
        "Verilerin Kullanım Amaçları",
        "Çerezler ve Benzer Teknolojiler",
        "Üçüncü Taraf Hizmet Sağlayıcılar",
        "Veri Güvenliği",
        "Haklarınız ve İletişim",
      ], "tr"),
    },
    en: {
      title: "Privacy Policy",
      body: skeleton([
        "Data We Collect",
        "How We Use Data",
        "Cookies and Similar Technologies",
        "Third-Party Service Providers",
        "Data Security",
        "Your Rights and Contact",
      ], "en"),
    },
  },

  "kullanim-kosullari": {
    slug: "kullanim-kosullari",
    status: "DRAFT",
    updatedAt: "2026-07-31",
    tr: {
      title: "Kullanım Koşulları",
      body: skeleton([
        "Taraflar ve Kapsam",
        "Hesap Açma ve Üyelik",
        "Kullanım Kuralları",
        "Fikri Mülkiyet Hakları",
        "Hizmetin Sunumu ve Değişiklikler",
        "Sorumluluğun Sınırlandırılması",
        "Sözleşmenin Sona Ermesi",
        "Uygulanacak Hukuk ve Uyuşmazlık Çözümü",
      ], "tr"),
    },
    en: {
      title: "Terms of Use",
      body: skeleton([
        "Parties and Scope",
        "Account and Membership",
        "Rules of Use",
        "Intellectual Property",
        "Service Availability and Changes",
        "Limitation of Liability",
        "Termination",
        "Governing Law and Disputes",
      ], "en"),
    },
  },

  "mesafeli-satis-sozlesmesi": {
    slug: "mesafeli-satis-sozlesmesi",
    status: "DRAFT",
    updatedAt: "2026-07-31",
    tr: {
      title: "Mesafeli Satış Sözleşmesi",
      body: skeleton([
        "Taraflar",
        "Sözleşmenin Konusu",
        "Hizmetin Nitelikleri ve Bedeli",
        "Ödeme ve Faturalandırma",
        "Tarafların Yükümlülükleri",
        "Cayma Hakkı",
        "Sözleşmenin Süresi ve Feshi",
        "Uyuşmazlık Halinde Başvuru Yolları",
      ], "tr"),
    },
    en: {
      title: "Distance Sales Agreement",
      body: skeleton([
        "Parties",
        "Subject of the Agreement",
        "Service Description and Price",
        "Payment and Invoicing",
        "Obligations of the Parties",
        "Right of Withdrawal",
        "Term and Termination",
        "Dispute Resolution",
      ], "en"),
    },
  },

  "on-bilgilendirme-formu": {
    slug: "on-bilgilendirme-formu",
    status: "DRAFT",
    updatedAt: "2026-07-31",
    tr: {
      title: "Ön Bilgilendirme Formu",
      body: skeleton([
        "Satıcı / Sağlayıcı Bilgileri",
        "Hizmetin Temel Nitelikleri",
        "Toplam Bedel ve Ödeme Şekli",
        "Sözleşmenin Süresi",
        "Cayma Hakkı ve İstisnaları",
        "Şikâyet ve İtiraz Başvuruları",
      ], "tr"),
    },
    en: {
      title: "Pre-Sale Information Form",
      body: skeleton([
        "Seller / Provider Details",
        "Key Characteristics of the Service",
        "Total Price and Payment",
        "Contract Duration",
        "Right of Withdrawal and Exceptions",
        "Complaints and Appeals",
      ], "en"),
    },
  },

  "iade-ve-cayma-hakki": {
    slug: "iade-ve-cayma-hakki",
    status: "DRAFT",
    updatedAt: "2026-07-31",
    tr: {
      title: "İade ve Cayma Hakkı",
      body: skeleton([
        "Cayma Hakkı Süresi",
        "Cayma Hakkının Kullanılması",
        "İade Süreci ve Bedel İadesi",
        "Cayma Hakkının İstisnaları",
        "İletişim",
      ], "tr"),
    },
    en: {
      title: "Refunds and Right of Withdrawal",
      body: skeleton([
        "Withdrawal Period",
        "How to Exercise Withdrawal",
        "Refund Process",
        "Exceptions to the Right of Withdrawal",
        "Contact",
      ], "en"),
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
