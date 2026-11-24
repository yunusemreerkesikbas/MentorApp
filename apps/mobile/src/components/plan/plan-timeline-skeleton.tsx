import { StyleSheet, View } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Skeleton } from "../ui/skeleton.js";

const DAYS = 7;

/**
 * The cover inside the Timeline card while a week loads or is being pinned (the web's
 * `PlanTimelineSkeleton`): a rail, seven day blocks, two row placeholders in the first.
 */
export function PlanTimelineSkeleton() {
  const { palette } = useThemeTokens();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.body}
    >
      <View style={[styles.rail, { backgroundColor: palette.progressTrack }]} />
      {Array.from({ length: DAYS }, (_, day) => (
        <View key={day} style={styles.day}>
          <Skeleton width={24} height={24} borderRadius={12} style={styles.dot} />
          <Skeleton width={144} height={16} />
          {Array.from({ length: day === 0 ? 2 : 1 }, (_, row) => (
            <View key={row} style={styles.row}>
              <Skeleton width={20} height={20} borderRadius={6} />
              <View style={styles.rowText}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="40%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 24,
    paddingVertical: 8,
  },
  rail: {
    position: "absolute",
    left: 11,
    top: 8,
    bottom: 8,
    width: 2,
  },
  day: {
    paddingLeft: 56,
    gap: 8,
  },
  dot: {
    position: "absolute",
    left: 12,
    top: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
});
