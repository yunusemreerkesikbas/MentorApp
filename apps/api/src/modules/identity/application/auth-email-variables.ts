import { EmailTokenType } from "../domain/identity.constants";

export function authEmailVariables(
  appUrl: string,
  type: EmailTokenType,
  token: string,
  locale?: string,
) {
  const lang = locale?.toLowerCase().startsWith("en") ? "en" : "tr";
  const path = type === EmailTokenType.VERIFY_EMAIL
    ? (lang === "en" ? "/en/verify-email" : "/eposta-dogrula")
    : (lang === "en" ? "/en/reset-password" : "/sifre-sifirla");
  const link = new URL(path, appUrl);
  link.searchParams.set("token", token);
  return { lang, link: link.href };
}
