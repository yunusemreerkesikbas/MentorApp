"use client";

import { useTranslations } from "next-intl";
import { Card } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";

export function AnalysisGhostTeaser() {
  const t = useTranslations("analysis");

  return (
    <Card>
      <EmptyState
        title={t("ghost_teaser_title")}
        description={t("ghost_teaser_desc")}
      />
    </Card>
  );
}
