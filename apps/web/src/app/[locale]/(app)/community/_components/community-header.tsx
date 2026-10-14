"use client";
import { Menu } from "lucide-react";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { CircularBackLink } from "@/components/circular-back-link";
import { CommunitySearch } from "./community-search";
import { useZoneDrawer } from "./zone-drawer-context";

/** Title + search. Close and the rooms drawer show only on phones (CSS); the app rail covers desktop. */
export function CommunityHeader() {
  const t = useTranslations("community");
  const common = useTranslations("common");
  const pathname = usePathname();
  const { open, openDrawer, triggerRef } = useZoneDrawer();
  const isMemberProfile = pathname.startsWith("/community/member/");

  return (
    <header className="community-header">
      <CircularBackLink
        href={isMemberProfile ? "/community" : "/dashboard"}
        label={isMemberProfile ? t("back") : common("dialog.close")}
        icon={isMemberProfile ? "chevron" : "close"}
        className="community-header__close"
      />
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("drawer_open")}
        aria-controls="community-zone-drawer"
        aria-expanded={open}
        onClick={openDrawer}
        className="community-header__menu"
      >
        <Menu size={22} strokeWidth={1.75} aria-hidden />
      </button>
      <p className="community-header__title">{t("sidebar_title")}</p>
      <CommunitySearch />
    </header>
  );
}
