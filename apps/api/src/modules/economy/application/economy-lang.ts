import { I18nContext } from "nestjs-i18n";

export const ECONOMY_FALLBACK_LANG = "tr";

export function resolveEconomyLang(lang?: string): string {
  const raw = lang ?? I18nContext.current()?.lang ?? ECONOMY_FALLBACK_LANG;
  return raw.toLowerCase().startsWith("en") ? "en" : "tr";
}
