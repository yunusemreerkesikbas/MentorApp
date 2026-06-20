"use client";

import { useTranslations } from "next-intl";
import type { QuestProgressView } from "@mentor/types";
import { Card, Chip, SectionHeading } from "@mentor/ui";

interface EconomyQuestsCardProps {
  quests: QuestProgressView[];
}

/**
 * Onboarding quests — titles and completion from backend; no FE reward logic.
 */
export function EconomyQuestsCard({ quests }: EconomyQuestsCardProps) {
  const translate = useTranslations("economy");
  return (
    <Card>
      <SectionHeading subtitle={translate("quests_subtitle")}>
        {translate("quests_title")}
      </SectionHeading>
      <ul className="mt-4 flex flex-col gap-2">
        {quests.map((quest) => (
          <li
            key={quest.id}
            className="flex min-h-[52px] items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-2"
            style={{ backgroundColor: "var(--color-surface-muted, rgba(0,0,0,0.03))" }}
          >
            <span className="text-base" style={{ color: "var(--color-main)" }}>
              {quest.title}
            </span>
            <Chip>
              {quest.completed
                ? translate("quest_completed")
                : translate("quest_in_progress")}
            </Chip>
          </li>
        ))}
      </ul>
    </Card>
  );
}
