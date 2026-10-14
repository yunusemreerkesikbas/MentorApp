"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { FormError } from "@/components/form";
import { PANEL_CARD, PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { useRouter } from "@/i18n/navigation";
import { getZone, isForumDisabled } from "@/lib/forum";
import { DetailCrumb } from "../../../_components/detail-crumb";
import { ZoneMiniCard } from "../../../_components/zone-mini-card";
import { MembersCard } from "./members-card";
import { ReportsCard } from "./reports-card";

type State =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string }
  | { status: "ready"; zone: ZoneView };

/**
 * A room's management on the panel frame: where it sits (Topluluk › room › Yönetim), the members
 * card and the report queue; the rail shows the room. Only its moderators get here; anyone else is
 * sent back to the room.
 */
export function ManageShell({ slug }: { slug: string }) {
  const t = useTranslations("community");
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getZone(slug)
      .then((zone) => {
        if (!active) return;
        if (!zone.canModerate) {
          setState({ status: "denied" });
          router.replace({ pathname: "/community/[slug]", params: { slug } });
          return;
        }
        setState({ status: "ready", zone });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) return setState({ status: "denied" });
        setState({ status: "error", message: err instanceof ApiClientError ? err.body.message : t("error") });
      });
    return () => {
      active = false;
    };
  }, [slug, router, t]);

  if (state.status === "denied" || state.status === "error") {
    return (
      <main className={PANEL_MAIN_CLASS}>
        {state.status === "error" ? (
          <FormError message={state.message} />
        ) : (
          <p className={`${PANEL_CARD} text-body-sm font-semibold text-[var(--color-secondary)]`}>{t("not_authorized")}</p>
        )}
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className={PANEL_MAIN_CLASS}>
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-5">
          <Skeleton className="h-4 w-56 rounded-full" />
          <Skeleton className="h-9 w-64 max-w-full rounded-full" />
          <div className={PANEL_GRID_CLASS}>
            <div className="flex min-w-0 flex-col gap-5">
              <Skeleton className="h-56 w-full rounded-[var(--radius-card)]" />
              <Skeleton className="h-56 w-full rounded-[var(--radius-card)]" />
            </div>
            <Skeleton className="hidden h-32 rounded-[var(--radius-card)] xl:block" />
          </div>
        </SkeletonGroup>
      </main>
    );
  }

  const { zone } = state;
  return (
    <main className={PANEL_MAIN_CLASS}>
      <DetailCrumb
        items={[
          { label: t("title"), href: "/community" },
          { label: zone.title, href: { pathname: "/community/[slug]", params: { slug } } },
          { label: t("manage_link") },
        ]}
      />
      <h1 className="-mt-2 text-2xl font-extrabold tracking-[-0.01em] text-[var(--color-main)] sm:text-display">
        {t("manage_title")}
      </h1>
      <div className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <MembersCard zoneId={zone.id} />
          <ReportsCard zoneId={zone.id} />
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label={t("zone_context_title")}>
          <ZoneMiniCard zone={zone} />
        </aside>
      </div>
    </main>
  );
}
