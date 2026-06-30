"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { listZones } from "@/lib/forum";
import { ZONE_TYPE_ICONS } from "./zone-icons";

const GROUPS = [
  { type: "ANNOUNCEMENT", key: "group_announcement" },
  { type: "CHAT", key: "group_chat" },
  { type: "QA", key: "group_qa" },
] as const;

export function ZoneSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("topluluk");
  const pathname = usePathname();
  const [zones, setZones] = useState<ZoneView[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listZones()
      .then((res) => setZones(res.items))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="px-3">
        <p className="px-3 text-xs" style={{ color: "var(--color-secondary)" }}>
          {t("error")}
        </p>
        <Link
          href="/topluluk"
          onClick={onNavigate}
          className="mt-2 block px-3 text-xs underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-cta)" }}
        >
          {t("refresh")}
        </Link>
      </div>
    );
  }

  if (zones === null) {
    return (
      <div className="px-3">
        <SkeletonGroup label={t("loading")}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-9 w-full rounded-lg" />
          ))}
        </SkeletonGroup>
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-5 px-2">
      {/* Back to index */}
      <Link
        href="/topluluk"
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
      >
        {t("sidebar_title")}
      </Link>

      {GROUPS.map(({ type, key }) => {
        const group = zones.filter((z) => z.type === type);
        if (group.length === 0) return null;
        return (
          <div key={type} className="flex flex-col gap-0.5">
            {/* Section label — small, quiet, not tracked */}
            <p
              className="mb-1 px-3 text-[10px] font-semibold uppercase"
              style={{ color: "var(--color-secondary)", letterSpacing: "0.06em" }}
            >
              {t(key)}
            </p>
            {group.map((z) => {
              const isActive =
                pathname.includes(`/topluluk/${z.slug}/`) ||
                pathname.endsWith(`/topluluk/${z.slug}`);
              return (
                <Link
                  key={z.id}
                  href={`/topluluk/${z.slug}`}
                  onClick={onNavigate}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  style={{
                    color: isActive ? "var(--color-main)" : "#444",
                    background: isActive
                      ? "color-mix(in srgb, var(--color-chip) 18%, white)"
                      : undefined,
                    fontWeight: isActive ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "";
                  }}
                >
                  <span className="text-base leading-none opacity-80">{z.emoji ?? ZONE_TYPE_ICONS[z.type]}</span>
                  <span className="min-w-0 flex-1 truncate">{z.title}</span>
                  {z.myStatus === "ACTIVE" && (
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: "var(--color-progress)" }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
