import { Pressable } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ApiClientError } from "@mentor/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CAREER_GROUPS, type VisionDto } from "@mentor/types";
import { AppText, Button, Chip, TextField } from "../ui/index.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { goalFields } from "../../lib/vision-board-view.js";
import { upsertVision } from "../../lib/coaching-api.js";
import { searchGoalTargets } from "../../lib/vision-board-api.js";
import { GoalMap } from "./goal-map.js";
import { BoardStage } from "./board-stage.js";
import { Wrap } from "./screen.js";

export function GoalForm({ vision }: { vision: VisionDto | null }) {
  const t = useTranslations("visionBoard");
  const { space, palette, touchTargets, radii } = useThemeTokens();
  const router = useRouter();
  const client = useQueryClient();
  const { user, setUserFromServer } = useAuth();
  const [draft, setDraft] = useState(() => goalFields(vision));
  const [target, setTarget] = useState(() => [vision?.targetNames.cityName ?? vision?.targetCity,
    vision?.targetNames.universityName, vision?.targetNames.titleName, vision?.targetNames.institutionName].filter(Boolean).join(" · "));
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const results = useQuery({ queryKey: ["vision", "target-search", user?.examType, query],
    queryFn: () => searchGoalTargets(query, user!.examType!), enabled: !!user?.examType && query.length >= 2 });
  const save = useMutation({ mutationFn: upsertVision, onSuccess: saved => {
    client.setQueryData(["coaching", "vision"], saved);
    if (user) setUserFromServer({ ...user, careerGroup: saved.careerGroup });
  } });
  const rows = results.data;
  const options = [
    ...(rows?.cities ?? []).map(c => ({ label: c.name, patch: { targetCityCode: c.code, targetCity: null, targetUniversityId: null } })),
    ...(rows?.universities ?? []).map(u => ({ label: u.name, patch: { targetCityCode: u.cityCode, targetCity: null, targetUniversityId: u.id } })),
    ...(rows?.titles ?? []).map(x => ({ label: x.name, patch: { targetTitleId: x.id, targetInstitutionId: null } })),
    ...(rows?.institutions ?? []).map(x => ({ label: x.name, patch: { targetInstitutionId: x.id } })),
  ];
  return <>
    {vision?.board && <BoardStage doc={vision.board} />}
    <TextField label={t("goal")} value={draft.goalTitle} maxLength={120}
      onChangeText={goalTitle => setDraft({ ...draft, goalTitle })} />
    <GoalMap selected={draft.targetCityCode ?? null} onCity={city => {
      setTarget(city.name); setSearch("");
      setDraft({ ...draft, targetCity: null, targetCityCode: city.code, targetUniversityId: null });
    }} />
    {target && <AppText>{target}</AppText>}
    <TextField label={t("searchTarget")} value={search} maxLength={80} onChangeText={setSearch} />
    {query.length >= 2 && search.trim() === query && <Wrap>
      {results.isError ? <Chip label={t("retry")} onPress={() => void results.refetch()} /> :
        results.isFetching ? <AppText>{t("loading")}</AppText> : !options.length && <AppText>{t("noResults")}</AppText>}
      {options.map((o, i) => <Pressable key={i} accessibilityRole="button" style={{ padding: space.md, minHeight: touchTargets.min, borderRadius: radii.inner, backgroundColor: palette.surfaceAlt }} onPress={() => {
        setDraft({ ...draft, ...o.patch }); setTarget(o.label); setSearch("");
      }}><AppText>{o.label}</AppText></Pressable>)}
    </Wrap>}
    {target && <Chip label={t("clearTarget")} onPress={() => {
      setTarget(""); setSearch(""); setDraft({ ...draft, targetUniversityId: null, targetCityCode: null,
        targetCity: null, targetTitleId: null, targetInstitutionId: null });
    }} />}
    <AppText variant="cardTitle">{t("career")}</AppText>
    <Wrap>{[null, ...CAREER_GROUPS].map(group => <Chip key={group ?? "none"} label={group ? t(`career_${group}`) : t("none")}
      selected={draft.careerGroup === group} onPress={() => setDraft({ ...draft, careerGroup: group })} />)}</Wrap>
    {save.isError && <AppText tone="danger">{save.error instanceof ApiClientError ? save.error.body.message : t("failure")}</AppText>}
    {save.isSuccess && <AppText accessibilityLiveRegion="polite">{t("saved")}</AppText>}
    <Button label={t("save")} disabled={!draft.goalTitle.trim()} loading={save.isPending}
      onPress={() => save.mutate({ ...draft, goalTitle: draft.goalTitle.trim() })} />
    {vision && <Button label={t("editor")} variant="secondary" onPress={() => router.push("/(app)/vision-board/board")} />}
  </>;
}
