import { enMessages } from "./en.ts";
import { trMessages, type TranslationCatalog } from "./tr.ts";
import type { AppLocale } from "../stores/preferences.ts";

export { enMessages, trMessages, type TranslationCatalog };

const CATALOGS: Record<AppLocale, TranslationCatalog> = {
  tr: trMessages,
  en: enMessages,
};

export type NamespaceKey = keyof TranslationCatalog;

export function getCatalog(locale: AppLocale): TranslationCatalog {
  return CATALOGS[locale] ?? trMessages;
}

export function formatMessage(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}
