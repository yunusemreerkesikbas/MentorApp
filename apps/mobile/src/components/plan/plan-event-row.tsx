import { Pressable, StyleSheet, View } from "react-native";
import { CalendarMarkIcon } from "@solar-icons/react-native/linear/calendar-mark";
import { ClockCircleIcon } from "@solar-icons/react-native/linear/clock-circle";
import { formatDateLabel, formatTimeRange } from "@mentor/core";
import type { PlanEventDto } from "@mentor/types";
import { mixHex } from "../../lib/layout.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText } from "../ui/text.js";

/** "Koçunla" on a meeting somebody else (the coach) set up; nothing on the student's own. */
function useWithWhom(event: PlanEventDto, viewerId: string | null): string | null {
  const t = useTranslations("plan");
  return event.organizerUserId === viewerId ? null : t("event_with_coach");
}

/**
 * A meeting on the day's list (the web's `PlanCoachEventRow`). It only opens its details: a
 * meeting is attended, not ticked off, and the coach who set it up moves or cancels it.
 */
export function PlanEventRow({
  event,
  viewerId,
  onPress,
}: {
  event: PlanEventDto;
  viewerId: string | null;
  onPress: () => void;
}) {
  const { palette } = useThemeTokens();
  const t = useTranslations("plan");
  const withWhom = useWithWhom(event, viewerId);
  const cancelled = event.status === "CANCELLED";
  const line = [
    formatTimeRange(event.startTime, event.endTime) ?? t("all_day"),
    withWhom,
    cancelled ? t("event_cancelled") : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <CalendarMarkIcon size={20} color={palette.secondary} />
      <View style={styles.body}>
        <AppText style={[styles.title, cancelled && styles.cancelled, { color: palette.main }]}>
          {event.title}
        </AppText>
        <AppText tone="secondary" style={styles.line}>
          {line.join(" · ")}
        </AppText>
      </View>
    </Pressable>
  );
}

/** The meeting's read-only details sheet (the web's `PlanCoachEventDetails`). */
export function PlanEventSheet({
  event,
  viewerId,
  onClose,
}: {
  event: PlanEventDto | null;
  viewerId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  return (
    <FormSheet
      visible={event !== null}
      title={t("event_details_title")}
      closeLabel={tCommon("close")}
      onClose={onClose}
    >
      {event ? <EventDetails event={event} viewerId={viewerId} /> : null}
    </FormSheet>
  );
}

function EventDetails({ event, viewerId }: { event: PlanEventDto; viewerId: string | null }) {
  const { palette, radii } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const withWhom = useWithWhom(event, viewerId);
  const cancelled = event.status === "CANCELLED";
  const range = formatTimeRange(event.startTime, event.endTime);
  const when = `${formatDateLabel(event.eventDate, locale, t("today"), { alwaysFull: true })}, ${range ?? t("all_day")}`;

  return (
    <>
      <View
        style={[
          styles.summary,
          {
            backgroundColor: mixHex(palette.secondary, palette.surface, 0.12),
            borderRadius: radii.card,
          },
        ]}
      >
        <AppText style={[styles.summaryTitle, cancelled && styles.cancelled]}>
          {event.title}
        </AppText>
        <View style={styles.when}>
          <ClockCircleIcon size={16} color={palette.main} />
          <AppText style={styles.detailValue}>{when}</AppText>
        </View>
        {withWhom ? <AppText style={styles.detailValue}>{withWhom}</AppText> : null}
      </View>
      {cancelled ? <DetailRow label={t("event_status")} value={t("event_cancelled")} /> : null}
      {event.description ? <DetailRow label={t("description")} value={event.description} /> : null}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText tone="secondary" style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
  },
  cancelled: {
    textDecorationLine: "line-through",
    opacity: 0.7,
  },
  line: {
    fontSize: 12,
    lineHeight: 17,
  },
  summary: {
    padding: 16,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  when: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detail: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 14,
    lineHeight: 20,
  },
});
