import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "./text.js";

export interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string | null;
  errorMessage?: string | null;
}

/**
 * Accessible field (`DESIGN.md` §6):
 * - 14dp inner radius, >=48dp touch height
 * - Supports uncontrolled `defaultValue` + `onChangeText` to avoid typing jank
 * - Companion-register calm inline error message
 */
export function TextField({
  label,
  hint,
  errorMessage,
  style,
  ...inputProps
}: TextFieldProps) {
  const { palette, radii, space, touchTargets, typeScale } = useThemeTokens();
  const hasError = Boolean(errorMessage);

  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={palette.muted}
        style={[
          styles.input,
          {
            minHeight: touchTargets.comfortable,
            borderRadius: radii.inner,
            paddingHorizontal: space.md,
            backgroundColor: palette.surface,
            borderColor: hasError ? palette.danger : palette.border,
            color: palette.main,
            fontSize: typeScale.body.fontSize,
          },
          style,
        ]}
        {...inputProps}
      />
      {hasError ? (
        <AppText variant="caption" tone="danger">
          {errorMessage}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="secondary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderCurve: "continuous",
  },
});
