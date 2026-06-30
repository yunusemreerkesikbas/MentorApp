"use client";

import { useTranslations } from "next-intl";
import type { ThreadView, ZoneView } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { JoinButton } from "./join-button";
import { ZONE_TYPE_ICONS } from "../../_components/zone-icons";

export function RightPanel({ zone, pinned }: { zone: ZoneView; pinned: ThreadView[] }) {
  const t = useTranslations("topluluk");

  return (
    <div className="flex flex-col gap-3">
      {/* Zone info card */}
      <div
        className="overflow-hidden rounded-xl bg-white"
        style={{ boxShadow: "0px 1px 4px rgba(37,73,150,0.08)" }}
      >
        {/* Decorative header band */}
        <div
          className="flex items-center justify-center py-5"
          style={{
            background: "color-mix(in srgb, var(--color-chip) 14%, white)",
          }}
        >
          <span className="text-4xl leading-none" role="img" aria-label={zone.title}>
            {zone.emoji ?? ZONE_TYPE_ICONS[zone.type]}
          </span>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div>
            <p
              className="text-sm font-bold leading-snug"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {zone.title}
            </p>
            {zone.description && (
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-secondary)" }}>
                {zone.description}
              </p>
            )}
          </div>

          {/* Member count */}
          <div className="flex items-center gap-1.5">
            {/* users icon */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ color: "var(--color-secondary)" }}
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {t("members", { count: zone.memberCount })}
            </span>
          </div>

          <JoinButton zoneId={zone.id} myStatus={zone.myStatus} onJoined={() => {}} />
        </div>
      </div>

      {/* Pinned threads */}
      {pinned.length > 0 && (
        <div
          className="rounded-xl bg-white p-4"
          style={{ boxShadow: "0px 1px 4px rgba(37,73,150,0.08)" }}
        >
          <p
            className="mb-3 text-[10px] font-semibold uppercase"
            style={{ color: "var(--color-secondary)", letterSpacing: "0.06em" }}
          >
            {t("pinned_posts")}
          </p>
          <div className="flex flex-col divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            {pinned.map((th) => (
              <Link
                key={th.id}
                href={zone.type === "QA" ? `/topluluk/soru/${th.id}` : `/topluluk/${zone.slug}`}
                className="block py-2.5 text-xs leading-snug transition-colors first:pt-0 last:pb-0 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: "var(--color-body)" }}
              >
                <span className="line-clamp-2">{th.title ?? th.body}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
