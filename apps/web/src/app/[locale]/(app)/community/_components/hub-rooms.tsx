"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { joinZone } from "@/lib/forum";
import { useMentorToast } from "@/lib/mentor-toast";
import { useZoneMeta } from "./zone-mini-card";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { COMMUNITY_ROW_LIST } from "./community-row";
import { ZONES_CHANGED_EVENT } from "./zone-sidebar";
import { ZoneTypeIcon } from "./zone-type-icon";

/**
 * Rooms the viewer has not joined yet. Joining is a text action per row (the page's one ledge is
 * the hero's); a joined room leaves the list and the sidebar regroups.
 */
export function HubRooms({ zones }: { zones: ZoneView[] }) {
  const t = useTranslations("community");
  const toast = useMentorToast();
  const zoneMeta = useZoneMeta();
  const [hidden, setHidden] = useState<string[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const visible = zones.filter((zone) => !hidden.includes(zone.id));

  if (visible.length === 0) return null;

  const join = (zoneId: string) => {
    setJoining(zoneId);
    joinZone(zoneId)
      .then(() => {
        setHidden((current) => [...current, zoneId]);
        window.dispatchEvent(new Event(ZONES_CHANGED_EVENT));
      })
      .catch((error: unknown) =>
        toast.error({ title: error instanceof ApiClientError ? error.body.message : t("error") }),
      )
      .finally(() => setJoining(null));
  };

  const meta = (zone: ZoneView) =>
    zone.memberCount > 0 ? zoneMeta(zone) : (zone.description ?? "");

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="hub-rooms-title">
      <h2 id="hub-rooms-title" className={PANEL_CARD_TITLE}>
        {t("hub_rooms")}
      </h2>
      <div className={COMMUNITY_ROW_LIST}>
        {visible.map((zone) => (
          <div key={zone.id} className="flex items-center gap-3 py-3">
            <Link
              href={{ pathname: "/community/[slug]", params: { slug: zone.slug } }}
              className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <span className="grid size-10 shrink-0 place-items-center text-[var(--color-secondary)]" aria-hidden>
                <ZoneTypeIcon type={zone.type} size={20} strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-body-sm font-extrabold text-[var(--color-main)]">{zone.title}</span>
                <span className="truncate text-caption font-semibold text-[var(--color-secondary)]">{meta(zone)}</span>
              </span>
            </Link>
            <button
              type="button"
              disabled={joining === zone.id}
              onClick={() => join(zone.id)}
              aria-label={`${t("join")}: ${zone.title}`}
              className={`${PANEL_TEXT_LINK} shrink-0 cursor-pointer px-1 disabled:cursor-wait disabled:opacity-60`}
            >
              {joining === zone.id ? t("joining") : t("join")}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
