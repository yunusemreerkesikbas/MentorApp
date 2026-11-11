import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import {
  formatMessage,
  getCatalog,
  type NamespaceKey,
  type TranslationCatalog,
} from "../i18n/index.js";
import { usePreferencesStore, type AppLocale } from "../stores/preferences.store.js";

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  catalog: TranslationCatalog;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = usePreferencesStore((s) => s.locale);
  const setLocale = usePreferencesStore((s) => s.setLocale);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      catalog: getCatalog(locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): { locale: AppLocale; setLocale: (next: AppLocale) => void } {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used within <I18nProvider>");
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}

/**
 * Mirrors the web `useTranslations(namespace)` API so screen components share the same mental model.
 */
export function useTranslations<N extends NamespaceKey>(namespace: N) {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslations must be used within <I18nProvider>");
  const bucket = ctx.catalog[namespace];

  return useCallback(
    <K extends keyof TranslationCatalog[N] & string>(
      key: K,
      params?: Record<string, string | number>,
    ): string => {
      const raw = (bucket as Record<string, string>)[key] ?? key;
      return formatMessage(raw, params);
    },
    [bucket],
  );
}
