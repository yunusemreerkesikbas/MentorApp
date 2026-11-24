import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  PLAN_ADAPTATION_MINUTE_CHOICES,
  PLAN_ADAPTATION_NOTE_MAX,
  type PlanWindowDay,
} from "@mentor/core";
import { haptics } from "../../../lib/haptics.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PlayOptionCard } from "../../onboarding/step-shell.js";
import { AppText, TextField } from "../../ui/index.js";

/** Step bodies of the "Puhu'yla planla" wizard (the web's brief steps); the wizard owns state. */

const tag = (locale: string) => (locale === "en" ? "en-GB" : "tr-TR");

export function DaysStep({
  title,
  window,
  selected,
  rhythmWeekdays,
  onToggle,
}: {
  title: string;
  window: readonly PlanWindowDay[];
  selected: readonly number[];
  /** The weekdays the student studied on most; badged so a pre-pick never looks arbitrary. */
  rhythmWeekdays: readonly number[];
  onToggle: (weekday: number) => void;
}) {
  const t = useTranslations("plan");
  const { locale } = useLocale();
  const { space } = useThemeTokens();
  return (
    <View accessibilityLabel={title} style={{ gap: space.sm }}>
      {rhythmWeekdays.length > 0 ? (
        <AppText variant="caption" tone="secondary">
          {t("coach_adaptation_days_rhythm")}
        </AppText>
      ) : null}
      {window.map((day, index) => {
        const when =
          index === 0
            ? t("coach_adaptation_today")
            : index === 1
              ? t("coach_adaptation_tomorrow")
              : day.date.toLocaleDateString(tag(locale), { day: "numeric", month: "long" });
        return (
          <PlayOptionCard
            key={day.weekday}
            multiple
            label={day.date.toLocaleDateString(tag(locale), { weekday: "long" })}
            subtitle={
              rhythmWeekdays.includes(day.weekday) ? `${when} · ${t("coach_adaptation_rhythm_badge")}` : when
            }
            selected={selected.includes(day.weekday)}
            onPress={() => onToggle(day.weekday)}
          />
        );
      })}
    </View>
  );
}

export function MinutesStep({
  title,
  minutes,
  goalMinutes,
  rhythmMinutes,
  onSelect,
}: {
  title: string;
  minutes: number | null;
  goalMinutes: number | null;
  rhythmMinutes: number | null;
  onSelect: (minutes: number | null) => void;
}) {
  const t = useTranslations("plan");
  const { space } = useThemeTokens();
  const choices = PLAN_ADAPTATION_MINUTE_CHOICES as readonly number[];
  // What the student typed stays as typed, even when it matches a card ("3" on the way to "30").
  const [typed, setTyped] = useState(() => (minutes != null && !choices.includes(minutes) ? String(minutes) : ""));
  const rows = [choices.slice(0, 2), choices.slice(2, 4)];
  return (
    <View accessibilityLabel={title} style={{ gap: space.sm }}>
      {rows.map((row) => (
        <View key={row.join()} style={[styles.minuteRow, { gap: space.sm }]}>
          {row.map((choice) => (
            <MinuteCard
              key={choice}
              value={choice}
              unit={t("coach_adaptation_minutes_unit")}
              badge={
                choice === goalMinutes
                  ? t("coach_adaptation_minutes_badge")
                  : choice === rhythmMinutes
                    ? t("coach_adaptation_rhythm_badge")
                    : undefined
              }
              selected={typed === "" && minutes === choice}
              onPress={() => {
                setTyped("");
                onSelect(choice);
              }}
            />
          ))}
        </View>
      ))}
      <TextField
        label={`${t("coach_adaptation_minutes_custom_label")} (${t("coach_adaptation_minutes_unit")})`}
        placeholder="90"
        keyboardType="number-pad"
        maxLength={3}
        value={typed}
        onChangeText={(text) => {
          setTyped(text);
          const value = Number.parseInt(text.trim(), 10);
          onSelect(Number.isNaN(value) ? null : value);
        }}
      />
    </View>
  );
}

function MinuteCard({
  value,
  unit,
  badge,
  selected,
  onPress,
}: {
  value: number;
  unit: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette, radii, space } = useThemeTokens();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${value} ${unit}${badge ? `, ${badge}` : ""}`}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[
        styles.minuteCard,
        {
          borderRadius: radii.card,
          padding: space.md,
          borderColor: selected ? palette.ctaPlayBg : palette.border,
          backgroundColor: selected ? palette.surfaceAlt : palette.surface,
        },
      ]}
    >
      {badge ? (
        <View style={[styles.badge, { backgroundColor: palette.ctaPlayBg, borderRadius: radii.pill }]}>
          <AppText variant="micro" tone="ctaInk" numberOfLines={1}>
            {badge}
          </AppText>
        </View>
      ) : null}
      <AppText
        tabularNums
        style={[styles.minuteValue, { color: selected ? palette.playSelectedInk : palette.main }]}
      >
        {String(value)}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {unit}
      </AppText>
    </Pressable>
  );
}

export function SubjectsStep({
  title,
  names,
  selected,
  suggested,
  onToggle,
}: {
  title: string;
  /** null while the exam taxonomy loads. */
  names: readonly string[] | null;
  selected: readonly string[];
  /** Lower-cased names Puhu suggested from the student's own mocks and notebook. */
  suggested: ReadonlySet<string>;
  onToggle: (name: string) => void;
}) {
  const t = useTranslations("plan");
  const { space } = useThemeTokens();
  if (!names) {
    return (
      <AppText variant="body" tone="secondary">
        {t("loading")}
      </AppText>
    );
  }
  return (
    <View accessibilityLabel={title} style={{ gap: space.sm }}>
      {names.map((name) => (
        <PlayOptionCard
          key={name}
          multiple
          label={name}
          subtitle={suggested.has(name.toLocaleLowerCase("tr-TR")) ? t("coach_adaptation_suggested") : undefined}
          selected={selected.includes(name)}
          onPress={() => onToggle(name)}
        />
      ))}
    </View>
  );
}

export function NoteStep({ note, onChange }: { note: string; onChange: (note: string) => void }) {
  const t = useTranslations("plan");
  return (
    <TextField
      label={t("coach_adaptation_note_label")}
      hint={t("coach_adaptation_note_hint", { count: note.length })}
      placeholder={t("coach_adaptation_note_placeholder")}
      multiline
      maxLength={PLAN_ADAPTATION_NOTE_MAX}
      value={note}
      onChangeText={(text) => onChange(text.slice(0, PLAN_ADAPTATION_NOTE_MAX))}
      style={styles.note}
    />
  );
}

const styles = StyleSheet.create({
  minuteRow: {
    flexDirection: "row",
  },
  minuteCard: {
    flex: 1,
    minHeight: 104,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  minuteValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  note: {
    minHeight: 128,
    paddingTop: 12,
    textAlignVertical: "top",
  },
});
