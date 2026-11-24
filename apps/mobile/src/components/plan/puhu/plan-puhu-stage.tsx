import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import {
  STAGE_TIMING,
  stageNoteIndex,
  stageNotes,
  stagePileDepth,
  type PlanAdaptationKnownWeek,
} from "@mentor/core";
import type { CoachPlanAdaptationBriefDto } from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import type { StageProgress } from "../../../lib/plan-puhu.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { AppText } from "../../ui/text.js";
import { STAGE_NIGHT, StageNotes, StageSky, StageVideo } from "./plan-puhu-stage-scene.js";

/**
 * "Şehrin üstünde" (the web's `PlanCoachAdaptationStage`): the wait between asking Puhu for a
 * preview and the preview itself. Puhu does magic over the night city while what Puhu read drops
 * in as paper notes. Every note is Puhu's own evidence, and the bar stays one segment short until
 * the answer lands. Drawn as a layer over the wizard inside the host modal.
 */
export function PlanPuhuStage({
  input,
  knownWeek,
  brief,
  progress,
  arrived,
  onDone,
  onCancel,
}: {
  input: CoachPlanAdaptationInput;
  knownWeek: PlanAdaptationKnownWeek;
  /** What Puhu read. Null when the wizard was skipped or its read failed. */
  brief: CoachPlanAdaptationBriefDto | null;
  /** The wizard's bar as it stood on its last step; null when the scene opens without the wizard. */
  progress: StageProgress | null;
  /** The answer landed: the scene closes itself and then calls `onDone`. */
  arrived: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("plan");
  const insets = useSafeAreaInsets();
  const { palette, radii } = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const [tick, setTick] = useState(0);

  // One clock: a new note every line. Reduced motion keeps it, the notes just do not travel.
  useEffect(() => {
    if (arrived) return;
    const timer = setInterval(() => setTick((value) => value + 1), STAGE_TIMING.lineMs);
    return () => clearInterval(timer);
  }, [arrived]);

  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!arrived) return;
    if (reduceMotion) {
      done.current();
      return;
    }
    const timer = setTimeout(() => done.current(), STAGE_TIMING.arrivalMs);
    return () => clearTimeout(timer);
  }, [arrived, reduceMotion]);

  const elapsed = tick * STAGE_TIMING.lineMs;
  const notes = stageNotes(brief);
  const plan = input.source === "PLAN";
  const title = arrived
    ? t(plan ? "coach_adaptation_stage_ready" : "coach_adaptation_stage_ready_lighten")
    : t(plan ? "coach_adaptation_stage_title" : "coach_adaptation_stage_title_lighten");
  const slow = !arrived && elapsed >= STAGE_TIMING.slowAfterMs;
  const sub = slow
    ? t("coach_adaptation_stage_slow")
    : (brief?.groundingLine ?? (knownWeek.pendingCount > 0 ? t("coach_adaptation_stage_sub") : null));

  // What the week is built from, in the student's own numbers.
  const parts =
    input.source === "PLAN"
      ? [
          input.studyWeekdays?.length
            ? t(input.studyWeekdays.length === 1 ? "coach_adaptation_stage_days_one" : "coach_adaptation_stage_days_other", {
                count: input.studyWeekdays.length,
              })
            : null,
          input.minutesPerDay != null ? t("coach_adaptation_stage_minutes", { count: input.minutesPerDay }) : null,
          input.focusSubjects?.length
            ? t(
                input.focusSubjects.length === 1
                  ? "coach_adaptation_stage_subjects_one"
                  : "coach_adaptation_stage_subjects_other",
                { count: input.focusSubjects.length },
              )
            : null,
        ]
      : [knownWeek.pendingCount > 0 ? t("coach_adaptation_known_pending", { count: knownWeek.pendingCount }) : null];
  const joined = parts.filter(Boolean).join(" · ");
  const caption = joined ? joined.charAt(0).toLocaleUpperCase("tr-TR") + joined.slice(1) : "";

  const ratio = progress ? (arrived ? progress.total : progress.done) / progress.total : 0;
  const shown = useSharedValue(ratio);
  useEffect(() => {
    shown.value = reduceMotion ? ratio : withTiming(ratio, { duration: 600 });
  }, [ratio, reduceMotion, shown]);
  const fill = useAnimatedStyle(() => ({ width: `${shown.value * 100}%` }));

  return (
    <View accessibilityViewIsModal style={StyleSheet.absoluteFill}>
      <StageSky />
      <View style={[styles.column, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.topBar}>
          <View style={styles.navSpacer} />
          <View
            accessibilityRole="progressbar"
            style={[styles.track, { backgroundColor: progress ? STAGE_NIGHT.track : "transparent", borderRadius: radii.pill }]}
          >
            {progress ? (
              <Animated.View style={[styles.fill, { backgroundColor: palette.ctaPlayBg, borderRadius: radii.pill }, fill]} />
            ) : null}
          </View>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={onCancel} style={styles.navAction}>
            <AppText variant="caption" numberOfLines={1} style={{ color: STAGE_NIGHT.lamp, fontWeight: "800" }}>
              {t("coach_adaptation_stage_cancel")}
            </AppText>
          </Pressable>
        </View>

        <View style={styles.heading}>
          <AppText accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          {/* Room for two lines, so Puhu does not jump when the line changes. */}
          <AppText
            accessibilityLiveRegion="polite"
            style={[styles.sub, { color: slow ? STAGE_NIGHT.lamp : STAGE_NIGHT.soft }]}
          >
            {sub ?? ""}
          </AppText>
        </View>

        <View style={styles.body}>
          <StageVideo reduceMotion={reduceMotion} />
          <StageNotes
            notes={notes}
            index={stageNoteIndex(elapsed, notes.length)}
            depth={stagePileDepth(elapsed, notes.length)}
            arrived={arrived}
            reduceMotion={reduceMotion}
          />
        </View>

        {caption ? <AppText style={styles.caption}>{caption}</AppText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  navSpacer: {
    width: 64,
  },
  navAction: {
    width: 64,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  track: {
    flex: 1,
    height: 8,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
  heading: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    color: STAGE_NIGHT.onNight,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  sub: {
    minHeight: 44,
    maxWidth: 440,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  body: {
    flex: 1,
    alignItems: "center",
    paddingTop: 8,
  },
  caption: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    color: STAGE_NIGHT.caption,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(3, 10, 24, 0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});
