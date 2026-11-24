import { useQuery } from "@tanstack/react-query";
import { fetchVision } from "../../../lib/coaching-api.js";
import { GoalForm } from "../../../components/vision-board/goal-form.js";
import { VisionScreen } from "../../../components/vision-board/screen.js";
import { Button, Skeleton } from "../../../components/ui/index.js";
import { useTranslations } from "../../../providers/i18n-provider.js";

export default function VisionHome() {
  const t = useTranslations("visionBoard");
  const query = useQuery({ queryKey: ["coaching", "vision"], queryFn: fetchVision });
  return <VisionScreen title={t("home")}>
    {query.isPending ? <Skeleton height={120} /> : query.isError && query.data === undefined ?
      <Button label={t("retry")} onPress={() => void query.refetch()} /> : <GoalForm vision={query.data ?? null} />}
  </VisionScreen>;
}
