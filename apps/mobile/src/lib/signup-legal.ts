import type { AppLocale } from "../stores/preferences.js";

/** The web's `LEGAL_SLUGS`, in its footer order; keys are the mobile copy suffixes (`settings.legal_<key>`). */
const SLUG = {
  kvkk: "kvkk-aydinlatma",
  privacy: "gizlilik-politikasi",
  terms: "kullanim-kosullari",
  distance_sales: "mesafeli-satis-sozlesmesi",
  pre_info: "on-bilgilendirme-formu",
  refund: "iade-ve-cayma-hakki",
} as const;

export type SignupLegalDocument = keyof typeof SLUG;
export const LEGAL_DOCUMENTS = Object.keys(SLUG) as SignupLegalDocument[];

export function signupLegalUrl(document: SignupLegalDocument, locale: AppLocale): string {
  const path = locale === "en" ? "en/legal" : "yasal";
  return `https://puhukoc.com/${path}/${SLUG[document]}`;
}
