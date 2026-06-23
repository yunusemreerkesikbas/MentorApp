"use client";

import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { Card, Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";

/** A single zone in the Topluluk index — links into the zone (feed or Q&A). */
export function ZoneCard({ zone }: { zone: ZoneView }) {
  const t = useTranslations("topluluk");
  return (
    <Link
      href={`/topluluk/${zone.slug}`}
      className="block rounded-[var(--radius-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
    >
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {zone.title}
          </h3>
          <Chip>{t(`type_${zone.type.toLowerCase()}` as `type_${string}`)}</Chip>
        </div>
        {zone.description ? (
          <p className="mt-2 line-clamp-2 text-sm" style={{ color: "var(--color-secondary)" }}>
            {zone.description}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-3 text-sm" style={{ color: "var(--color-secondary)" }}>
          <span>{t("members", { count: zone.memberCount })}</span>
          {zone.myStatus === "ACTIVE" ? (
            <span style={{ color: "var(--color-progress)" }}>· {t("joined")}</span>
          ) : zone.myStatus === "PENDING" ? (
            <span>· {t("join_pending")}</span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
