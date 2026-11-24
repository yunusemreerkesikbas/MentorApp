import { StyleSheet, View } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Skeleton } from "../ui/index.js";

export function NotificationsSkeleton() {
  const { palette } = useThemeTokens();

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Skeleton width={72} height={13} />
      </View>
      {[0, 1, 2, 3].map((idx) => (
        <View
          key={idx}
          style={[styles.row, { borderBottomColor: palette.playLine }]}
        >
          <Skeleton width={24} height={24} borderRadius={8} />
          <View style={styles.body}>
            <Skeleton width={idx % 2 === 0 ? "78%" : "64%"} height={15} />
            <Skeleton width="92%" height={12} />
          </View>
          <Skeleton width={48} height={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: 6,
  },
});
