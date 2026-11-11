import { StyleSheet, View } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button } from "./button.js";
import { Card } from "./card.js";
import { Skeleton } from "./skeleton.js";
import { AppText } from "./text.js";

export interface StateViewProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "empty" | "error";
}

export function StateView({
  title,
  body,
  actionLabel,
  onAction,
  tone = "empty",
}: StateViewProps) {
  const { space } = useThemeTokens();

  return (
    <Card variant={tone === "error" ? "surface" : "alt"} style={{ gap: space.sm }}>
      <AppText variant="cardTitle" tone={tone === "error" ? "danger" : "main"}>
        {title}
      </AppText>
      <AppText variant="body" tone="secondary">
        {body}
      </AppText>
      {actionLabel && onAction ? (
        <View style={styles.ctaRow}>
          <Button
            label={actionLabel}
            onPress={onAction}
            variant={tone === "error" ? "secondary" : "primary"}
          />
        </View>
      ) : null}
    </Card>
  );
}

export function ScreenLoadingSkeleton() {
  const { space } = useThemeTokens();
  return (
    <View style={{ gap: space.md }}>
      <Skeleton height={88} />
      <Skeleton height={132} />
      <Skeleton height={104} />
    </View>
  );
}

const styles = StyleSheet.create({
  ctaRow: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
});
