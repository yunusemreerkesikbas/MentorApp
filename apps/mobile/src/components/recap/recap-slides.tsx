import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View, type TextStyle } from "react-native";
import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getFocusStoryMode,
  getPerformanceStoryMode,
  getWeeklyBestStorySource,
  getWeeklyRecapFocusTimeMessage,
  getWeeklyRecapTextBeat,
  type WeeklyRecapStorySlide,
  type WeeklyRecapTextBeat,
} from "@mentor/core";
import type { WeeklyRecapHighlightDto, WeeklyReviewDto } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { AppText } from "../ui/text.js";
import { RecapCharacterVideo } from "./recap-character-video.js";
import { RECAP } from "./recap-colors.js";
import { RecapDecor } from "./recap-decor.js";
import { headlineScale } from "./recap-flow.js";
import { formatRecapDay } from "./recap-format.js";
import { recapLocaleTag, riseIn, useRecapPuhu } from "./recap-kit.js";
import { RecapWeekMap } from "./recap-week-map.js";

type Translate = ReturnType<typeof useTranslations<"recap">>;

/**
 * One story slide (the web's `StoryContent` with its layers): the character clip or the drifting
 * shapes behind, the copy in front. The lakap's reveal gets the story's one haptic.
 */
export function RecapSlide({
  slide,
  review,
  elapsedMs,
  playing,
  reducedMotion,
  finalCard,
}: {
  slide: WeeklyRecapStorySlide;
  review: WeeklyReviewDto;
  elapsedMs: number;
  playing: boolean;
  reducedMotion: boolean;
  finalCard?: ReactNode;
}) {
  const revealed =
    slide.kind === "weekly_title" && (!slide.character || elapsedMs >= slide.character.headlineAtMs);
  const buzzed = useRef(false);
  useEffect(() => {
    if (!revealed || buzzed.current) return;
    buzzed.current = true;
    haptics.success();
  }, [revealed]);

  if (slide.kind === "week_map") {
    return <RecapWeekMap review={review} elapsedMs={elapsedMs} playing={playing} reducedMotion={reducedMotion} />;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {slide.character ? (
        <RecapCharacterVideo character={slide.character.key} elapsedMs={elapsedMs} playing={playing} />
      ) : (
        <RecapDecor kind={slide.kind} reducedMotion={reducedMotion} />
      )}
      <SlideContent
        slide={slide}
        review={review}
        elapsedMs={elapsedMs}
        reducedMotion={reducedMotion}
        finalCard={finalCard}
      />
    </View>
  );
}

