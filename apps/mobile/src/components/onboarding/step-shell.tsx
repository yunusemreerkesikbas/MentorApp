import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card } from "../ui/index.js";

export interface OnboardingStepShellProps {
  title: string;
  subtitle?: string;
  progress: { done: number; total: number } | null;
  onBack?: () => void;
  skipLabel?: string;
  onSkip?: () => void;
  errorMessage?: string | null;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  children: ReactNode;
}

export function OnboardingStepShell({
  title,
  subtitle,
  progress,
  onBack,
  skipLabel,
  onSkip,
  errorMessage,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  children,
}: OnboardingStepShellProps) {
  const insets = useSafeAreaInsets();
  const { palette, space, radii } = useThemeTokens();
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");

  const progressRatio = progress
    ? Math.min(1, Math.max(0.08, progress.done / progress.total))
    : 0;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: palette.bg,
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + space.md,
        },
      ]}
    >
      <View
        style={[
          styles.topBar,
          { paddingHorizontal: space.lg, marginBottom: space.md },
        ]}
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              haptics.selection();
              onBack();
            }}
            style={styles.navAction}
          >
            <AppText variant="caption" tone="secondary">
              ← {tCommon("back")}
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}

        {progress ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t("step_badge", {
              done: progress.done,
              total: progress.total,
            })}
            style={[
              styles.progressTrack,
              {
                backgroundColor: palette.border,
                borderRadius: radii.pill,
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(progressRatio * 100)}%`,
                  backgroundColor: palette.ctaPlayBg,
                  borderRadius: radii.pill,
                },
              ]}
            />
          </View>
        ) : (
          <View style={styles.progressTrack} />
        )}

        {onSkip && skipLabel ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              haptics.selection();
              onSkip();
            }}
            style={styles.navAction}
          >
            <AppText variant="caption" tone="accent">
              {skipLabel}
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: space.lg, gap: space.lg },
        ]}
      >
        <Card
          variant="alt"
          style={{
            borderColor: palette.border,
            gap: space.xs,
          }}
        >
          <AppText variant="caption" tone="accent">
            Puhu
          </AppText>
          <AppText variant="sectionHeading">{title}</AppText>
          {subtitle ? (
            <AppText variant="body" tone="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </Card>

        {children}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            borderTopColor: palette.border,
            gap: space.sm,
          },
        ]}
      >
        {errorMessage ? (
          <AppText variant="caption" tone="danger">
            {errorMessage}
          </AppText>
        ) : null}
        <Button
          label={primaryLabel}
          onPress={onPrimary}
          disabled={primaryDisabled}
          loading={primaryLoading}
          variant="primary"
        />
      </View>
    </View>
  );
}

export interface PlayOptionCardProps {
  label: string;
  subtitle?: string;
  badge?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function PlayOptionCard({
  label,
  subtitle,
  badge,
  selected,
  disabled = false,
  onPress,
}: PlayOptionCardProps) {
  const { palette, radii, space } = useThemeTokens();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[
        styles.optionCard,
        {
          borderRadius: radii.card,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          borderColor: selected ? palette.ctaPlayBg : palette.border,
          backgroundColor: selected ? palette.surfaceAlt : palette.surface,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.optionLabelRow}>
          <AppText variant="cardTitle">{label}</AppText>
          {badge ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: palette.ctaPlayBg,
                  borderRadius: radii.pill,
                },
              ]}
            >
              <AppText variant="micro" tone="ctaInk">
                {badge}
              </AppText>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View
        style={[
          styles.radioCircle,
          {
            borderRadius: radii.pill,
            borderColor: selected ? palette.ctaPlayBg : palette.border,
            backgroundColor: selected ? palette.ctaPlayBg : "transparent",
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 36,
  },
  navAction: {
    minWidth: 64,
  },
  navSpacer: {
    minWidth: 64,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  footer: {
    borderTopWidth: 1,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 2,
    minHeight: 58,
  },
  optionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderWidth: 2,
  },
});
