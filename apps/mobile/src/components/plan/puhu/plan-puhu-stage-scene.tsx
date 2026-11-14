import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { BatteryHalfIcon } from "@solar-icons/react-native/linear/battery-half";
import { CalendarIcon } from "@solar-icons/react-native/linear/calendar";
import { CalendarMarkIcon } from "@solar-icons/react-native/linear/calendar-mark";
import { Chart2Icon } from "@solar-icons/react-native/linear/chart-2";
import { ChecklistIcon } from "@solar-icons/react-native/linear/checklist";
import { ClipboardListIcon } from "@solar-icons/react-native/linear/clipboard-list";
import { CompassIcon } from "@solar-icons/react-native/linear/compass";
import { FireIcon } from "@solar-icons/react-native/linear/fire";
import { MagicWand2Icon } from "@solar-icons/react-native/linear/magic-wand-2";
import { NotebookIcon } from "@solar-icons/react-native/linear/notebook";
import { PulseIcon } from "@solar-icons/react-native/linear/pulse";
import { StopwatchIcon } from "@solar-icons/react-native/linear/stopwatch";
import { TargetIcon } from "@solar-icons/react-native/linear/target";
import type { CoachUsedEvidenceDto } from "@mentor/types";
import { planStageArt } from "../../../lib/art.js";
import { useTranslations } from "../../../providers/i18n-provider.js";

/**
 * The stage's own night palette (the web's `plan-coach-stage.css`): always night, so it never
 * follows the app theme.
 */
export const STAGE_NIGHT = {
  sky: ["#0d0e25", "#0d0e25", "#132552", "#1b3563"],
  ground: "#08113A",
  onNight: "#ffffff",
  soft: "#c9d6ea",
  caption: "#e4ecf8",
  lamp: "#ffd15c",
  track: "rgba(255, 255, 255, 0.14)",
  paper: "#fffdf6",
  sheet1: "#f9f5ea",
  sheet2: "#f4efe2",
  ink: "#0f2233",
  label: "#1a5fa3",
  tape: "rgba(255, 224, 138, 0.88)",
} as const;

const HAND = "Caveat_700Bold";
/** The modal's fade and the keyboard's exit both end within this. */
const SETTLE_MS = 600;

/** Star specks: x %, y %, size, alpha (the web's radial dots). */
const STARS = [
  [11, 15, 1.4, 0.7],
  [88, 11, 1, 0.55],
  [79, 32, 1.2, 0.5],
  [20, 41, 1, 0.45],
  [50, 4, 1, 0.4],
  [69, 20, 1.3, 0.55],
  [33, 25, 1, 0.4],
] as const;

/** The night sky, its stars and the landing's city along the bottom (the web's `PlanCoachStageSky`). */
export function StageSky() {
  const { width, height } = useWindowDimensions();
  // The art is 3:2. The mid layer's tallest tower starts 31.2% down it; the lift keeps it 38% of
  // the screen above the bottom, under Puhu's video.
  const cityH = Math.max(Math.min(400, 0.42 * height), (2 / 3) * width);
  const cityW = 1.5 * cityH;
  const lift = 0.38 * height - 0.688 * cityH;
  const slack = (cityW - width) / 2;
  const layer = (bottom: number, shift = 0) => ({
    position: "absolute" as const,
    bottom,
    left: (width - cityW) / 2 + shift,
    width: cityW,
    height: cityH,
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={STAGE_NIGHT.sky[0]} />
            <Stop offset="0.5" stopColor={STAGE_NIGHT.sky[1]} />
            <Stop offset="0.74" stopColor={STAGE_NIGHT.sky[2]} />
            <Stop offset="1" stopColor={STAGE_NIGHT.sky[3]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sky)" />
      </Svg>
      {STARS.map(([x, y, size, alpha]) => (
        <View
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: size * 1.6,
            height: size * 1.6,
            borderRadius: size,
            backgroundColor: `rgba(255, 255, 255, ${alpha})`,
          }}
        />
      ))}
      <Image source={planStageArt.cityFar} style={layer(Math.min(0, lift + 20))} contentFit="fill" />
      <Image source={planStageArt.cityMid} style={layer(Math.min(-26, lift), Math.min(20, slack))} contentFit="fill" />
      <Image source={planStageArt.cityFront} style={layer(Math.min(-40, lift - 20))} contentFit="fill" />
      <Svg style={styles.shade}>
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="rgb(5, 12, 30)" stopOpacity="0" />
            <Stop offset="1" stopColor="rgb(5, 12, 30)" stopOpacity="0.78" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#shade)" />
      </Svg>
    </View>
  );
}

