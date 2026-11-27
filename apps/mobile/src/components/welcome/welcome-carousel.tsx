import { useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { WELCOME_SCENES } from "../../lib/onboarding-assets.js";
import { haptics } from "../../lib/haptics.js";
import {
  WELCOME_SLIDES, isFinalWelcomeStep, nextWelcomeStep, welcomeSkipStep, welcomeStartStep, type WelcomeStep,
} from "../../lib/welcome-flow.js";
import { loadWelcomeSeen, markWelcomeSeen } from "../../lib/welcome-seen.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button } from "../ui/index.js";
import { WelcomeScene } from "./welcome-scene.js";

/** Frosted chrome over the art keeps one look in both themes (`--play-frost`). */
const FROST = "rgba(255, 255, 255, 0.72)";
const FROST_INK = "#111111";

/**
 * The web's welcome: four swipeable scenes of "Puhu'nun bir günü" with the copy sheet below.
 * "Devam et" and "Atla" move through the slides; the last one offers sign-up, log-in and, for
 * coaches, a small link. A returning signed-out user starts on the last slide.
 */
export function WelcomeCarousel({
  onSignup, onLogin, onCoach,
}: {
  onSignup: () => void;
  onLogin: () => void;
  /** Hidden when coach sign-up is out of this release. */
  onCoach?: () => void;
}) {
  const t = useTranslations("play");
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { palette, space, radii } = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<WelcomeStep>(() => welcomeStartStep(loadWelcomeSeen()));
  const listRef = useRef<FlatList<(typeof WELCOME_SLIDES)[number]>>(null);
  const stageHeight = Math.min(512, Math.max(240, height - 368));
  const slide = WELCOME_SLIDES[step];
  const isLast = isFinalWelcomeStep(step);

  const settle = (next: WelcomeStep) => {
    if (next === step) return;
    setStep(next);
    if (isFinalWelcomeStep(next)) markWelcomeSeen();
  };
  const goTo = (next: WelcomeStep) => {
    haptics.selection();
    listRef.current?.scrollToIndex({ index: next, animated: !reduceMotion });
    settle(next);
  };
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    settle(Math.min(Math.max(index, 0), WELCOME_SLIDES.length - 1) as WelcomeStep);
  };
  const leave = (go: () => void) => () => {
    markWelcomeSeen();
    go();
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={{ height: stageHeight }}>
        <FlatList
          ref={listRef}
          data={WELCOME_SLIDES}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={step}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={onScrollEnd}
          importantForAccessibility="no-hide-descendants"
          renderItem={({ index }) => (
            <View style={{ width, height: stageHeight }}>
              <WelcomeScene scene={WELCOME_SCENES[index]!} active={index === step} still={reduceMotion} />
            </View>
          )}
        />
        {isLast ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("welcome__skip")}
            onPress={() => goTo(welcomeSkipStep())}
            style={[styles.skip, { top: insets.top + space.md, backgroundColor: FROST }]}
          >
            <AppText style={[styles.skipText, { color: FROST_INK }]}>{t("welcome__skip")}</AppText>
          </Pressable>
        )}
      </View>

      {/* Scrolls when a small screen or a large font needs more room, so the buttons stay reachable. */}
      <ScrollView
        style={[styles.sheet, { backgroundColor: palette.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }]}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.xl }}
        bounces={false}
      >
        <View accessibilityRole="tablist" accessibilityLabel={t("welcome__progress_aria", { current: step + 1, total: WELCOME_SLIDES.length })} style={styles.dots}>
          {WELCOME_SLIDES.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={t("welcome__go_to_slide", { current: index + 1 })}
              accessibilityState={{ selected: index === step }}
              hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
              onPress={() => goTo(index as WelcomeStep)}
              style={styles.dotHit}
            >
              <View style={[styles.dot, { width: index === step ? 24 : 8, backgroundColor: index === step ? palette.playSelectedInk : palette.playLine }]} />
            </Pressable>
          ))}
        </View>
        <View accessibilityLiveRegion="polite" style={{ gap: space.sm, marginTop: space.md }}>
          <AppText accessibilityRole="header" style={styles.title}>{t(`welcome__${slide.copyKey}_title`)}</AppText>
          <AppText tone="secondary" style={styles.subtitle}>{t(`welcome__${slide.copyKey}_subtitle`)}</AppText>
        </View>
        <View style={{ marginTop: "auto", gap: space.md, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }}>
          <Button
            label={isLast ? t("welcome__start") : t("welcome__continue")}
            onPress={isLast ? leave(onSignup) : () => goTo(nextWelcomeStep(step))}
          />
          {isLast ? <Button variant="secondary" label={t("welcome__have_account")} onPress={leave(onLogin)} /> : null}
          {isLast && onCoach ? (
            <Pressable accessibilityRole="link" onPress={leave(onCoach)} style={styles.coach}>
              <AppText style={[styles.coachText, { color: palette.playSelectedInk }]}>{t("welcome__coach_link")}</AppText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skip: { position: "absolute", right: 16, minHeight: 44, borderRadius: 999, paddingHorizontal: 16, justifyContent: "center" },
  skipText: { fontSize: 14, fontWeight: "700" },
  sheet: { flex: 1, marginTop: -28 },
  dots: { flexDirection: "row", alignItems: "center", marginHorizontal: -8 },
  // ponytail: 24×44 per dot (8 + 2×8 padding, vertical slop); spreading dots to 44 wide would break the web look.
  dotHit: { height: 24, justifyContent: "center", paddingHorizontal: 8 },
  dot: { height: 8, borderRadius: 999 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 16, lineHeight: 24, fontWeight: "500" },
  coach: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  coachText: { fontSize: 15, fontWeight: "800" },
});
