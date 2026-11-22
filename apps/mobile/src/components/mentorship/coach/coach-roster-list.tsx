import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import type { MentorshipRosterRowDto } from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { haptics } from "../../../lib/haptics.js";
import { setStudentAttention } from "../../../lib/mentorship-api.js";
import { buildCoachRoundBuckets, extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { AppText, Button, Card, Chip, Skeleton, SlidingTabs, StateView } from "../../ui/index.js";
import { CoachAvatar } from "../coach-identity-badges.js";

export type RosterFilterTab = "ACTIVE" | "ENDED";

export function CoachRosterList({
  tab,
  onTabChange,
  activeRows,
  endedRows,
  endedLoading,
  endedError,
  onRetryEnded,
}: {
  tab: RosterFilterTab;
  onTabChange: (tab: RosterFilterTab) => void;
  activeRows: MentorshipRosterRowDto[];
  endedRows: MentorshipRosterRowDto[];
  endedLoading: boolean;
  endedError: boolean;
  onRetryEnded: () => void;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();

  const attentionMutation = useMutation({
    mutationFn: ({ studentId, attended }: { studentId: string; attended: boolean }) =>
      setStudentAttention(studentId, attended),
    onSuccess: () => {
      void haptics.selection();
      void queryClient.invalidateQueries({ queryKey: ["mentorship-roster", "ACTIVE"] });
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const buckets = buildCoachRoundBuckets(activeRows);
  const orderedActive = [
    ...buckets.needsAttention,
    ...buckets.steady,
    ...buckets.waitingSeat,
  ];

  const renderActiveRow = (row: MentorshipRosterRowDto) => {
    const frozen = row.seat === "NONE";
    const maxFocus = row.metrics
      ? Math.max(15, ...row.metrics.dailyFocusMinutes14d)
      : 15;

    return (
      <Card key={row.linkId} style={{ gap: space.sm }}>
        <Pressable
          accessibilityRole="button"
          disabled={frozen}
          onPress={() => {
            void haptics.selection();
            router.push({
              pathname: "/(app)/coach-student" as never,
              params: { studentId: row.studentId },
            });
          }}
          style={styles.rowHeader}
        >
          <CoachAvatar name={row.studentDisplayName} size={42} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="cardTitle">{row.studentDisplayName}</AppText>
            {row.studentUsername ? (
              <AppText variant="caption" tone="secondary">
                @{row.studentUsername}
              </AppText>
            ) : null}
          </View>
          {frozen ? (
            <Chip label={t("roster_seat_waiting_badge")} tone="warning" />
          ) : row.needsAttention ? (
            <Chip label={t("needs_attention_badge")} tone="warning" />
          ) : (
            <AltArrowRightIcon size={18} color={palette.secondary} />
          )}
        </Pressable>

        {frozen ? (
          <AppText variant="caption" tone="secondary">
            {t("roster_seat_waiting_body")}
          </AppText>
        ) : (
          <>
            {row.riskFlags.length > 0 ? (
              <View style={styles.flagRow}>
                {row.riskFlags.map((flag) => (
                  <Chip
                    key={flag}
                    label={t(`flag_${flag}` as "flag_INACTIVE")}
                    tone={row.needsAttention ? "warning" : "default"}
                  />
                ))}
              </View>
            ) : null}

            {row.metrics ? (
              <>
                <View style={styles.sparkRow}>
                  {row.metrics.dailyFocusMinutes14d.map((mins, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.sparkBar,
                        {
                          height: mins > 0 ? Math.max(6, Math.round((mins / maxFocus) * 24)) : 3,
                          backgroundColor:
                            mins > 0 ? palette.coachAccent : palette.playTrack,
                          borderRadius: radii.pill,
                        },
                      ]}
                    />
                  ))}
                </View>
                <AppText variant="caption" tone="secondary" tabularNums>
                  {t("focus_7d", { minutes: row.metrics.focusMinutes7d })} ·{" "}
                  {t("streak_days", { days: row.metrics.currentStreak })}
                  {row.metrics.planCompletionRate7d !== null
                    ? ` · ${t("plan_completion_7d", {
                        percent: Math.round(row.metrics.planCompletionRate7d * 100),
                      })}`
                    : ""}
                  {row.metrics.latestMockNet !== null
                    ? ` · ${t("latest_mock_net", { net: row.metrics.latestMockNet })}`
                    : ""}
                </AppText>
              </>
            ) : null}

            <View style={styles.rowActions}>
              {row.needsAttention || row.attendedAt ? (
                <Button
                  label={
                    row.needsAttention
                      ? t("mark_attended_cta")
                      : t("unmark_attended_cta")
                  }
                  variant="secondary"
                  loading={
                    attentionMutation.isPending &&
                    attentionMutation.variables?.studentId === row.studentId
                  }
                  onPress={() =>
                    attentionMutation.mutate({
                      studentId: row.studentId,
                      attended: row.needsAttention,
                    })
                  }
                  style={{ flex: 1 }}
                />
              ) : null}
              <Button
                label={t("open_report_cta")}
                onPress={() => {
                  void haptics.selection();
                  router.push({
                    pathname: "/(app)/coach-student" as never,
                    params: { studentId: row.studentId },
                  });
                }}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </Card>
    );
  };

  return (
    <View style={{ gap: space.md }}>
      <SlidingTabs
        items={[
          { id: "ACTIVE", label: t("tab_active") },
          { id: "ENDED", label: t("tab_ended") },
        ]}
        value={tab}
        onChange={onTabChange}
        accessibilityLabel={t("roster_tabs_label")}
      />

      {tab === "ACTIVE" ? (
        orderedActive.length === 0 ? (
          <StateView title={t("empty_title")} body={t("empty_body")} tone="empty" />
        ) : (
          <View style={{ gap: space.sm }}>{orderedActive.map(renderActiveRow)}</View>
        )
      ) : endedLoading ? (
        <Skeleton height={110} />
      ) : endedError ? (
        <StateView
          title={tCommon("error_title")}
          body={tCommon("error_body")}
          actionLabel={tCommon("retry")}
          onAction={onRetryEnded}
          tone="error"
        />
      ) : endedRows.length === 0 ? (
        <StateView
          title={t("roster_ended_empty_title")}
          body={t("roster_ended_empty_body")}
          tone="empty"
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {endedRows.map((row) => (
            <Card key={row.linkId} style={{ gap: 4 }}>
              <AppText variant="cardTitle">{row.studentDisplayName}</AppText>
              <AppText variant="caption" tone="secondary">
                {row.endedAt
                  ? t("ended_on", { date: formatDisplayDate(row.endedAt, locale) })
                  : t("ended_no_access")}
              </AppText>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sparkRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 28,
  },
  sparkBar: {
    flex: 1,
    minWidth: 4,
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
