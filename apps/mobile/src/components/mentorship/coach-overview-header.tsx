import { StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  MentorshipCoachOverviewDto,
  MentorshipCoachRegistrationStateDto,
  MentorshipCohortBriefDto,
} from "@mentor/types";
import {
  generateCohortBrief,
  rotateInviteCode,
} from "../../lib/mentorship-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip } from "../ui/index.js";

export interface CoachOverviewHeaderProps {
  overview: MentorshipCoachOverviewDto | null;
  registrationState: MentorshipCoachRegistrationStateDto | null;
  cohortBrief: MentorshipCohortBriefDto | null;
}

export function CoachOverviewHeader({
  overview,
  registrationState,
  cohortBrief,
}: CoachOverviewHeaderProps) {
  const t = useTranslations("students");
  const { palette, radii, space } = useThemeTokens();
  const queryClient = useQueryClient();

  const rotateMutation = useMutation({
    mutationFn: rotateInviteCode,
    onSuccess: () => {
      void haptics.success();
      void queryClient.invalidateQueries({ queryKey: ["mentorship-overview"] });
    },
  });

  const briefMutation = useMutation({
    mutationFn: generateCohortBrief,
    onSuccess: () => {
      void haptics.selection();
      void queryClient.invalidateQueries({
        queryKey: ["mentorship-cohort-brief"],
      });
    },
  });

  const blockedReason = registrationState?.inviteBlockedReason ?? null;

  return (
    <View style={{ gap: space.sm }}>
      {overview ? (
        <Card style={{ gap: space.sm }}>
          <AppText variant="caption" tone="coach">
            {t("seat_usage", {
              used: overview.usedSeats,
              allowance: overview.seatAllowance,
              active: overview.activeStudents,
              max: overview.maxActiveStudents,
            })}
          </AppText>

          {blockedReason ? (
            <AppText variant="body" tone="warning">
              {t(
                `invite_blocked_${blockedReason}` as "invite_blocked_EMAIL_UNVERIFIED",
              )}
            </AppText>
          ) : (
            <View style={styles.rowBetween}>
              <View style={{ gap: 2 }}>
                <AppText variant="caption" tone="secondary">
                  {t("invite_code_label")}
                </AppText>
                <AppText variant="title" tone="coach">
                  {overview.inviteCode?.code ?? "—"}
                </AppText>
              </View>
              <Chip
                label={t("rotate_invite_cta")}
                onPress={() => rotateMutation.mutate()}
              />
            </View>
          )}
        </Card>
      ) : null}

      <Card style={{ gap: space.sm }}>
        <AppText variant="sectionHeading">{t("cohort_brief_title")}</AppText>
        {cohortBrief ? (
          <View style={{ gap: space.xs }}>
            <AppText variant="body">{cohortBrief.overall}</AppText>
            {cohortBrief.items.map((item) => (
              <View
                key={item.studentId}
                style={{
                  padding: space.sm,
                  borderRadius: radii.card,
                  borderWidth: 1,
                  backgroundColor: palette.surfaceAlt,
                  borderColor: palette.border,
                  gap: 2,
                }}
              >
                <AppText variant="cardTitle">{item.studentDisplayName}</AppText>
                <AppText variant="caption" tone="secondary">
                  {item.why}
                </AppText>
                <AppText variant="caption" tone="coach">
                  {item.action}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        <Button
          label={t("generate_cohort_brief_cta")}
          variant="secondary"
          loading={briefMutation.isPending}
          onPress={() => briefMutation.mutate()}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
});
