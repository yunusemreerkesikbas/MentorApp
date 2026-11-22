import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import type { MentorshipCohortBriefDto } from "@mentor/types";
import { haptics } from "../../../lib/haptics.js";
import { generateCohortBrief } from "../../../lib/mentorship-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, Chip } from "../../ui/index.js";

export function CoachCohortBriefCard({
  cohortBrief,
  hasActiveStudents,
}: {
  cohortBrief: MentorshipCohortBriefDto | null;
  hasActiveStudents: boolean;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();

  const briefMutation = useMutation({
    mutationFn: generateCohortBrief,
    onSuccess: (next) => {
      void haptics.success();
      queryClient.setQueryData(["mentorship-cohort-brief"], next);
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  if (!hasActiveStudents && !cohortBrief) return null;

  return (
    <PanelCard style={{ gap: space.sm }}>
      <PanelCardTitle>{t("cohort_brief_title")}</PanelCardTitle>

      {cohortBrief ? (
        <View
          style={[
            styles.briefBox,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
              borderRadius: radii.inner,
            },
          ]}
        >
          <AppText variant="body">{cohortBrief.overall}</AppText>
          {cohortBrief.model === "cache" ? (
            <AppText variant="micro" tone="secondary">
              {t("brief_cache_note")}
            </AppText>
          ) : null}
          {cohortBrief.items.map((item) => (
            <Pressable
              key={item.studentId}
              accessibilityRole="button"
              onPress={() => {
                void haptics.selection();
                router.push({
                  pathname: "/(app)/coach-student" as never,
                  params: { studentId: item.studentId },
                });
              }}
              style={({ pressed }) => [
                styles.itemRow,
                {
                  backgroundColor: pressed ? palette.surfaceHover : palette.surface,
                  borderColor: palette.playLine,
                  borderRadius: radii.inner,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.itemTitleRow}>
                  <AppText variant="cardTitle">{item.studentDisplayName}</AppText>
                  {item.isNew ? <Chip label={t("cohort_item_new")} tone="warning" /> : null}
                </View>
                <AppText variant="caption" tone="secondary">
                  {item.why}
                </AppText>
                <AppText variant="caption" tone="coach">
                  {item.action}
                </AppText>
              </View>
              <AltArrowRightIcon size={18} color={palette.secondary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText variant="caption" tone="secondary">
          {t("cohort_brief_empty")}
        </AppText>
      )}

      {hasActiveStudents ? (
        <Button
          label={t("generate_cohort_brief_cta")}
          variant="secondary"
          loading={briefMutation.isPending}
          onPress={() => briefMutation.mutate()}
        />
      ) : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  briefBox: {
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  itemRow: {
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
});
