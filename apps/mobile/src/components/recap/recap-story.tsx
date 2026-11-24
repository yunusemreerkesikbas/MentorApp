import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BackHandler, PanResponder, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInRight, FadeInUp, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path, Rect } from "react-native-svg";
import { useQueryClient } from "@tanstack/react-query";
import {
  composeWeeklyRecapStory,
  shouldNavigateAfterWeeklyRecapPress,
  weeklyRecapFinalActionsVisible,
} from "@mentor/core";
import type { WeeklyReviewDto } from "@mentor/types";
import { completeWeeklyReview } from "../../lib/coaching-api.js";
import { useCelebrations } from "../../providers/celebration-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { AppText } from "../ui/text.js";
import { RECAP, STORY_COLORS } from "./recap-colors.js";
import { createRecapCompletion } from "./recap-flow.js";
import { RecapNoteSheet } from "./recap-note-sheet.js";
import { RecapSharePreview } from "./recap-share-preview.js";
import { RecapSlide } from "./recap-slides.js";
import { useRecapPlayback } from "./use-recap-playback.js";
import { useRecapShare } from "./use-recap-share.js";

const SWIPE_THRESHOLD_PX = 56;

/**
 * The weekly story (the web's `WeeklyRecapStory` at phone width): progress bars, play and close,
 * tap halves (a press held past 300 ms only pauses), a horizontal swipe, and final-slide actions.
 * The week counts as reviewed once those actions show.
 */
export function RecapStory({
  review,
  examId,
  narration,
  onExit,
  onAddPlan,
  onOpenAnalysis,
}: {
  review: WeeklyReviewDto;
  examId: string;
  narration?: string;
  onExit: () => void;
  onAddPlan: (task: NonNullable<WeeklyReviewDto["suggestedTask"]>) => void;
  onOpenAnalysis?: () => void;
}) {
  const t = useTranslations("recap");
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const slides = useMemo(() => composeWeeklyRecapStory(review), [review]);
  const playback = useRecapPlayback(slides, reducedMotion);
  const { state, goBack, goForward, setHeld, togglePlaying, replay } = playback;
  const [noteOpen, setNoteOpen] = useState(false);
  const { cardRef, onImageReady, share, sharing, ready } = useRecapShare();
  const suggestion = review.suggestedTask;
  const showNote = (open: boolean) => {
    setNoteOpen(open);
    setHeld(open);
  };
  const slide = slides[state.index] ?? slides[0];
  const finalVisible = slide ? weeklyRecapFinalActionsVisible(slide, state) : false;
  // Only `refresh`: the context value also changes with `active`, and a new completion would PUT again.
  const { refresh: refreshCelebrations } = useCelebrations();
  const weekStart = review.period.startDate;
  const complete = useMemo(
    () =>
      createRecapCompletion(
        () => completeWeeklyReview(examId, weekStart),
        () => {
          // The PUT grants "week_reflected": fetch it now, so it is waiting when the story closes.
          refreshCelebrations();
          void queryClient.invalidateQueries({ queryKey: ["coaching", "today"] });
          void queryClient.invalidateQueries({ queryKey: ["economy"] });
        },
      ),
    [refreshCelebrations, examId, weekStart, queryClient],
  );

  useEffect(() => {
    if (finalVisible) complete();
  }, [finalVisible, complete]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onExit();
      return true;
    });
    return () => subscription.remove();
  }, [onExit]);

  const swipe = useMemo(() => {
    // The swipe is measured from where the finger landed: the grant zeroes the gesture's own dx,
    // and on a busy JS thread it comes late, after most of the drag.
    let startX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: (event) => {
        startX = event.nativeEvent.pageX;
        return false;
      },
      // Capture, so a sideways drag wins over the tap halves underneath.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => setHeld(true),
      onPanResponderRelease: (event) => {
        setHeld(false);
        const dx = event.nativeEvent.pageX - startX;
        if (dx <= -SWIPE_THRESHOLD_PX) goForward();
        else if (dx >= SWIPE_THRESHOLD_PX) goBack();
      },
      onPanResponderTerminate: () => setHeld(false),
    });
  }, [goBack, goForward, setHeld]);

  if (!slide) return null;
  const isFirst = state.index === 0;
  const isLast = state.index === slides.length - 1;
  const ground = STORY_COLORS[slide.kind];
  const darkGround = ground === RECAP.ink;
  const mediaPlaying = state.playing && playback.pageVisible && !playback.held;

  return (
    <View style={[styles.screen, { backgroundColor: ground }]} {...swipe.panHandlers}>
      <StatusBar style={darkGround ? "light" : "dark"} />
      <Animated.View
        key={`${slide.kind}-${state.index}`}
        // The cover can mount while the native screen is still entering from the archive.
        entering={isFirst ? undefined : reducedMotion ? FadeIn.duration(120) : FadeInRight.duration(420)}
        style={[StyleSheet.absoluteFill, { backgroundColor: ground }]}
        accessibilityLiveRegion="polite"
      >
        <RecapSlide
          slide={slide}
          review={review}
          elapsedMs={state.elapsedMs}
          playing={mediaPlaying}
          reducedMotion={reducedMotion}
          finalCard={finalVisible ? (
            <RecapSharePreview review={review} cardRef={cardRef} onImageReady={onImageReady} />
          ) : null}
        />
      </Animated.View>

      {/* Outside the keyed slide: a tap queued on a busy JS thread would otherwise land on the zone the last tap unmounted. */}
      <View style={styles.zones}>
        <TapZone label={t("previous")} disabled={isFirst} onNavigate={goBack} onHeldChange={setHeld} />
        <TapZone label={t("next")} disabled={isLast} onNavigate={goForward} onHeldChange={setHeld} />
      </View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("progress", { current: state.index + 1, total: slides.length })}
        style={[styles.progress, { top: insets.top + 8 }]}
      >
        {slides.map((item, index) => {
          const ratio = index < state.index ? 1 : index === state.index ? playback.progress : 0;
          return (
            <View key={`${item.kind}-${index}`} style={styles.track}>
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
            </View>
          );
        })}
      </View>

      <View style={[styles.controls, { top: insets.top + 20 }]}>
        <Control
          label={state.completed ? t("controls_replay") : state.playing ? t("controls_pause") : t("controls_play")}
          onPress={togglePlaying}
        >
          {state.completed ? <ReplayGlyph /> : state.playing ? <PauseGlyph /> : <PlayGlyph />}
        </Control>
        <Control label={t("exit")} onPress={onExit}>
          <CloseGlyph />
        </Control>
      </View>

      {finalVisible ? (
        <Animated.View
          entering={reducedMotion ? FadeIn.duration(120) : FadeInUp.duration(400)}
          style={[styles.dockWrap, { bottom: insets.bottom + 12 }]}
        >
          <View style={styles.dock}>
            {suggestion?.title.trim() ? (
              <DockAction label={t("final_add_plan")} onPress={() => onAddPlan(suggestion)} />
            ) : null}
            <DockAction
              label={t("final_share")}
              onPress={share}
              disabled={!ready || sharing}
              busy={sharing}
            />
            <DockAction label={t("final_puhu_note")} onPress={() => showNote(true)} />
          </View>
          <View style={styles.dock}>
            {onOpenAnalysis ? <DockAction label={t("final_deep_analysis")} onPress={onOpenAnalysis} /> : null}
            <DockAction label={t("final_replay")} onPress={replay} />
            <DockAction label={t("final_done")} onPress={onExit} strong />
          </View>
        </Animated.View>
      ) : null}
      {noteOpen ? (
        <RecapNoteSheet
          closingMessage={review.recap.closingMessage}
          narration={narration}
          onClose={() => showNote(false)}
        />
      ) : null}
    </View>
  );
}

