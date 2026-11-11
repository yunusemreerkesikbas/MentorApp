import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { MoodCheckinDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { haptics } from "../../lib/haptics.js";
import { upsertMoodCheckin } from "../../lib/coaching-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Card } from "../ui/index.js";

export interface MoodCheckinCardProps {
  initialMood: MoodCheckinDto | null;
  onSaved: (checkin: MoodCheckinDto) => void;
}

const MOOD_ITEMS = [
  { value: 1, emoji: "😞", labelKey: "mood_1" },
  { value: 2, emoji: "😕", labelKey: "mood_2" },
  { value: 3, emoji: "😐", labelKey: "mood_3" },
  { value: 4, emoji: "🙂", labelKey: "mood_4" },
  { value: 5, emoji: "😄", labelKey: "mood_5" },
] as const;

export function MoodCheckinCard({ initialMood, onSaved }: MoodCheckinCardProps) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { palette, radii, space, touchTargets } = useThemeTokens();
  const [current, setCurrent] = useState<MoodCheckinDto | null>(initialMood);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedValue = current?.mood ?? initialMood?.mood ?? null;
  const activeCheckin = current ?? initialMood;

  const handleSelectMood = async (value: number) => {
    if (busy) return;
    haptics.selection();
    setBusy(true);
    setErrorMessage(null);
    try {
      const saved = await upsertMoodCheckin({ mood: value });
      setCurrent(saved);
      haptics.success();
      onSaved(saved);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : tCommon("error_body"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.headerRow}>
        <AppText variant="cardTitle">{t("mood_title")}</AppText>
        {busy ? (
          <AppText variant="caption" tone="muted">
            {tCommon("loading")}
          </AppText>
        ) : null}
      </View>

      <View style={styles.moodRow}>
        {MOOD_ITEMS.map((item) => {
          const isSelected = selectedValue === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: busy }}
              disabled={busy}
              onPress={() => void handleSelectMood(item.value)}
              style={[
                styles.moodButton,
                {
                  minHeight: touchTargets.min,
                  borderRadius: radii.inner,
                  borderColor: isSelected ? palette.ctaPlayEdge : palette.border,
                  backgroundColor: isSelected ? palette.ctaPlayBg : palette.surfaceAlt,
                  paddingVertical: space.xs + 2,
                  paddingHorizontal: space.xs,
                },
              ]}
            >
              <AppText variant="cardTitle">{item.emoji}</AppText>
              <AppText
                variant="micro"
                style={{
                  color: isSelected ? palette.ctaPlayInk : palette.secondary,
                  textAlign: "center",
                }}
              >
                {t(item.labelKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {errorMessage ? (
        <AppText variant="caption" tone="danger">
          {errorMessage}
        </AppText>
      ) : null}

      {activeCheckin?.message ? (
        <View
          style={[
            styles.messageBox,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
              borderRadius: radii.inner,
              padding: space.md,
              gap: space.xs,
            },
          ]}
        >
          <AppText variant="body" tone="main">
            {activeCheckin.message}
          </AppText>
          {activeCheckin.aiReflection ? (
            <AppText variant="caption" tone="coach">
              {activeCheckin.aiReflection}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  moodButton: {
    flex: 1,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  messageBox: {
    borderWidth: 1,
  },
});
