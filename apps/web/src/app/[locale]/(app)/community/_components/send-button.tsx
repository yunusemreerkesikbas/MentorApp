"use client";

import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useMentorToast } from "@/lib/mentor-toast";
import { SendIcon } from "./forum-icons";

export type ShareHref =
  | {
      pathname: "/community/message/[threadId]";
      params: { threadId: string };
      query?: { highlight: string };
    }
  | {
      pathname: "/community/question/[threadId]";
      params: { threadId: string };
    }
  | {
      pathname: "/community/comment/[postId]";
      params: { postId: string };
      query?: { highlight: string };
    };

/**
 * Twitter-style "send": share a post's link. Native share sheet where available (mobile), else copy
 * to the clipboard + toast. `href` is the locale-agnostic in-app detail path (e.g. /community/message/ID);
 * the absolute URL is built with the current locale (tr has no prefix — routing is `as-needed`).
 *
 * `publicUrl` overrides it with the anonymous, indexable page (QA questions) so a recipient without
 * an account can open the link. Callers pass it ONLY when the question is actually indexable —
 * ForumPublicService requires ≥1 non-deleted answer, so an answerless question would 404.
 */
export function SendButton({ href, publicUrl }: { href: ShareHref; publicUrl?: string }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const toast = useMentorToast();

  const share = async () => {
    const path = getPathname({ locale: locale as Locale, href });
    const url = publicUrl ?? `${window.location.origin}${path}`;
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
      className="community-post-action group/send flex size-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ color: "var(--color-main)" }}
    >
      <span className="inline-flex">
        <SendIcon />
      </span>
    </button>
  );
}
