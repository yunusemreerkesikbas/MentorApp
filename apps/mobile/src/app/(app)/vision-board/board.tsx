import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchVision } from "../../../lib/coaching-api.js";
import { BoardEditor } from "../../../components/vision-board/board-editor.js";
import { VisionScreen } from "../../../components/vision-board/screen.js";
import { AppText, Button, Skeleton } from "../../../components/ui/index.js";
import { useTranslations } from "../../../providers/i18n-provider.js";

export default function VisionCollage() {
  const t = useTranslations("visionBoard");
  const router = useRouter();
  const query = useQuery({ queryKey: ["coaching", "vision"], queryFn: fetchVision });
  return <VisionScreen title={t("editor")}>
    {query.isPending ? <Skeleton height={120} /> : query.isError && query.data === undefined ? <Button label={t("retry")} onPress={() => void query.refetch()} /> :
      query.data ? <BoardEditor vision={query.data} /> : <>
        <AppText>{t("noGoal")}</AppText>
        <Button label={t("goal")} onPress={() => router.replace("/(app)/vision-board")} />
      </>}
  </VisionScreen>;
}
