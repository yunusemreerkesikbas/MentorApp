import { StyleSheet, View } from "react-native";
import { Skeleton } from "../ui/skeleton.js";
import { PanelCard, PLAY_RADIUS } from "./primitives.js";

/**
 * The panel while today's data loads: the same blocks the loaded screen draws (mood row, the
 * path card with its bubble, title, three stops and ledge, then the quest card), so nothing jumps
 * when the data lands (DESIGN.md §10).
 */
export function PanelSkeleton() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stack}>
      <Skeleton height={54} borderRadius={PLAY_RADIUS} />

      <PanelCard style={styles.card}>
        <View style={styles.bubbleRow}>
          <Skeleton width={72} height={72} borderRadius={36} />
          <Skeleton height={72} borderRadius={PLAY_RADIUS} style={styles.grow} />
        </View>
        <Skeleton width="78%" height={24} />
        <View style={styles.stops}>
          <Skeleton width={64} height={64} borderRadius={32} />
          <Skeleton width={48} height={48} borderRadius={24} />
          <Skeleton width={48} height={48} borderRadius={24} />
        </View>
        <Skeleton height={56} borderRadius={PLAY_RADIUS} />
      </PanelCard>

      <PanelCard style={styles.card}>
        <Skeleton width="45%" height={20} />
        <Skeleton height={12} borderRadius={6} />
        <Skeleton height={12} borderRadius={6} />
        <Skeleton height={12} borderRadius={6} />
        <Skeleton height={60} borderRadius={20} />
      </PanelCard>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  card: {
    gap: 16,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  grow: {
    flex: 1,
    width: undefined,
  },
  stops: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    paddingTop: 20,
  },
});
