"use client";
import {
  HelpCircle,
  Languages,
  MessageSquare,
  Moon,
  Share2,
  Sun,
} from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Card } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { getProfileLinks } from "@/lib/profile-links";
import { useMentorToast } from "@/lib/mentor-toast";
import { useTheme } from "@/lib/use-theme";
import { ListRow } from "./account-links-card";

const LOCALES = ["tr", "en"] as const;

export function ApplicationSupportCard() {
  const t = useTranslations("profile.support");
  const locale = useLocale();
  const router = useRouter();
  const toast = useMentorToast();
  const [isPending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  const links = getProfileLinks();

  function switchLocale(next: (typeof LOCALES)[number]) {
    startTransition(() => {
      router.replace("/settings", { locale: next });
    });
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: t("share_title"),
          text: t("share_text"),
          url: links.shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(links.shareUrl);
        toast.success({
          title: t("share_copied_title"),
          message: t("share_copied_message"),
          duration: 3000,
        });
      } else {
        throw new Error("clipboard unavailable");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error({
        title: t("share_error_title"),
        message: t("share_error_message"),
        duration: 3000,
      });
    }
  }

  return (
    <Card solid className="p-2 sm:p-2.5">
      <div className="px-2 pt-1 pb-1.5">
        <h2
          className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("title")}
        </h2>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-[calc(var(--radius-card)-2px)] px-3 py-1.5 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)]">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center text-[var(--color-secondary)]">
              <Languages size={18} aria-hidden />
            </span>
            <span
              className="truncate text-sm font-medium text-[var(--color-main)]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {t("language")}
            </span>
          </span>
          <span className="flex shrink-0 gap-1" aria-label={t("language_aria")}>
            {LOCALES.map((item) => (
              <button
                key={item}
                type="button"
                disabled={isPending}
                aria-pressed={locale === item}
                onClick={() => switchLocale(item)}
                className="min-h-8 rounded-lg px-2.5 text-xs font-semibold transition hover:bg-[color-mix(in_srgb,var(--color-main)_3%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
                style={{
                  color:
                    locale === item
                      ? "var(--color-main)"
                      : "var(--color-secondary)",
                  backgroundColor:
                    locale === item
                      ? "color-mix(in srgb, var(--color-progress-track) 45%, var(--color-surface))"
                      : "transparent",
                }}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </span>
        </div>
        <div className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-[calc(var(--radius-card)-2px)] px-3 py-1.5 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)]">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center text-[var(--color-secondary)]">
              {theme === "dark" ? (
                <Moon size={18} aria-hidden />
              ) : (
                <Sun size={18} aria-hidden />
              )}
            </span>
            <span
              className="truncate text-sm font-medium text-[var(--color-main)]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {t("theme")}
            </span>
          </span>
          <span className="flex shrink-0 gap-1" aria-label={t("theme_aria")}>
            {(["light", "dark"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={theme === item}
                onClick={() => setTheme(item)}
                className="min-h-8 rounded-lg px-2.5 text-xs font-semibold transition hover:bg-[color-mix(in_srgb,var(--color-main)_3%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{
                  color:
                    theme === item
                      ? "var(--color-main)"
                      : "var(--color-secondary)",
                  backgroundColor:
                    theme === item
                      ? "color-mix(in srgb, var(--color-progress-track) 45%, var(--color-surface))"
                      : "transparent",
                }}
              >
                {t(item === "light" ? "theme_light" : "theme_dark")}
              </button>
            ))}
          </span>
        </div>

        <ListRow
          icon={<Share2 size={18} aria-hidden />}
          onClick={() => void handleShare()}
          showChevron={false}
        >
          {t("recommend")}
        </ListRow>
        <ListRow href="/knowledge" icon={<HelpCircle size={18} aria-hidden />}>
          {t("help")}
        </ListRow>
        {links.feedbackUrl ? (
          <ListRow
            externalHref={links.feedbackUrl}
            icon={<MessageSquare size={18} aria-hidden />}
          >
            {t("feedback")}
          </ListRow>
        ) : null}
      </div>
    </Card>
  );
}
