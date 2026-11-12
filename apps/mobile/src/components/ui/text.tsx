import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";
import { fontFamilyFor } from "../../lib/fonts.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export type AppTextVariant =
  | "display"
  | "title"
  | "sectionHeading"
  | "cardTitle"
  | "body"
  | "caption"
  | "micro";

export type AppTextTone =
  | "main"
  | "secondary"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "coach"
  | "ctaInk";

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  tone?: AppTextTone;
  tabularNums?: boolean;
}

export function AppText({
  variant = "body",
  tone = "main",
  tabularNums = false,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { palette, typeScale } = useThemeTokens();
  const scale = typeScale[variant];

  const colorMap: Record<AppTextTone, string> = {
    main: palette.main,
    secondary: palette.secondary,
    muted: palette.muted,
    accent: palette.accent,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    coach: palette.coachAccent,
    ctaInk: palette.ctaPlayInk,
  };

  // A caller may override the weight; either way it has to become a Nunito family, and the
  // numeric weight must not reach the native text view or Android fakes a second bold on top.
  const override = StyleSheet.flatten(style) as TextStyle | undefined;
  const weight = override?.fontWeight ?? scale.fontWeight;

  const computedStyle: TextStyle = {
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    color: colorMap[tone],
    ...(tabularNums ? { fontVariant: ["tabular-nums"] } : {}),
  };

  return (
    <Text
      style={[
        computedStyle,
        override,
        { fontFamily: fontFamilyFor(weight), fontWeight: undefined },
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
