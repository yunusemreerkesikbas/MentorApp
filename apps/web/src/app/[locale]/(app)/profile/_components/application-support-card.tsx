"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { MoonIcon } from "@solar-icons/react/linear/moon";
import { SunIcon } from "@solar-icons/react/linear/sun";
import { Card, SlidingTabs } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { getProfileLinks } from "@/lib/profile-links";
import { useMentorToast } from "@/lib/mentor-toast";
import { useTheme } from "@/lib/use-theme";
import { ListRow } from "./account-links-card";

const LOCALES = ["tr", "en"] as const;
const THEMES = [
  { id: "light", Icon: SunIcon },
  { id: "dark", Icon: MoonIcon },
] as const;

export function ApplicationSupportCard() {
  const t = useTranslations("profile.support");
  const tLegal = useTranslations("legal");
  const locale = useLocale();
  const router = useRouter();
  const toast = useMentorToast();
  const [isPending, startTransition] = useTransition();
  // The pill slides on the tap; the locale itself lands with the route change.
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const links = getProfileLinks();

  function switchLocale(next: (typeof LOCALES)[number]) {
    if (isPending || next === locale) return;
    setPendingLocale(next);
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
        <SettingRow label={t("language")}>
          <SlidingTabs
            ariaLabel={t("language_aria")}
            items={LOCALES.map((item) => ({ id: item, label: item.toUpperCase() }))}
            value={pendingLocale ?? locale}
            onChange={(next) => switchLocale(next as (typeof LOCALES)[number])}
            className="shrink-0"
          />
        </SettingRow>
        <SettingRow label={t("theme")}>
          <SlidingTabs
            ariaLabel={t("theme_aria")}
            items={THEMES.map(({ id, Icon }) => ({
              id,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  {/* Icon-only on phones so the row label is not truncated; the name stays for SR. */}
                  <span className="max-sm:sr-only">
                    {t(id === "light" ? "theme_light" : "theme_dark")}
                  </span>
                </span>
              ),
            }))}
            value={theme}
            onChange={(next) => setTheme(next as (typeof THEMES)[number]["id"])}
            className="shrink-0"
          />
        </SettingRow>
        {/* A preference, not a legal text: it moved here from the settings footer. */}
        <ListRow href="/settings/cookie-preferences">
          {tLegal("footer_cookie")}
        </ListRow>

        <ListRow
          onClick={() => void handleShare()}
          showChevron={false}
        >
          {t("recommend")}
        </ListRow>
        <ListRow href="/knowledge">
          {t("help")}
        </ListRow>
        {links.feedbackUrl ? (
          <ListRow
            externalHref={links.feedbackUrl}
          >
            {t("feedback")}
          </ListRow>
        ) : null}
      </div>
    </Card>
  );
}

/** A settings row whose control sits on the right (label + segmented control). */
function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 px-3 py-1.5">
      <span
        className="truncate text-md font-medium leading-5 text-[var(--color-main)]"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
