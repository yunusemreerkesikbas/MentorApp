import type { AppLocale } from "../stores/preferences.js";

const SLUG = {
  kvkk: "kvkk-aydinlatma",
  terms: "kullanim-kosullari",
} as const;

export type SignupLegalDocument = keyof typeof SLUG;

export function signupLegalUrl(document: SignupLegalDocument, locale: AppLocale): string {
  const path = locale === "en" ? "en/legal" : "yasal";
  return `https://puhukoc.com/${path}/${SLUG[document]}`;
}