/** Puhu's magic loop in a soft round fade into the sky, so no edge of the clip shows. */
export function StageVideo({ reduceMotion }: { reduceMotion: boolean }) {
  const { height } = useWindowDimensions();
  const size = Math.min(320, Math.max(200, 0.34 * height));
  const [failed, setFailed] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const showLoop = !(reduceMotion || failed);
  // The clip loads once the scene has settled. A decoder started before the view's surface exists
  // (the modal still opening, the note keyboard still closing) moves to it mid-play, and the
  // emulator's decoder draws black after that move. ponytail: a fixed settle, not a surface event.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);
  const player = useVideoPlayer(showLoop && settled ? planStageArt.loop : null, (created) => {
    created.muted = true;
    created.loop = true;
    created.play();
  });

  useEffect(() => {
    const status = player.addListener("statusChange", ({ status: next }) => {
      if (next === "error") setFailed(true);
    });
    return () => status.remove();
  }, [player]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, backgroundColor: STAGE_NIGHT.ground }}
    >
      {showLoop ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          // A surface view punches through the Modal's window on Android (see chest-scene).
          surfaceType="textureView"
          onFirstFrameRender={() => setDrawn(true)}
        />
      ) : null}
      {/* Puhu's first frame (the clip's own) covers the player until it draws. */}
      {showLoop && drawn ? null : (
        <Image source={planStageArt.poster} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      {/* The web's mask: circle at 50% 46%, clear to 58% of the far-corner radius, sky by 68%. */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="fade"
            cx={size / 2}
            cy={size * 0.46}
            r={size * 0.736}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0.58" stopColor={STAGE_NIGHT.sky[0]} stopOpacity="0" />
            <Stop offset="0.68" stopColor={STAGE_NIGHT.sky[0]} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#fade)" />
      </Svg>
    </View>
  );
}

/** What each kind of evidence looks like on its note; an unknown kind gets the wand. */
const GLYPH: Partial<Record<string, ComponentType<{ size?: number; color?: string }>>> = {
  MOCK_PERFORMANCE: ClipboardListIcon,
  WEAK_SUBJECTS: TargetIcon,
  NOTEBOOK_TOPICS: NotebookIcon,
  LONG_TERM_RHYTHM: PulseIcon,
  RECENT_RHYTHM: PulseIcon,
  SUBJECT_BALANCE: Chart2Icon,
  PLAN_FOLLOW_THROUGH: ChecklistIcon,
  STREAK: FireIcon,
  MOOD: BatteryHalfIcon,
  GOAL: CompassIcon,
  EXAM_PHASE: CalendarIcon,
  TODAY_PLAN: CalendarMarkIcon,
  TODAY_FOCUS: StopwatchIcon,
  ACTION_OUTCOME: MagicWand2Icon,
};

/**
 * What Puhu read, one paper note at a time, dropping onto a small pile (the web's
 * `PlanCoachStageNotes`). The pile is for the eye only; screen readers get every note once.
 */
export function StageNotes({
  notes,
  index,
  depth,
  arrived,
  reduceMotion,
}: {
  notes: CoachUsedEvidenceDto[];
  index: number;
  depth: 0 | 1 | 2;
  arrived: boolean;
  reduceMotion: boolean;
}) {
  const t = useTranslations("planEvidence");
  const leave = useSharedValue(0);
  useEffect(() => {
    if (arrived && !reduceMotion) leave.value = withTiming(1, { duration: 1200, easing: Easing.in(Easing.ease) });
  }, [arrived, reduceMotion, leave]);
  const leaving = useAnimatedStyle(() => ({
    opacity: interpolate(leave.value, [0, 0.18, 1], [1, 1, 0]),
    transform: [{ translateY: interpolate(leave.value, [0, 0.18, 1], [0, -14, 48]) }],
  }));

  const note = notes[index];
  if (!note) return null;
  const label = (type: string) => {
    const text = t(type as "OTHER");
    return text === type ? t("OTHER") : text;
  };

  return (
    <>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.pile, leaving]}
      >
        {depth >= 2 ? <View style={[styles.sheet, styles.sheet2]} /> : null}
        {depth >= 1 ? <View style={[styles.sheet, styles.sheet1]} /> : null}
        {/* Keyed by the note, so each new one drops in. */}
        <DroppingNote key={index} reduceMotion={reduceMotion}>
          <View style={styles.tape} />
          <View style={styles.labelRow}>
            <NoteGlyph type={note.type} />
            <Text numberOfLines={1} style={styles.hand}>
              {label(note.type)}
            </Text>
          </View>
          <Text numberOfLines={4} style={styles.summary}>
            {note.summary}
          </Text>
        </DroppingNote>
      </Animated.View>
      <View
        accessible
        accessibilityLabel={notes.map((item) => `${label(item.type)}: ${item.summary}`).join("\n")}
        style={styles.srOnly}
      />
    </>
  );
}

