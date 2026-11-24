import { StyleSheet, View } from "react-native";
import { PanelCard } from "../panel/primitives.js";
import { Skeleton } from "../ui/skeleton.js";

/**
 * The task card while a week loads, in its loaded shape. The week card above it needs no data
 * (dates and arrows), so it stays real and a second week tap is never lost to a skeleton.
 */
export function PlanSkeleton() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <PanelCard style={styles.card}>
        <Skeleton width="35%" height={24} />
        {Array.from({ length: 3 }, (_, index) => (
          <View key={index} style={styles.row}>
            <Skeleton width={24} height={24} borderRadius={6} />
            <View style={styles.rowText}>
              <Skeleton width="70%" height={16} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        ))}
      </PanelCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
});
