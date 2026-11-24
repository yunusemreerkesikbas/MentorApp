import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { formatDateLabel, formatMonthTitle, formatWeekdayShort, shiftMonth, todayIso } from "@mentor/core";
import { boardDays } from "../../lib/plan-calendar.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button } from "../ui/index.js";

export function AnalysisDateSheet({ initialDate, onClose, onApply }: {
  initialDate: string;
  onClose: () => void;
  onApply: (date: string) => void;
}) {
  const t = useTranslations("analysisEntry");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { palette, space, radii, touchTargets } = useThemeTokens();
  const [month, setMonth] = useState(initialDate);
  const [selected, setSelected] = useState(initialDate);
  const today = todayIso();
  const days = boardDays(month);
  const canAdvance = month.slice(0, 7) < today.slice(0, 7);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tCommon("close")} onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} />
        <View accessibilityViewIsModal style={{
          padding: space.lg, paddingBottom: insets.bottom + space.lg, backgroundColor: palette.surface,
          borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, gap: space.sm,
        }}>
          <AppText variant="title" accessibilityRole="header">{t("date_sheet_title")}</AppText>
          <View style={[styles.row, { alignItems: "center", justifyContent: "space-between" }]}>
            {([-1, 0, 1] as const).map((direction) => {
              if (direction === 0) {
                return <AppText key={direction} variant="cardTitle">{formatMonthTitle(month, locale)}</AppText>;
              }
              const next = direction > 0;
              const target = shiftMonth(month, direction);
              const Icon = next ? AltArrowRightIcon : AltArrowLeftIcon;
              const disabled = next && !canAdvance;
              return (
                <Pressable key={direction} accessibilityRole="button" accessibilityLabel={formatMonthTitle(target, locale)}
                  accessibilityState={{ disabled }} disabled={disabled} onPress={() => setMonth(target)}
                  style={{ minWidth: touchTargets.min, minHeight: touchTargets.min, alignItems: "center", justifyContent: "center" }}>
                  <Icon size={22} color={disabled ? palette.border : palette.main} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.row}>
            {days.slice(0, 7).map((day) => (
              <AppText key={day} variant="micro" tone="secondary" style={styles.dayHeader}>{formatWeekdayShort(day, locale)}</AppText>
            ))}
          </View>
          <View style={styles.grid}>
            {days.map((day) => {
              const active = day === selected;
              const disabled = day > today;
              return (
                <Pressable key={day} accessibilityRole="button" accessibilityLabel={formatDateLabel(day, locale, "", { alwaysFull: true })}
                  accessibilityState={{ selected: active, disabled }} disabled={disabled}
                  onPress={() => { setSelected(day); setMonth(day); }}
                  style={[styles.day, { minHeight: touchTargets.min, borderRadius: radii.inner, backgroundColor: active ? palette.playSelected : undefined }]}>
                  <AppText variant="caption" tabularNums tone={disabled || day.slice(0, 7) !== month.slice(0, 7) ? "muted" : "main"}>
                    {Number(day.slice(8))}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <Button label={t("date_sheet_apply")} onPress={() => onApply(selected)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayHeader: { flexBasis: "14.28%", textAlign: "center" },
  day: { flexBasis: "14.28%", justifyContent: "center", alignItems: "center" },
});
