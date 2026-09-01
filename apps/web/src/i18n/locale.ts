import { hasLocale } from "next-intl";
import { setRequestLocale as setNextIntlRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "./routing";

export function assertLocale(locale: string): asserts locale is Locale {
  if (!hasLocale(routing.locales, locale)) notFound();
}

export function setRequestLocale(locale: string): asserts locale is Locale {
  assertLocale(locale);
  setNextIntlRequestLocale(locale);
}
