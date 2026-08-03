"use client";
import { HelpCircle, Languages, MessageSquare, Share2 } from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Card, SectionHeading } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { getProfileLinks } from "@/lib/profile-links";
import { useMentorToast } from "@/lib/mentor-toast";
import { ListRow } from "./account-links-card";

const LOCALES = ["tr", "en"] as const;

export function ApplicationSupportCard() {
  const t = useTranslations("profile.support");
  const locale = useLocale();
  const router = useRouter();
  const toast = useMentorToast();
  const [isPending, startTransition] = useTransition();
  const links = getProfileLinks();

  function switchLocale(next: (typeof LOCALES)[number]) {
    startTransition(() => {
      router.replace("/profile", { locale: next });
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
    <Card solid className="p-4">
      <SectionHeading>{t("title")}</SectionHeading>
      <div className="mt-3 divide-y divide-black/10 overflow-hidden rounded-[var(--radius-card)]">
        <div className="flex min-h-14 w-full min-w-0 items-center justify-between gap-2 bg-white px-3 py-1.5">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-card)] text-[var(--color-main)]">
              <Languages size={20} aria-hidden />
            </span>
            <span className="truncate text-base font-bold text-[var(--color-main)]">
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
                className="min-h-11 rounded-[var(--radius-card)] px-3 text-sm font-bold transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
                style={{
                  color:
                    locale === item
                      ? "var(--color-main)"
                      : "var(--color-secondary)",
                  backgroundColor:
                    locale === item
                      ? "color-mix(in srgb, var(--color-progress-track) 45%, white)"
                      : "transparent",
                }}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </span>
        </div>

        <ListRow
          icon={<Share2 size={20} aria-hidden />}
          onClick={() => void handleShare()}
          showChevron={false}
        >
          {t("recommend")}
        </ListRow>
        <ListRow href="/knowledge" icon={<HelpCircle size={20} aria-hidden />}>
          {t("help")}
        </ListRow>
        {links.feedbackUrl ? (
          <ListRow
            externalHref={links.feedbackUrl}
            icon={<MessageSquare size={20} aria-hidden />}
          >
            {t("feedback")}
          </ListRow>
        ) : null}
      </div>
    </Card>
  );
}
