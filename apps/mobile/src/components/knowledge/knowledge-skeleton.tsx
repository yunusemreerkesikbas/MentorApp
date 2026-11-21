import { StyleSheet, View } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { Skeleton } from "../ui/index.js";

export function KnowledgeHubSkeleton() {
  const { palette } = useThemeTokens();

  return (
    <View style={styles.stack}>
      <PanelCard style={styles.featured}>
        <Skeleton width="100%" height={160} borderRadius={14} />
        <Skeleton width={120} height={14} />
        <Skeleton width="85%" height={22} />
        <Skeleton width="95%" height={14} />
      </PanelCard>

      <PanelCard style={styles.rowsCard}>
        {[0, 1, 2, 3].map((row) => (
          <View
            key={row}
            style={[
              styles.row,
              row > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.playLine },
            ]}
          >
            <Skeleton width={68} height={68} borderRadius={14} />
            <View style={styles.rowBody}>
              <Skeleton width={108} height={12} />
              <Skeleton width="82%" height={16} />
              <Skeleton width="94%" height={13} />
            </View>
          </View>
        ))}
      </PanelCard>
    </View>
  );
}

export function ArticleReaderSkeleton() {
  return (
    <View style={styles.stack}>
      <Skeleton width={130} height={16} />
      <Skeleton width="92%" height={28} />
      <Skeleton width={180} height={14} />
      <Skeleton width="100%" height={180} borderRadius={14} />
      <Skeleton width="100%" height={16} />
      <Skeleton width="95%" height={16} />
      <Skeleton width="88%" height={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  featured: {
    gap: 12,
  },
  rowsCard: {
    paddingVertical: 4,
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
});