function SlideContent({
  slide,
  review,
  elapsedMs,
  reducedMotion,
  finalCard,
}: {
  slide: WeeklyRecapStorySlide;
  review: WeeklyReviewDto;
  elapsedMs: number;
  reducedMotion: boolean;
  finalCard?: ReactNode;
}) {
  const t = useTranslations("recap");
  const { locale } = useLocale();
  const host = useRecapPuhu("host");
  const head = useHeadlineType();
  const beat = getWeeklyRecapTextBeat(elapsedMs, slide.durationMs);

  switch (slide.kind) {
    case "welcome": {
      const secondBeat = elapsedMs >= 4_000;
      return (
        <Center>
          {!secondBeat ? (
            <View key="welcome" style={styles.column}>
              <Bob reducedMotion={reducedMotion}>
                <Image source={host} style={styles.host} contentFit="contain" accessible={false} />
              </Bob>
              <AppText accessibilityRole="header" style={[head.h1, styles.mt28]}>
                {t("welcome_title")}
              </AppText>
              <AppText style={[type.small, styles.mt16]}>
                {t("period", {
                  startDate: formatRecapDay(review.period.startDate, locale),
                  endDate: formatRecapDay(review.period.endDate, locale),
                })}
              </AppText>
            </View>
          ) : (
            <Animated.View key="next" entering={riseIn(reducedMotion, 520)}>
              <AppText accessibilityRole="header" style={head.h0}>
                {t("welcome_next")}
              </AppText>
            </Animated.View>
          )}
        </Center>
      );
    }
    case "focus": {
      const data = getFocusStoryMode(review) === "data";
      const timeMessage = getWeeklyRecapFocusTimeMessage(review);
      return (
        <Center top>
          <TextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              data ? (
                <>
                  <AppText accessibilityRole="header" style={head.h1}>
                    {t("focus_title")}
                  </AppText>
                  <AppText tabularNums style={[type.giant, styles.mt28]}>
                    {review.rhythm.focusMinutes}
                  </AppText>
                  <AppText style={[type.unit, styles.mt8]}>{t("focus_minutes")}</AppText>
                </>
              ) : (
                <AppText accessibilityRole="header" style={head.h1}>
                  {t("focus_teaser_title")}
                </AppText>
              )
            }
            support={
              <>
                <AppText style={[type.support, { color: "rgba(0,0,0,0.75)" }]}>
                  {data
                    ? t("focus_support", {
                        sessions: review.evidence.qualifyingSessionCount,
                        longest: review.rhythm.longestSessionMinutes,
                      })
                    : t("focus_teaser_message")}
                </AppText>
                {data && timeMessage ? (
                  <AppText style={[type.note, styles.mt20]}>{timeMessage}</AppText>
                ) : null}
              </>
            }
          />
        </Center>
      );
    }
    case "weekly_run": {
      const hasRun = review.rhythm.longestActiveRun > 1;
      const count = hasRun ? review.rhythm.longestActiveRun : review.recap.activeDays;
      return (
        <Center>
          <TextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              <>
                <AppText tabularNums style={type.giant}>
                  {count}
                </AppText>
                <AppText accessibilityRole="header" style={[head.h1, styles.mt20]}>
                  {t(hasRun ? "weekly_run_title" : "weekly_run_active_days_title", { count })}
                </AppText>
              </>
            }
            support={<AppText style={type.support}>{review.rhythm.message}</AppText>}
          />
        </Center>
      );
    }
    case "weekly_best":
      return (
        <Center>
          <WeeklyBest review={review} beat={beat} reducedMotion={reducedMotion} />
        </Center>
      );
    case "performance": {
      const data = getPerformanceStoryMode(review) === "data";
      return (
        <Center>
          <TextBeat
            beat={beat}
            reducedMotion={reducedMotion}
            headline={
              data ? (
                <>
                  <AppText style={type.eyebrow}>{t("performance_eyebrow").toLocaleUpperCase(recapLocaleTag(locale))}</AppText>
                  <AppText accessibilityRole="header" style={[head.h1, styles.mt20]}>
                    {t("performance_title")}
                  </AppText>
                  <AppText tabularNums style={[type.giant, styles.mt28]}>
                    {review.performance?.averageNet}
                  </AppText>
                  <AppText style={[type.unit, styles.mt8, { fontSize: 20 }]}>{t("performance_net")}</AppText>
                </>
              ) : (
                <AppText accessibilityRole="header" style={head.h1}>
                  {t("performance_bridge_title")}
                </AppText>
              )
            }
            support={
              <AppText style={type.support}>
                {data ? review.performance?.message : t("performance_bridge_message")}
              </AppText>
            }
          />
        </Center>
      );
    }
    case "weekly_title": {
      const character = slide.character;
      if (character && elapsedMs < character.headlineAtMs) return null;
      const titleBeat: WeeklyRecapTextBeat =
        character && elapsedMs >= character.supportAtMs ? "support" : "headline";
      return (
        <Center>
          {/* Above the character, who stands in the lower half of the clip. */}
          <View style={[styles.stretch, character ? styles.lifted : null]}>
            <TextBeat
              beat={titleBeat}
              reducedMotion={reducedMotion}
              headline={
                <>
                  <AppText style={[type.eyebrow, { color: "rgba(255,255,255,0.65)" }]}>
                    {t("weekly_title_label").toLocaleUpperCase(recapLocaleTag(locale))}
                  </AppText>
                  <AppText accessibilityRole="header" style={[head.h1, styles.mt12, { color: "#ffffff" }]}>
                    {review.recap.weeklyTitle?.label ?? t("weekly_title_fallback")}
                  </AppText>
                </>
              }
              support={
                <AppText style={[type.support, { color: "rgba(255,255,255,0.85)" }]}>
                  {review.recap.weeklyTitle?.message ?? review.recap.closingMessage}
                </AppText>
              }
            />
          </View>
        </Center>
      );
    }
    case "final":
      return (
        <Center tight>
          {finalCard ? (
            <FinalCardFrame reducedMotion={reducedMotion}>{finalCard}</FinalCardFrame>
          ) : (
            <Animated.View entering={riseIn(reducedMotion)} style={styles.column}>
              <AppText accessibilityRole="header" style={[head.h0, { color: "#ffffff" }]}>
                {t("final_title")}
              </AppText>
            </Animated.View>
          )}
        </Center>
      );
    default:
      // ponytail: spark and the PARTIAL slides never reach mobile (the card shows READY weeks only).
      return null;
  }
}

