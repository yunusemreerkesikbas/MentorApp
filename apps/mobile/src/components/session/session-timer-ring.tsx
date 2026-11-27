import { useMemo, useRef } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { MinusIcon } from "@solar-icons/react-native/linear/minus";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { formatTimerDisplay } from "@mentor/core";
import {
  SESSION_FOCUS_MINUTES_MAX,
  SESSION_FOCUS_MINUTES_MIN,
  SESSION_FOCUS_MINUTES_STEP,
  type SessionPresetDto,
} from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import {
  angleFromMinutes,
  angleFromPoint,
  clampMinutes,
  minutesFromAngle,
  TIMER_TICK_COUNT,
  timerTickLine,
} from "../../lib/session-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { AppText } from "../ui/index.js";
import { useStageLook } from "./session-stage.js";

const MIN = SESSION_FOCUS_MINUTES_MIN;
const MAX = SESSION_FOCUS_MINUTES_MAX;
const STEP = SESSION_FOCUS_MINUTES_STEP;
const HANDLE_RADIUS = 12;

/**
 * The web's `CircularTimerRing` + `SessionTimerRing`: in setup a dial you drag (or nudge with
 * −/+) and the preset pills under it; while running a read-only countdown or stopwatch ring.
 */
export function SessionTimerRing({
  phase,
  size,
  focusMinutes,
  breakMinutes,
  secondsLeft,
  isStopwatch,
  focusElapsed,
  presets,
  selectedPresetId,
  onMinutesChange,
  onPresetSelect,
  onStopwatchSelect,
}: {
  phase: "idle" | "focus" | "break" | "done";
  size: number;
  focusMinutes: number;
  breakMinutes: number;
  secondsLeft: number;
  isStopwatch: boolean;
  focusElapsed: number;
  presets: SessionPresetDto[];
  selectedPresetId: string | null;
  onMinutesChange: (minutes: number) => void;
  onPresetSelect: (preset: SessionPresetDto) => void;
  onStopwatchSelect: () => void;
}) {
  const t = useTranslations("session");
  const { locale } = useLocale();
  const look = useStageLook();
  const isIdle = phase === "idle";
  const countdown = phase === "focus" || phase === "break";
  const mode = isStopwatch ? "stopwatch" : countdown ? "countdown" : "setup";
  const interactive = mode === "setup";
  const stroke = mode === "countdown" ? 10 : 8;
  const radius = (size - stroke) / 2 - HANDLE_RADIUS;
  const c = size / 2;
  const circumference = 2 * Math.PI * radius;
  const reference = phase === "break" ? breakMinutes : focusMinutes;
  const progress = mode === "stopwatch" ? 0
    : mode === "countdown" ? (reference > 0 ? secondsLeft / (reference * 60) : 0)
    : (focusMinutes - MIN) / (MAX - MIN);
  const clamped = Math.min(1, Math.max(0, progress));
  const angle = mode === "countdown" ? clamped * 360 : angleFromMinutes(focusMinutes, MIN, MAX);
  const handle = ((angle - 90) * Math.PI) / 180;
  const hx = c + radius * Math.cos(handle);
  const hy = c + radius * Math.sin(handle);

  // ponytail: the latest props through a ref, so the responder is built once.
  const latest = useRef({ interactive, onMinutesChange, focusMinutes });
  latest.current = { interactive, onMinutesChange, focusMinutes };
  const pan = useMemo(() => {
    const apply = (x: number, y: number) => {
      const next = minutesFromAngle(angleFromPoint(x - c, y - c), MIN, MAX, STEP);
      if (next !== latest.current.focusMinutes) {
        haptics.selection();
        latest.current.onMinutesChange(next);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.interactive,
      onMoveShouldSetPanResponder: () => latest.current.interactive,
      // Holding the dial keeps the scroll view from taking the gesture mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => apply(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => apply(e.nativeEvent.locationX, e.nativeEvent.locationY),
    });
  }, [c]);

  const primary = mode === "stopwatch" ? formatTimerDisplay(focusElapsed)
    : mode === "countdown" ? formatTimerDisplay(secondsLeft) : String(focusMinutes);
  const secondary = isStopwatch ? t(isIdle ? "stopwatch" : "elapsed") : mode === "countdown" ? t("ring_left") : t("ring_minutes");

  const nudge = (delta: number) => {
    haptics.selection();
    onMinutesChange(clampMinutes(focusMinutes + delta, MIN, MAX, STEP));
  };

  return (
    <View style={styles.column}>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole={interactive ? "adjustable" : "timer"}
        accessibilityLabel={interactive ? t("ring_slider_label") : secondary}
        accessibilityValue={interactive ? { min: MIN, max: MAX, now: focusMinutes, text: t("ring_minutes_value", { minutes: focusMinutes }) } : { text: primary }}
        accessibilityActions={interactive ? [{ name: "increment" }, { name: "decrement" }] : undefined}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? STEP : -STEP)}
        style={{ width: size, height: size }}
      >
        <Svg width={size} height={size} pointerEvents="none">
          {Array.from({ length: TIMER_TICK_COUNT }, (_, index) => {
            const tick = timerTickLine(index, c, c, radius);
            return (
              <Line key={index} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke={look.ink}
                strokeOpacity={tick.major ? 0.45 : 0.22} strokeWidth={tick.major ? 2 : 1} strokeLinecap="round" />
            );
          })}
          <Circle cx={c} cy={c} r={radius} fill="none" stroke={look.track} strokeWidth={stroke} />
          <Circle cx={c} cy={c} r={radius} fill="none" stroke={look.progress} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)} rotation={-90} originX={c} originY={c} />
          {mode === "countdown" ? (
            <Circle cx={hx} cy={hy} r={7} fill={look.progress} stroke="#FFFFFF" strokeWidth={2} />
          ) : null}
          {interactive ? (
            <Circle cx={hx} cy={hy} r={HANDLE_RADIUS} fill={look.scenic ? "#F4EFE6" : look.ink} stroke="#FFFFFF" strokeWidth={3} />
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <AppText tabularNums style={[styles.primary, { color: look.ink, fontSize: size >= 260 ? 64 : 52, lineHeight: size >= 260 ? 72 : 60 }]}>
            {primary}
          </AppText>
          <AppText style={[styles.secondary, { color: look.inkSoft }]}>{secondary.toLocaleUpperCase(locale)}</AppText>
        </View>
      </View>

      {interactive ? (
        <View style={styles.row}>
          <RoundButton label={t("ring_decrease", { step: STEP })} onPress={() => nudge(-STEP)}>
            <MinusIcon size={20} color={look.ink} />
          </RoundButton>
          <RoundButton label={t("ring_increase", { step: STEP })} onPress={() => nudge(STEP)}>
            <AddIcon size={20} color={look.ink} />
          </RoundButton>
        </View>
      ) : null}

      {isIdle ? (
        <View style={styles.presets} accessibilityRole="radiogroup" accessibilityLabel={t("preset_group")}>
          <PresetPill label={t("stopwatch")} selected={isStopwatch} onPress={onStopwatchSelect} />
          {presets.map((preset) => (
            <PresetPill key={preset.id} label={preset.label} selected={!isStopwatch && selectedPresetId === preset.id}
              onPress={() => onPresetSelect(preset)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  const look = useStageLook();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.round, {
        backgroundColor: look.glass, borderColor: look.glassBorder, transform: [{ scale: pressed ? 0.95 : 1 }],
      }]}>
      {children}
    </Pressable>
  );
}

function PresetPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const look = useStageLook();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }}
      onPress={() => { haptics.selection(); onPress(); }}
      style={({ pressed }) => [styles.pill, {
        backgroundColor: selected ? look.selected : look.glass,
        borderColor: selected ? (look.scenic ? look.selected : look.progress) : look.glassBorder,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }]}>
      <AppText numberOfLines={1} style={[styles.pillLabel, { color: selected ? look.selectedInk : look.ink }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: "center", gap: 20 },
  center: { alignItems: "center", justifyContent: "center" },
  primary: { fontWeight: "800" },
  secondary: { fontSize: 14, fontWeight: "700", letterSpacing: 0.6 },
  row: { flexDirection: "row", gap: 12, marginTop: -4 },
  round: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  presets: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  pill: { minHeight: 48, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pillLabel: { fontSize: 15, fontWeight: "800" },
});
