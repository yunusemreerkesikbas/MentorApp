import { Text, type TextProps, type TextStyle } from "react-native";
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

  const computedStyle: TextStyle = {
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    fontWeight: scale.fontWeight,
    color: colorMap[tone],
    ...(tabularNums ? { fontVariant: ["tabular-nums"] } : {}),
  };

  return (
    <Text style={[computedStyle, style]} {...rest}>
      {children}
    </Text>
  );
}
