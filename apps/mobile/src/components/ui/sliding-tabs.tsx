import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { haptics } from "../../lib/haptics.js";
import { cardShadow, mixHex } from "../../lib/layout.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "./text.js";

const PADDING = 4;
const SLIDE = { duration: 250, easing: Easing.bezier(0.22, 1, 0.36, 1) };

/**
 * The web's `SlidingTabs` (`@mentor/ui`):
 * - `variant="pill"` (default): equal-width pill well with a white sliding pill.
 * - `variant="underline"`: horizontally scrollable tabs over a hairline with a 2dp bottom ink bar.
 */
export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  variant = "pill",
  compact = false,
  style,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  accessibilityLabel: string;
  variant?: "pill" | "underline";
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (variant === "underline") {
    return (
      <UnderlineSlidingTabs
        items={items}
        value={value}
        onChange={onChange}
        accessibilityLabel={accessibilityLabel}
        style={style}
      />
    );
  }

  return (
    <PillSlidingTabs
      items={items}
      value={value}
      onChange={onChange}
      accessibilityLabel={accessibilityLabel}
      compact={compact}
      style={style}
    />
  );
}

function PillSlidingTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  compact,
  style,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  accessibilityLabel: string;
  compact: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const tabWidth = items.length > 0 ? width / items.length : 0;
  const index = Math.max(0, items.findIndex((item) => item.id === value));
  const x = useSharedValue(0);
  const placedWidth = useRef(0);

  useEffect(() => {
    if (tabWidth <= 0) return;
    const target = index * tabWidth;
    const snap = reduceMotion || placedWidth.current !== width;
    placedWidth.current = width;
    x.value = snap ? target : withTiming(target, SLIDE);
  }, [index, tabWidth, width, reduceMotion, x]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - PADDING * 2)}
      style={[
        styles.well,
        { backgroundColor: mixHex(palette.surfaceAlt, palette.bg, 0.8), borderColor: palette.border },
        style,
      ]}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, cardShadow, { width: tabWidth, backgroundColor: palette.surface }, pillStyle]}
        />
      ) : null}
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(item.id);
            }}
            style={[styles.tab, compact && styles.compactTab]}
          >
            <AppText
              numberOfLines={1}
              style={[
                styles.label,
                compact && styles.compactLabel,
                { color: selected ? palette.main : palette.secondary },
              ]}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function UnderlineSlidingTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  style,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const [measurements, setMeasurements] = useState<Record<string, { x: number; width: number }>>({});
  const barX = useSharedValue(0);
  const barW = useSharedValue(0);
  const placedRef = useRef(false);

  const activeRect = measurements[value];

  useEffect(() => {
    if (!activeRect || activeRect.width <= 0) return;
    const snap = reduceMotion || !placedRef.current;
    placedRef.current = true;
    barX.value = snap ? activeRect.x : withTiming(activeRect.x, SLIDE);
    barW.value = snap ? activeRect.width : withTiming(activeRect.width, SLIDE);
  }, [activeRect, reduceMotion, barX, barW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: barW.value > 0 ? 1 : 0,
    transform: [
      { translateX: barX.value + (barW.value - 1) / 2 },
      { scaleX: Math.max(barW.value, 1) },
    ],
  }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.underlineOuter, { borderBottomColor: palette.playLine }, style]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.underlineScroll}
      >
        {items.map((item, idx) => {
          const selected = item.id === value;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setMeasurements((prev) => {
                  const cur = prev[item.id];
                  if (cur && cur.x === x && cur.width === width) return prev;
                  return { ...prev, [item.id]: { x, width } };
                });
              }}
              onPress={() => {
                if (selected) return;
                haptics.selection();
                onChange(item.id);
              }}
              style={[
                styles.underlineTab,
                idx < items.length - 1 && styles.underlineTabGap,
              ]}
            >
              <AppText
                numberOfLines={1}
                style={[
                  styles.underlineLabel,
                  { color: selected ? palette.main : palette.secondary },
                ]}
              >
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
        <Animated.View
          pointerEvents="none"
          style={[styles.underlineIndicator, { backgroundColor: palette.main }, indicatorStyle]}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    flexDirection: "row",
    padding: PADDING,
    borderRadius: 999,
    borderWidth: 1,
  },
  pill: {
    position: "absolute",
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  compactTab: {
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  compactLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  underlineOuter: {
    borderBottomWidth: 1,
  },
  underlineScroll: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  underlineTab: {
    minHeight: 44,
    paddingVertical: 10,
    justifyContent: "center",
  },
  underlineTabGap: {
    marginRight: 20,
  },
  underlineLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  underlineIndicator: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 1,
    height: 2,
  },
});
