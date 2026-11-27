import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useStageLook } from "./session-stage.js";

const STAR_PATH = "M50 6 63.52 33.39 93.75 37.79 71.87 59.11 77.04 89.21 50 75 22.96 89.21 28.13 59.11 6.25 37.79 36.48 33.39Z";

/** Three stars, filled in halves, the middle one larger (the web's `CompletionStars`). */
export function Stars({ filled, label, size = 1 }: { filled: number; label?: string; size?: number }) {
  const look = useStageLook();
  return (
    <View accessible={Boolean(label)} accessibilityRole="image" accessibilityLabel={label} style={styles.stars}>
      {[0, 1, 2].map((index) => {
        const fill = Math.min(1, Math.max(0, filled - index));
        const px = (index === 1 ? 64 : 48) * size;
        return (
          <Svg key={index} width={px} height={px} viewBox="0 0 100 100"
            style={{ transform: [{ rotate: `${[-10, 0, 10][index]}deg` }, { translateY: index === 1 ? -6 * size : 0 }] }}>
            <Defs>
              <LinearGradient id={`half-${index}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset={fill} stopColor="#FFC700" />
                <Stop offset={fill} stopColor={look.scenic ? "rgba(255, 255, 255, 0.16)" : look.track} />
              </LinearGradient>
            </Defs>
            <Path d={STAR_PATH} fill={`url(#half-${index})`} stroke={fill > 0 ? "#E0A800" : look.glassBorder} strokeWidth={3} strokeLinejoin="round" />
          </Svg>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 4, paddingTop: 4 },
});
