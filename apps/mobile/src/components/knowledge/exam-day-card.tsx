import { Linking, Pressable, StyleSheet, View } from "react-native";
import { ArrowRightUpIcon } from "@solar-icons/react-native/linear/arrow-right-up";
import { HourglassIcon } from "@solar-icons/react-native/linear/hourglass";
import type { ExamCalendarDto, ExamType } from "@mentor/types";
import { getCatalog } from "../../i18n/index.js";
import { formatDisplayDate } from "../../lib/display-date.js";
import { isSafeHttpUrl } from "../../lib/knowledge-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText } from "../ui/index.js";

const EVENT_ORDER: Record<string, number> = {
  APPLICATION_START: 0,
  APPLICATION_END: 1,
  EXAM_DATE: 2,
  RESULT_DATE: 3,
};

export function ExamDayCard({
  family,
  calendar,
}: {
  family: ExamType;
  calendar: ExamCalendarDto | null;
}) {
  const { palette } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("knowledge");
  const tPanel = useTranslations("panel");
  const labels: Readonly<Partial<Record<string, string>>> = getCatalog(locale).knowledgeLabels;
  const labelFor = (key: string, fallback: string) =>
    Object.hasOwn(labels, key) ? (labels[key] ?? fallback) : fallback;

  const events = [...(calendar?.events ?? [])].sort(
    (a, b) =>
      (EVENT_ORDER[a.type] ?? 9) - (EVENT_ORDER[b.type] ?? 9) ||
      a.eventAt.localeCompare(b.eventAt),
  );
  const primaryEvent = events.find((e) => e.type === "EXAM_DATE") ?? events[0];
  const hasCountdown =
    Boolean(calendar?.examDateLabel) && calendar?.daysRemaining !== null && calendar?.daysRemaining !== undefined;
  const eyebrow = (hasCountdown ? tPanel("countdown_title") : t("calendar_pending_title"))
    .toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US");

  const openSource = () => {
    if (primaryEvent && isSafeHttpUrl(primaryEvent.sourceUrl)) {
      void Linking.openURL(primaryEvent.sourceUrl);
    }
  };

  return (
    <PanelCard style={styles.card}>
      <View style={styles.topRow}>
        <HourglassIcon size={36} color={palette.main} strokeWidth={1.5} />
        <View style={styles.topCol}>
          <AppText style={[styles.eyebrow, { color: palette.secondary }]}>
            {eyebrow}
          </AppText>
          {hasCountdown && calendar ? (
            <>
              {calendar.daysRemaining! <= 0 ? (
                <AppText style={styles.countdownHero}>{tPanel("countdown_today")}</AppText>
              ) : (
                <View style={styles.countdownRow}>
                  <AppText tabularNums style={styles.countdownHero}>
                    {calendar.daysRemaining}
                  </AppText>
                  <AppText style={[styles.countdownUnit, { color: palette.secondary }]}>
                    {tPanel("countdown_day_unit")}
                  </AppText>
                </View>
              )}
              <AppText style={[styles.caption, { color: palette.secondary }]}>
                {`${calendar.exam.name} · ${calendar.examDateLabel}`}
              </AppText>
            </>
          ) : (
            <>
              <AppText style={[styles.pendingText, { color: palette.main }]}>
                {t("calendar_pending_desc")}
              </AppText>
              <AppText style={[styles.caption, { color: palette.secondary }]}>
                {calendar?.exam.name ?? family}
              </AppText>
            </>
          )}
        </View>
      </View>

      {events.length > 0 ? (
        <View style={[styles.eventsBox, { borderTopColor: palette.playLine }]}>
          {events.map((ev, idx) => (
            <View key={`${ev.type}-${idx}`} style={styles.eventRow}>
              <AppText variant="caption" tone="secondary" style={styles.eventLabel}>
                {labelFor(ev.type, t("calendar_event"))}
              </AppText>
              <AppText variant="caption" tabularNums style={styles.eventDate}>
                {formatDisplayDate(ev.eventAt, locale, "UTC")}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {primaryEvent ? (
        <View style={[styles.sourceFooter, { borderTopColor: palette.playLine }]}>
          <Pressable
            accessibilityRole="link"
            disabled={!isSafeHttpUrl(primaryEvent.sourceUrl)}
            onPress={openSource}
            style={styles.sourceLink}
          >
            <AppText variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
              {t("source_label")}:{" "}
              <AppText variant="caption" style={styles.sourceName}>
                {primaryEvent.source}
              </AppText>
            </AppText>
            {isSafeHttpUrl(primaryEvent.sourceUrl) ? (
              <ArrowRightUpIcon size={14} color={palette.secondary} strokeWidth={1.75} />
            ) : null}
          </Pressable>
          <AppText variant="micro" tone="muted">
            {t("last_verified", {
              date: formatDisplayDate(primaryEvent.verifiedAt, locale, "UTC"),
            })}
          </AppText>
        </View>
      ) : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  topCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  countdownHero: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  countdownUnit: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  pendingText: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  eventsBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 8,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eventLabel: {
    flex: 1,
  },
  eventDate: {
    fontWeight: "700",
  },
  sourceFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 2,
  },
  sourceLink: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sourceName: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
