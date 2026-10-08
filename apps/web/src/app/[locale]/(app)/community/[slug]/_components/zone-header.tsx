"use client";

import { useState } from "react";
import { MoreHorizontal, Settings, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ForumPublicPerson, ZoneMemberStatus, ZoneView } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { AuthorAvatar } from "../../_components/author-avatar";
import { COMMUNITY_CARD_FLUSH } from "../../_components/community-row";
import { ZoneTypeIcon } from "../../_components/zone-type-icon";
import { useZoneMeta } from "../../_components/zone-mini-card";
import { useZoneMembership, ZoneJoinLedge } from "./join-button";

export type ZoneTab = "recent" | "popular" | "about";

/** The region the room tabs switch (rendered by the shell, labelled by the selected tab). */
export const ZONE_TABPANEL_ID = "zone-tabpanel";

const ICON_BUTTON =
  "grid size-11 shrink-0 place-items-center rounded-[var(--radius-card)] text-[var(--color-secondary)] hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * The room's header card: its glyph (no stock artwork, no coloured well), name, description, the
 * people in it, and the tabs. A visitor gets the one ledge ("Odaya katıl"); a member's leave lives
 * in the room menu.
 */
export function ZoneHeader({
  zone,
  people,
  tab,
  onTab,
  onJoined,
  onLeft,
}: {
  zone: ZoneView;
  people: ForumPublicPerson[];
  tab: ZoneTab;
  onTab: (tab: ZoneTab) => void;
  onJoined: (status: ZoneMemberStatus) => void;
  onLeft: () => void;
}) {
  const t = useTranslations("community");
  const [shareCopied, setShareCopied] = useState(false);
  const membership = useZoneMembership({
    zoneId: zone.id,
    myRole: zone.myRole,
    joinPolicy: zone.joinPolicy,
    onJoined,
    onLeft,
  });
  const member = zone.myStatus === "ACTIVE";
  const pending = zone.myStatus === "PENDING";
  const tabs: Array<{ id: ZoneTab; label: string }> = [
    { id: "recent", label: t("sort_recent") },
    { id: "popular", label: t("sort_popular") },
    { id: "about", label: t("zone_tab_about") },
  ];
  const meta = useZoneMeta()(zone);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  };

  return (
    <section className={COMMUNITY_CARD_FLUSH} aria-labelledby="zone-title">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <ZoneTypeIcon
            type={zone.type}
            size={32}
            strokeWidth={1.75}
            className="mt-1 shrink-0 text-[var(--color-main)]"
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1 id="zone-title" className="text-2xl font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)] sm:text-display">
              {zone.title}
            </h1>
            {zone.description ? (
              <p className="text-body-sm font-semibold text-[var(--color-body)]">{zone.description}</p>
            ) : null}
            <div className="mt-1 flex items-center gap-2">
              {people.length > 0 ? (
                <span className="flex" aria-hidden>
                  {people.slice(0, 5).map((person, index) => (
                    <span key={person.id} className={`rounded-full ring-2 ring-[var(--color-surface)] ${index > 0 ? "-ml-2" : ""}`}>
                      <AuthorAvatar name={person.displayName} src={person.avatarUrl} size={24} />
                    </span>
                  ))}
                </span>
              ) : null}
              <span className="text-caption font-bold tabular-nums text-[var(--color-secondary)]">{meta}</span>
              {pending ? (
                <span className="text-caption font-extrabold text-[var(--color-secondary)]">· {t("join_pending")}</span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => void share()}
              aria-label={shareCopied ? t("share_copied") : t("zone_share")}
              title={shareCopied ? t("share_copied") : t("zone_share")}
              className={ICON_BUTTON}
            >
              <Share2 size={19} strokeWidth={1.75} aria-hidden />
            </button>
            {zone.canModerate ? (
              <Link
                href={{ pathname: "/community/[slug]/management", params: { slug: zone.slug } }}
                aria-label={t("manage_link")}
                title={t("manage_link")}
                className={ICON_BUTTON}
              >
                <Settings size={19} strokeWidth={1.75} aria-hidden />
              </Link>
            ) : null}
            {(member && membership.canLeave) || pending ? (
              <PopoverMenu
                align="right"
                menuClassName="w-52"
                trigger={({ open, setOpen, menuId }) => (
                  <button
                    type="button"
                    aria-label={t("zone_menu")}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-controls={open ? menuId : undefined}
                    onClick={() => setOpen(!open)}
                    className={ICON_BUTTON}
                  >
                    <MoreHorizontal size={20} aria-hidden />
                  </button>
                )}
              >
                <PopoverMenuItem danger={member} onClick={() => void membership.leave(member)}>
                  {member ? t("leave") : t("cancel_request")}
                </PopoverMenuItem>
              </PopoverMenu>
            ) : null}
          </div>
        </div>
        {!member && !pending ? (
          <ZoneJoinLedge busy={membership.busy} onJoin={() => void membership.join()} />
        ) : null}
      </div>
      <div
        className="flex gap-1 border-t border-[var(--color-border)] px-3"
        role="tablist"
        aria-label={zone.title}
        onKeyDown={(event) => {
          // The tab pattern's arrows: the selection follows focus, Home/End jump to the ends.
          const index = tabs.findIndex((entry) => entry.id === tab);
          const next =
            event.key === "ArrowRight" ? (index + 1) % tabs.length
            : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
            : event.key === "Home" ? 0
            : event.key === "End" ? tabs.length - 1
            : null;
          if (next === null) return;
          event.preventDefault();
          onTab(tabs[next]!.id);
          document.getElementById(`zone-tab-${tabs[next]!.id}`)?.focus();
        }}
      >
        {tabs.map((entry) => {
          const active = entry.id === tab;
          return (
            <button
              key={entry.id}
              id={`zone-tab-${entry.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={ZONE_TABPANEL_ID}
              tabIndex={active ? 0 : -1}
              onClick={() => onTab(entry.id)}
              className={`relative min-h-12 px-3 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] ${active ? "text-[var(--color-main)] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[var(--play-cta)]" : "text-[var(--color-secondary)]"}`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
