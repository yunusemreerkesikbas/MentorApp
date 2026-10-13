import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { PANEL_CARD, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { ZoneTypeIcon } from "./zone-type-icon";

/** A room's one meta line, everywhere it is shown: "N üye · M mesaj" (no messages, no second half). */
export function useZoneMeta() {
  const t = useTranslations("community");
  return (zone: Pick<ZoneView, "memberCount" | "threadCount">) =>
    [
      t("members", { count: zone.memberCount }),
      zone.threadCount > 0 ? t("messages_count", { count: zone.threadCount }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
}

/** A detail page's rail card for the room it lives in: glyph, name, "N üye · M mesaj", "Odaya git". */
export function ZoneMiniCard({ zone }: { zone: ZoneView }) {
  const t = useTranslations("community");
  const meta = useZoneMeta()(zone);

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="zone-mini-title">
      <div className="flex items-center gap-3">
        <ZoneTypeIcon
          type={zone.type}
          size={24}
          strokeWidth={1.75}
          className="shrink-0 text-[var(--color-main)]"
          aria-hidden
        />
        <span className="flex min-w-0 flex-col">
          <span id="zone-mini-title" className="truncate text-body-sm font-extrabold text-[var(--color-main)]">
            {zone.title}
          </span>
          <span className="text-caption font-semibold tabular-nums text-[var(--color-secondary)]">{meta}</span>
        </span>
      </div>
      <Link
        href={{ pathname: "/community/[slug]", params: { slug: zone.slug } }}
        className={`${PANEL_TEXT_LINK} self-start`}
      >
        {t("zone_go")}
        <ChevronRight size={16} aria-hidden />
      </Link>
    </section>
  );
}