function WeeklyBest({
  review,
  beat,
  reducedMotion,
}: {
  review: WeeklyReviewDto;
  beat: WeeklyRecapTextBeat;
  reducedMotion: boolean;
}) {
  const t = useTranslations("recap");
  const { locale } = useLocale();
  const head = useHeadlineType();
  const source = getWeeklyBestStorySource(review);
  const focusSubject = review.rhythm.subjectBreakdown[0] ?? null;
  const planSubject = review.plan.subjectBreakdown[0] ?? null;
  const highlight = review.highlights[0] ?? null;
  const title =
    source === "focus_subject"
      ? focusSubject?.subjectName
      : source === "plan_subject"
        ? planSubject?.subjectName
        : highlight
          ? highlightDisplayValue(highlight, locale, t)
          : t("weekly_best_fallback");
  const message =
    source === "focus_subject"
      ? t("weekly_best_focus_subject", { minutes: focusSubject?.focusMinutes ?? 0 })
      : source === "plan_subject"
        ? t("weekly_best_plan_subject", { count: planSubject?.completedTaskCount ?? 0 })
        : (highlight?.message ?? t("weekly_best_fallback_message"));

  return (
    <TextBeat
      beat={beat}
      reducedMotion={reducedMotion}
      headline={
        <>
          <AppText style={type.eyebrow}>{t("weekly_best_eyebrow").toLocaleUpperCase(recapLocaleTag(locale))}</AppText>
          <View style={styles.badgeWrap}>
            <View style={styles.badgeShadow} />
            <View style={styles.badge}>
              <AppText style={styles.badgeText}>{title}</AppText>
            </View>
          </View>
        </>
      }
      support={
        <>
          <AppText accessibilityRole="header" style={head.h1}>
            {t("weekly_best_title")}
          </AppText>
          <AppText style={[type.support, styles.mt24, { fontSize: 20 }]}>{message}</AppText>
        </>
      }
    />
  );
}

function highlightDisplayValue(highlight: WeeklyRecapHighlightDto, locale: string, t: Translate): string {
  switch (highlight.kind) {
    case "POSITIVE_COMPARISON":
      return t(`bests_comparison_${highlight.metric}`, { count: highlight.delta });
    case "LONGEST_SESSION":
      return t("bests_minutes", { count: highlight.minutes });
    case "TOP_FOCUS_SUBJECT":
    case "TOP_PLAN_SUBJECT":
      return highlight.subjectName;
    case "PEAK_FOCUS_DAY":
      return new Date(`${highlight.date}T12:00:00Z`).toLocaleDateString(recapLocaleTag(locale), {
        weekday: "long",
      });
    case "COMPLETED_TASKS":
      return t("bests_tasks", { count: highlight.completedTaskCount });
    case "MOCK_EXAMS":
      return t("bests_exams", { count: highlight.mockExamCount });
  }
}

/** Headline first, then the support line from 45 % of the slide (the web's `StoryTextBeat`). */
function TextBeat({
  beat,
  reducedMotion,
  headline,
  support,
}: {
  beat: WeeklyRecapTextBeat;
  reducedMotion: boolean;
  headline: ReactNode;
  support: ReactNode;
}) {
  return (
    <Animated.View key={beat} entering={riseIn(reducedMotion)} style={styles.column}>
      {beat === "headline" ? headline : support}
    </Animated.View>
  );
}

