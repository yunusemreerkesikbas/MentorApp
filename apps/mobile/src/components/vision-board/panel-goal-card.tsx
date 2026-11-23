import { isPremiumFeatureAvailable } from "@mentor/core";
import { useSubscriptionView } from "../../lib/premium.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import type { VisionDto } from "@mentor/types";
import { PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { AppText, Button } from "../ui/index.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { BoardStage } from "./board-stage.js";

export function GoalCard({ vision, onOpenGoal, onOpenBoard, onOpenDesk }: {
  vision: VisionDto | null; onOpenGoal: () => void; onOpenBoard: () => void; onOpenDesk: () => void;
}) {
  const t = useTranslations("visionBoard");
  const subscription = useSubscriptionView();
  const { availability } = useAppAvailability();
  const noteEnabled = availability.aiCoach && isPremiumFeatureAvailable(subscription, "vision.note");
  const panel = useTranslations("panel");
  const { space } = useThemeTokens();
  return <>
    <PanelCard style={{ gap: space.md }}>
      <PanelCardTitle>{t("home")}</PanelCardTitle>
      {vision?.board?.status === "PUBLISHED" && <BoardStage doc={vision.board} />}
      <AppText>{vision?.goalTitle || panel("goal_empty")}</AppText>
      {noteEnabled && vision?.aiNote && <AppText tone="secondary">{vision.aiNote}</AppText>}
      <Button label={vision ? panel("goal_edit") : panel("goal_set_cta")} variant="secondary" onPress={onOpenGoal} />
      {vision && <Button label={t("reopen")} onPress={onOpenBoard} />}
    </PanelCard>
    <Button label={t("desk")} variant="secondary" onPress={onOpenDesk} />
  </>;
}
