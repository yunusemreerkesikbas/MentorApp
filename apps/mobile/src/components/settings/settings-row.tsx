import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { useLocale } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText } from "../ui/index.js";

/** The web's settings `ListRow`: 44dp row, optional description under the label, chevron when it opens something. */
export function SettingsRow({ label, description, detail, icon, trailing, onPress, danger, chevron = Boolean(onPress) }: {
  label: string;
  description?: string;
  detail?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  const { palette, radii, space, touchTargets } = useThemeTokens();
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={label}
      accessibilityHint={description ?? detail} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({
        minHeight: touchTargets.comfortable, paddingHorizontal: space.sm, paddingVertical: space.xs,
        flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radii.inner,
        backgroundColor: pressed ? palette.surfaceAlt : undefined,
      })}>
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="body" tone={danger ? "danger" : "main"} style={{ fontWeight: "700" }}>{label}</AppText>
        {description ? <AppText variant="caption" tone="secondary" numberOfLines={1}>{description}</AppText> : null}
      </View>
      {detail ? <AppText variant="caption" tone="secondary" style={{ maxWidth: "54%", textAlign: "right" }}>{detail}</AppText> : null}
      {trailing}
      {chevron ? <AltArrowRightIcon size={16} color={palette.muted} /> : null}
    </Pressable>
  );
}

/** A settings card (`Card solid p-2`) with the web's small uppercase section label. */
export function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  const { palette, space } = useThemeTokens();
  const { locale } = useLocale();
  return (
    <PanelCard style={{ padding: space.sm }}>
      <AppText accessibilityRole="header" style={{
        paddingHorizontal: space.sm, paddingTop: space.xs, paddingBottom: space.xs,
        fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0.8, color: palette.secondary,
      }}>
        {title.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
      </AppText>
      <View style={{ gap: 2 }}>{children}</View>
    </PanelCard>
  );
}
