import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
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
 * The web's `SlidingTabs` (`@mentor/ui`), pill variant with equal-width tabs: a well with one
 * white pill that slides under the selected tab. The first placement and a width change snap.
 */
export function SlidingTabs<T extends string>({
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
            style={styles.tab}
          >
            <AppText
              numberOfLines={1}
              style={[styles.label, { color: selected ? palette.main : palette.secondary }]}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
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
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
});
