import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { formatDateLabel, formatMonthDayShort, isPastDate, todayIso, weekDates } from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { cardShadow } from "../../lib/layout.js";
import {
  activeTimelineDay,
  railFillRatio,
  timelineEndSpace,
  TIMELINE_RAIL_X,
  timelinePinTarget,
  timelineSnapOffsets,
  scrollSync,
} from "../../lib/plan-timeline.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText } from "../ui/text.js";
import { PlanTimelineDay } from "./plan-timeline-day.js";
import { PlanTimelineSkeleton } from "./plan-timeline-skeleton.js";

const BADGE = 36;
const NO_TASKS: PlanTaskDto[] = [];
const RAIL_INSET = 8;
const CONTENT_PAD = 16; // the content container's vertical padding, 5.6 + 10.4
/** How long our own scroll stays ours: the web's 420ms day-to-day settle, 80ms for a jump. */
const SETTLE_MS = 420;
const JUMP_MS = 80;
const FILL = { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const SPRING = { stiffness: 420, damping: 34, mass: 1 }; // framer-motion's mass; Reanimated 4's is 4

type DayBox = { top: number; height: number };

/**
 * The web's `PlanTimelineView` at phone width: the week on a rail inside its own scroller. The
 * day nearest the top is active (badge, rail fill) and drives the week card's selection; a day
 * picked outside (strip, dot, date sheet) scrolls into place. Each week opens pinned, hidden
 * under the skeleton until its tasks are in and it is pinned, so it never scrolls from Monday.
 */
export function PlanTimeline({
  weekAnchor,
  weekTasks,
  loading,
  selectedDate,
  scrollRequest,
  busyId,
  onSelectDate,
  onActiveDayChange,
  onAdd,
  onToggle,
  onOpenMenu,
  onStartSession,
}: {
  weekAnchor: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  loading: boolean;
  selectedDate: string;
  /** Bumped by every pick outside the scroller (strip, dot, date sheet); see `scrollSync`. */
  scrollRequest: number;
  busyId: string | null;
  /** A dot tap, a pick like the strip's. */
  onSelectDate: (iso: string) => void;
  /** The day the scroller reached on its own, or the pin's choice: no scroll request. */
  onActiveDayChange: (iso: string) => void;
  onAdd: () => void;
  onToggle: (task: PlanTaskDto) => void;
  onOpenMenu: (task: PlanTaskDto) => void;
  onStartSession: (task: PlanTaskDto) => void;
}) {
  const { palette, radii } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const scrollerHeight = Math.min(448, 0.52 * windowHeight);
  const days = useMemo(() => weekDates(weekAnchor), [weekAnchor]);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const [boxes, setBoxes] = useState<Record<string, DayBox>>({});
  const [viewport, setViewport] = useState(0);
  const [boxHeight, setBoxHeight] = useState(0);
  const [activeIso, setActiveIso] = useState(selectedDate);
  const [readyWeek, setReadyWeek] = useState<string | null>(null);
  // Each visit to a week is measured and pinned afresh, a quick return before the next loaded too.
  const [visitWeek, setVisitWeek] = useState(weekAnchor);
  if (visitWeek !== weekAnchor) {
    setVisitWeek(weekAnchor);
    setBoxes({});
    setReadyWeek(null);
  }
  const ready = readyWeek === weekAnchor;

  const entered = useRef(false);
  const handled = useRef(scrollRequest);
  const emitted = useRef(selectedDate);
  const shown = useRef(false);
  const suppress = useRef(false);
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ours = useCallback((ms: number) => {
    suppress.current = true;
    if (suppressTimer.current) clearTimeout(suppressTimer.current);
    suppressTimer.current = setTimeout(() => {
      suppress.current = false;
    }, ms);
  }, []);
  useEffect(() => () => {
    if (suppressTimer.current) clearTimeout(suppressTimer.current);
  }, []);

  const onDayLayout = useCallback(
    (iso: string, top: number, height: number) => {
      if (!days.includes(iso)) return;
      setBoxes((prev) => (prev[iso]?.top === top && prev[iso].height === height ? prev : { ...prev, [iso]: { top, height } }));
    },
    [days],
  );

  const allMeasured = viewport > 0 && days.every((iso) => boxes[iso]);

  useEffect(() => {
    const action = scrollSync({
      range: weekAnchor,
      pinnedRange: readyWeek,
      loading,
      measured: allMeasured,
      request: scrollRequest,
      handled: handled.current,
    });
    if (action === "wait" || action === "none") return;
    const pin = action === "pin";
    // Entry pins to today (or the selected day); a week change or a waiting pick, to the selection.
    const entry = pin && !entered.current && scrollRequest === handled.current;
    const target = entry ? timelinePinTarget(days, todayIso(), selectedDate) : selectedDate;
    handled.current = scrollRequest;
    emitted.current = target;
    setActiveIso(target);
    const animated = !pin && !reduceMotion;
    ours(animated ? SETTLE_MS : JUMP_MS);
    scrollRef.current?.scrollTo({ y: boxes[target]?.top ?? 0, animated });
    if (!pin) return;
    entered.current = true;
    setReadyWeek(weekAnchor);
    if (target !== selectedDate) onActiveDayChange(target);
  }, [allMeasured, boxes, days, loading, onActiveDayChange, ours, readyWeek, reduceMotion, scrollRequest, selectedDate, weekAnchor]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!ready) return;
    const tops = days.flatMap((iso) => (boxes[iso] ? [{ iso, top: boxes[iso].top }] : []));
    const active = activeTimelineDay(tops, event.nativeEvent.contentOffset.y);
    // During our own scroll the target is already active; passing days must not flip it back.
    if (!active || suppress.current) return;
    setActiveIso(active);
    if (active === emitted.current) return;
    emitted.current = active;
    onActiveDayChange(active);
    AccessibilityInfo.announceForAccessibility(formatDateLabel(active, locale, t("today"), { alwaysFull: true }));
  };

  const activeTop = boxes[activeIso]?.top ?? 0;
  const railHeight = Math.max(0, boxHeight - RAIL_INSET * 2);
  const ratio = railFillRatio(activeTop, railHeight);
  const badgeTop = useSharedValue(activeTop);
  const fill = useSharedValue(ratio);
  useEffect(() => {
    // Only a move the reader watches springs; the first frame after the cover lifts just lands.
    const animate = ready && shown.current && !reduceMotion;
    shown.current = ready;
    badgeTop.value = animate ? withSpring(activeTop, SPRING) : activeTop;
    fill.value = animate ? withTiming(ratio, FILL) : ratio;
  }, [activeTop, badgeTop, fill, ratio, ready, reduceMotion]);
  // Transforms, not `top`/`height`: animated layout props lagged seconds behind on Fabric.
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ translateY: badgeTop.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: fill.value }] }));

  const snapOffsets = allMeasured
    ? timelineSnapOffsets(days.map((iso) => boxes[iso]!.top), days.map((iso) => boxes[iso]!.height), viewport)
    : undefined;
  const badge = formatMonthDayShort(activeIso, locale);

  return (
    <PanelCard style={styles.card}>
      {isPastDate(selectedDate) ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("add_task")}
          hitSlop={4}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.add,
            { borderColor: palette.border, borderRadius: radii.card, backgroundColor: palette.surface },
            pressed && styles.pressed,
          ]}
        >
          <AddIcon size={20} color={palette.main} />
        </Pressable>
      )}
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        scrollEventThrottle={16}
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        accessibilityLabel={t("timeline_scroll_aria")}
        onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
        onScroll={onScroll}
        style={[{ height: scrollerHeight }, !ready && styles.hidden]}
        contentContainerStyle={styles.content}
      >
        <View onLayout={(event) => setBoxHeight(event.nativeEvent.layout.height)}>
          <View pointerEvents="none" style={styles.rail}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.progressTrack }]} />
            <Animated.View style={[styles.fill, { backgroundColor: palette.progress }, fillStyle]} />
          </View>
          {loading ? null : days.map((iso) => (
            <PlanTimelineDay
              key={iso}
              iso={iso}
              tasks={weekTasks[iso] ?? NO_TASKS}
              active={iso === activeIso}
              busyId={busyId}
              onLayout={onDayLayout}
              onSelect={onSelectDate}
              onToggle={onToggle}
              onOpenMenu={onOpenMenu}
              onStartSession={onStartSession}
            />
          ))}
          <Animated.View
            pointerEvents="none"
            style={[styles.badge, cardShadow, { backgroundColor: palette.progress, borderColor: palette.surface }, badgeStyle]}
          >
            <AppText style={styles.badgeText}>{badge.day}</AppText>
            <AppText style={styles.badgeText}>{badge.month}</AppText>
          </Animated.View>
          <View style={{ height: timelineEndSpace(scrollerHeight, boxes[days[6]!]?.height, CONTENT_PAD) }} />
        </View>
      </ScrollView>
      {ready ? null : (
        <View pointerEvents="none" style={[styles.cover, { backgroundColor: palette.surface }]}>
          <PlanTimelineSkeleton />
        </View>
      )}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, paddingTop: 40, overflow: "hidden" },
  add: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 2,
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  hidden: { opacity: 0 },
  content: { paddingTop: 5.6, paddingRight: 28, paddingBottom: 10.4, paddingLeft: 5.6 },
  rail: { position: "absolute", top: RAIL_INSET, bottom: RAIL_INSET, left: TIMELINE_RAIL_X - 1, width: 2 },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, transformOrigin: "top" },
  badge: {
    position: "absolute",
    top: 0,
    left: TIMELINE_RAIL_X - BADGE / 2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badgeText: { color: "#FFFFFF", fontSize: 9, lineHeight: 10, fontWeight: "700" },
  cover: { position: "absolute", top: 40, left: 12, right: 12, bottom: 12 },
});