/**
 * Half the slide: a tap moves on, a press held past 300 ms only pauses. The press is timed with the
 * touch's own timestamps (a busy JS thread would turn quick taps into holds), and `onPress` lets go
 * itself: a tap under 130 ms delays `onPressOut` past the slide change.
 */
function TapZone({
  label,
  disabled,
  onNavigate,
  onHeldChange,
}: {
  label: string;
  disabled: boolean;
  onNavigate: () => void;
  onHeldChange: (held: boolean) => void;
}) {
  const startedAt = useRef<number | null>(null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={styles.zone}
      onPressIn={(event) => {
        startedAt.current = event.nativeEvent.timestamp;
        onHeldChange(true);
      }}
      onPressOut={() => onHeldChange(false)}
      onPress={(event) => {
        onHeldChange(false);
        const duration = startedAt.current === null ? 0 : event.nativeEvent.timestamp - startedAt.current;
        startedAt.current = null;
        if (shouldNavigateAfterWeeklyRecapPress(duration)) onNavigate();
      }}
    />
  );
}

function Control({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
    >
      {children}
    </Pressable>
  );
}

function DockAction({ label, onPress, strong = false, disabled = false, busy = false }: {
  label: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.dockAction, strong && styles.dockStrong, (pressed || disabled) && styles.controlPressed]}
    >
      <AppText style={[styles.dockLabel, strong && styles.dockLabelStrong]}>{label}</AppText>
    </Pressable>
  );
}

// lucide's Play, Pause, RotateCcw and X, drawn inline like the header's Coin glyph.
const glyph = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "#ffffff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const PlayGlyph = () => (
  <Svg {...glyph}>
    <Path d="M6 3l14 9-14 9z" />
  </Svg>
);
const PauseGlyph = () => (
  <Svg {...glyph}>
    <Rect x={14} y={4} width={4} height={16} rx={1} />
    <Rect x={6} y={4} width={4} height={16} rx={1} />
  </Svg>
);
const ReplayGlyph = () => (
  <Svg {...glyph}>
    <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
  </Svg>
);
const CloseGlyph = () => (
  <Svg {...glyph}>
    <Path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
  },
  zones: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
  },
  zone: {
    flex: 1,
  },
  progress: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
  },
  track: {
    flex: 1,
    height: 4,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  controls: {
    position: "absolute",
    right: 12,
    flexDirection: "row",
    gap: 6,
  },
  control: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  controlPressed: {
    opacity: 0.75,
  },
  dockWrap: {
    position: "absolute",
    gap: 6,
    left: 16,
    right: 16,
  },
  dock: {
    flexDirection: "row",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  dockAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  dockStrong: {
    backgroundColor: "#ffffff",
  },
  dockLabel: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  dockLabelStrong: {
    color: RECAP.ink,
  },
});
