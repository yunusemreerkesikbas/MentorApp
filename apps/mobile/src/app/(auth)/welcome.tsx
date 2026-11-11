import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isWaitlistOn } from "@mentor/core";
import { EXAM_TYPES } from "@mentor/types";
import { Button, Card, Chip, AppText } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

const SLIDE_KEYS = ["1", "2", "3", "4"] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { availability } = useAppAvailability();
  const { palette, space, radii } = useThemeTokens();
  const t = useTranslations("welcome");
  const [activeSlide, setActiveSlide] = useState<number>(0);

  const waitlistActive = isWaitlistOn(availability);
  const currentKey = SLIDE_KEYS[activeSlide] ?? "1";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xl,
          paddingHorizontal: space.lg,
          gap: space.xl,
        },
      ]}
    >
      <View style={{ gap: space.md }}>
        <View style={styles.chipRow}>
          {EXAM_TYPES.map((exam) => (
            <Chip key={exam} label={exam} />
          ))}
        </View>
        <AppText variant="display">{t("headline")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("subtitle")}
        </AppText>
      </View>

      <Card variant="alt" style={{ gap: space.md }}>
        <View style={styles.slideHeader}>
          <AppText variant="caption" tone="accent">
            PuhuKoç · {activeSlide + 1}/{SLIDE_KEYS.length}
          </AppText>
          <View style={styles.dotsRow}>
            {SLIDE_KEYS.map((key, idx) => {
              const selected = idx === activeSlide;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => {
                    haptics.selection();
                    setActiveSlide(idx);
                  }}
                  style={[
                    styles.dot,
                    {
                      width: selected ? 22 : 8,
                      borderRadius: radii.pill,
                      backgroundColor: selected
                        ? palette.ctaPlayBg
                        : palette.border,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <AppText variant="cardTitle">{t(`slide${currentKey}_title`)}</AppText>
        <AppText variant="body" tone="secondary">
          {t(`slide${currentKey}_body`)}
        </AppText>

        <View style={styles.slideStepRow}>
          {SLIDE_KEYS.map((key, idx) => (
            <Chip
              key={key}
              label={`${idx + 1}. ${t(`slide${key}_title`).split(" ")[0]}`}
              selected={idx === activeSlide}
              onPress={() => setActiveSlide(idx)}
            />
          ))}
        </View>
      </Card>

      <View style={{ gap: space.sm, marginTop: "auto" }}>
        <Button
          label={t("start_cta")}
          onPress={() =>
            router.push(
              (waitlistActive ? "/(auth)/waitlist" : "/(auth)/signup") as never,
            )
          }
          variant="primary"
        />
        <Button
          label={t("coach_cta")}
          onPress={() =>
            router.push(
              (waitlistActive
                ? "/(auth)/waitlist?role=coach"
                : "/(auth)/signup?role=coach") as never,
            )
          }
          variant="secondary"
        />
        <Button
          label={t("login_cta")}
          onPress={() => router.push("/(auth)/login" as never)}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slideHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 8,
  },
  slideStepRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
});
