import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "tr",
  // Turkish (default) has no prefix: /giris, /panel etc.
  // English gets /en prefix: /en/giris, /en/panel etc.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