function NoteGlyph({ type }: { type: string }) {
  const Glyph = GLYPH[type] ?? MagicWand2Icon;
  return <Glyph size={20} color={STAGE_NIGHT.label} />;
}

/** A note falls from under Puhu, lands with a small bounce and settles a little crooked. */
function DroppingNote({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
  const drop = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) drop.value = withTiming(1, { duration: 900, easing: Easing.bezier(0.3, 0.7, 0.3, 1) });
  }, [drop, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(drop.value, [0, 0.52, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(drop.value, [0, 0.52, 0.75, 1], [-150, 8, -2, 0]) },
      { rotate: `${interpolate(drop.value, [0, 0.52, 0.75, 1], [-10, 0.5, -2, -1.5])}deg` },
      { scale: interpolate(drop.value, [0, 0.52, 1], [0.9, 1, 1]) },
    ],
  }));
  return <Animated.View style={[styles.paper, style]}>{children}</Animated.View>;
}

const PAPER_RADII = {
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  borderBottomLeftRadius: 7,
  borderBottomRightRadius: 7,
} as const;

const styles = StyleSheet.create({
  shade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  pile: {
    marginTop: 8,
    width: "100%",
    maxWidth: 460,
    height: 168,
  },
  sheet: {
    ...PAPER_RADII,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 6,
    shadowColor: "#030a18",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 12 },
  },
  sheet1: {
    top: 4,
    backgroundColor: STAGE_NIGHT.sheet1,
    transform: [{ rotate: "-3deg" }],
  },
  sheet2: {
    top: 10,
    backgroundColor: STAGE_NIGHT.sheet2,
    transform: [{ rotate: "3.2deg" }],
  },
  paper: {
    ...PAPER_RADII,
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    gap: 6,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    backgroundColor: STAGE_NIGHT.paper,
    elevation: 10,
    shadowColor: "#030a18",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 16 },
  },
  tape: {
    position: "absolute",
    top: -10,
    left: "50%",
    marginLeft: -39,
    width: 78,
    height: 22,
    borderRadius: 2,
    backgroundColor: STAGE_NIGHT.tape,
    transform: [{ rotate: "-3deg" }],
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hand: {
    flexShrink: 1,
    fontFamily: HAND,
    fontSize: 26,
    lineHeight: 30,
    color: STAGE_NIGHT.label,
  },
  summary: {
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    lineHeight: 23,
    color: STAGE_NIGHT.ink,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
  },
});
