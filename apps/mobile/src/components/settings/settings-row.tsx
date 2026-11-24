import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

export function SettingsRow({ label, detail, icon, onPress, danger }: {
  label: string;
  detail?: string;
  icon?: ReactNode;
  onPress: () => void;
  danger?: boolean;
}) {
  const { palette, radii, space, touchTargets } = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail} onPress={onPress}
      style={({ pressed }) => ({
        minHeight: touchTargets.comfortable, paddingHorizontal: space.sm, paddingVertical: space.xs,
        flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radii.inner,
        backgroundColor: pressed ? palette.surfaceAlt : undefined,
      })}>
      {icon}
      <AppText variant="body" tone={danger ? "danger" : "main"} style={{ flex: 1, fontWeight: "700" }}>{label}</AppText>
      {detail ? <AppText variant="caption" tone="secondary" style={{ maxWidth: "54%", textAlign: "right" }}>{detail}</AppText> : null}
      <AltArrowRightIcon size={16} color={palette.muted} />
    </Pressable>
  );
}
