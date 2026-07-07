"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { useMentorToast } from "@/lib/mentor-toast";
import { SendIcon } from "./forum-icons";

/**
 * Twitter-style "send": share a post's link. Native share sheet where available (mobile), else copy
 * to the clipboard + toast. `path` is the locale-agnostic in-app detail path (e.g. /topluluk/mesaj/ID);
 * the absolute URL is built with the current locale (tr has no prefix — routing is `as-needed`).
 */
export function SendButton({ path }: { path: string }) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  const toast = useMentorToast();

  const share = async () => {
    // `as-needed` prefix: the default locale has no path segment; others do.
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    const url = `${window.location.origin}${prefix}${path}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch (err) {
        // User dismissed the native sheet — not an error, and no clipboard fallback wanted.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success({ title: t("share_copied") });
    } catch {
      toast.error({ title: t("error") });
    }
  };

  return (
    <button
      type="button"
      aria-label={t("send")}
      onClick={(e) => {
        e.stopPropagation();
        void share();
      }}
      className="group/send flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ color: "var(--color-main)" }}
    >
      <span className="inline-flex transition-transform duration-150 group-hover/send:scale-110 motion-reduce:transition-none">
        <SendIcon />
      </span>
    </button>
  );
}