/** Fit the preview above the dock while leaving the captured card at its own size. */
function FinalCardFrame({ children, reducedMotion }: { children: ReactNode; reducedMotion: boolean }) {
  const { width } = useWindowDimensions();
  const [frameHeight, setFrameHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const scale = cardHeight > 0 ? Math.min(1, frameHeight / cardHeight) : 0;

  return (
    <View
      style={[styles.finalCardFrame, { width }]}
      onLayout={({ nativeEvent }) => setFrameHeight(nativeEvent.layout.height)}
    >
      <Animated.View
        entering={riseIn(reducedMotion)}
        onLayout={({ nativeEvent }) => setCardHeight(nativeEvent.layout.height)}
        style={styles.finalCardContent}
      >
        <View style={{ transform: [{ scale }], transformOrigin: "center top" }}>{children}</View>
      </Animated.View>
    </View>
  );
}

/** The copy's column, clear of the progress bars above and the final dock below. */
function Center({ children, top = false, tight = false }: { children: ReactNode; top?: boolean; tight?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.center,
        {
          justifyContent: top ? "flex-start" : "center",
          paddingTop: insets.top + (tight ? 72 : top ? 160 : 112),
          paddingBottom: insets.bottom + 144,
        },
      ]}
    >
      {children}
    </View>
  );
}

/** Puhu's idle float on the welcome slide. */
function Bob({ children, reducedMotion }: { children: ReactNode; reducedMotion: boolean }) {
  const wave = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    const ease = Easing.inOut(Easing.ease);
    wave.value = withRepeat(
      withSequence(withTiming(1, { duration: 1_900, easing: ease }), withTiming(0, { duration: 1_900, easing: ease })),
      -1,
    );
    return () => cancelAnimation(wave);
  }, [reducedMotion, wave]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -7 * wave.value }, { rotate: `${-0.8 * wave.value}deg` }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** h0/h1 at the window's `headlineScale`. */
function useHeadlineType() {
  const k = headlineScale(useWindowDimensions().width);
  return useMemo(
    () => ({
      h0: [type.h0, { fontSize: 48 * k, lineHeight: 46 * k, letterSpacing: -1.92 * k }],
      h1: [type.h1, { fontSize: 36 * k, lineHeight: 36 * k, letterSpacing: -1.44 * k }],
    }),
    [k],
  );
}

const black = RECAP.ink;
const centered: TextStyle = { maxWidth: 384, textAlign: "center", fontWeight: "900", color: black };

const type = StyleSheet.create({
  h0: { ...centered, fontSize: 48, lineHeight: 46, letterSpacing: -1.92 },
  h1: { ...centered, fontSize: 36, lineHeight: 36, letterSpacing: -1.44 },
  giant: { color: black, fontSize: 96, lineHeight: 100, fontWeight: "900", letterSpacing: -5.76 },
  unit: { color: black, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  support: { ...centered, fontSize: 24, lineHeight: 32, color: "rgba(0,0,0,0.7)" },
  note: { ...centered, maxWidth: 320, fontSize: 18, lineHeight: 24, color: "rgba(0,0,0,0.6)" },
  small: { color: "rgba(0,0,0,0.7)", fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" },
  eyebrow: { color: "rgba(0,0,0,0.55)", fontSize: 14, lineHeight: 20, fontWeight: "900", letterSpacing: 2.52 },
});

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  column: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  stretch: {
    alignSelf: "stretch",
  },
  finalCardFrame: {
    flex: 1,
    alignItems: "center",
    overflow: "hidden",
  },
  finalCardContent: {
    position: "absolute",
    top: 0,
  },
  lifted: {
    transform: [{ translateY: -200 }],
  },
  host: {
    width: 260,
    height: 260,
  },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  mt24: { marginTop: 24 },
  mt28: { marginTop: 28 },
  badgeWrap: {
    marginTop: 28,
    width: 256,
    height: 256,
  },
  // The web's hard `12px 12px 0` mint shadow.
  badgeShadow: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 256,
    height: 256,
    backgroundColor: RECAP.mint,
  },
  badge: {
    width: 256,
    height: 256,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 8,
    borderColor: black,
    backgroundColor: RECAP.coral,
  },
  badgeText: {
    color: black,
    fontSize: 36,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.8,
    textAlign: "center",
  },
});
