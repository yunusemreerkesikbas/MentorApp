import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import type { MentorshipWeeklyReportListItemDto } from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { haptics } from "../../../lib/haptics.js";
import { fetchMyWeeklyReports } from "../../../lib/mentorship-weekly-reports-api.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button } from "../../ui/index.js";

export function MyCoachWeeklyReportsCard({ coachName }: { coachName: string }) {
  const t = useTranslations("students");
  const { locale } = useLocale();
  const router = useRouter();
  const { palette, radii, space } = useThemeTokens();
  const [showAll, setShowAll] = useState(false);

  const reportsQuery = useQuery({
    queryKey: ["my-coach", "weekly-reports"],
    queryFn: fetchMyWeeklyReports,
    retry: false,
  });

  const items = reportsQuery.data?.items ?? [];
  if (items.length === 0) return null;

  const visible = showAll ? items : items.slice(0, 1);

  const renderRow = (item: MentorshipWeeklyReportListItemDto) => {
    const periodText = `${formatDisplayDate(`${item.period.startDate}T12:00:00.000Z`, locale)} - ${formatDisplayDate(`${item.period.endDate}T12:00:00.000Z`, locale)}`;
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        onPress={() => {
          void haptics.selection();
          router.push({
            pathname: "/(app)/my-coach-weekly-report" as never,
            params: { reportId: item.id },
          });
        }}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? palette.surfaceHover : palette.surfaceAlt,
            borderColor: palette.border,
            borderRadius: radii.inner,
          },
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="cardTitle">{periodText}</AppText>
          <AppText variant="caption" tone="secondary">
            {t("my_weekly_report_row_meta", {
              name: coachName,
              date: formatDisplayDate(item.finalizedAt, locale),
            })}
          </AppText>
        </View>
        <AltArrowRightIcon size={18} color={palette.secondary} />
      </Pressable>
    );
  };

  return (
    <PanelCard style={{ gap: space.sm }}>
      <PanelCardTitle>{t("my_weekly_reports_title")}</PanelCardTitle>
      <View style={{ gap: space.sm }}>{visible.map(renderRow)}</View>
      {items.length > 1 ? (
        <Button
          label={
            showAll
              ? t("my_weekly_reports_hide_older")
              : t("my_weekly_reports_older", { count: items.length - 1 })
          }
          variant="secondary"
          onPress={() => setShowAll((prev) => !prev)}
        />
      ) : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
