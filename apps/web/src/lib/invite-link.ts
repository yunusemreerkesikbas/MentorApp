import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * The link a friend opens: absolute (it gets pasted into chats, where a bare path is useless) and
 * already in the reader's locale, `/davet/PUHU-XXXXXXXX` in Turkish and `/en/invite/...` in English.
 *
 * Built through `getPathname`, so the segment follows `routing.ts` instead of a hand-written string.
 * Browser only: `origin` defaults to `window.location.origin`; pass it explicitly anywhere else.
 */
export function buildInviteLink(
  code: string,
  locale: string,
  origin: string = window.location.origin,
): string {
  const path = getPathname({
    href: { pathname: "/invite/[code]", params: { code } },
    locale: locale as Locale,
  });
  return `${origin}${path}`;
}
