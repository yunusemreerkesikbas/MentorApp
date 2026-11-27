import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

/** The web's "Kendin yaz" card: whole minutes, 10–600. Typing in it selects it. */
export function MinuteEntryCard({
  label, unit, value, selected, disabled, invalidMessage, onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  selected: boolean;
  disabled?: boolean;
  invalidMessage?: string;
  onChange: (value: number | null) => void;
}) {
  const { palette, radii } = useThemeTokens();
  // What is typed stays here: deriving it from `value` blanked the field when "60" (on the way to
  // 600) matched a preset.
  const [text, setText] = useState(() => (selected && value != null ? String(value) : ""));
  useEffect(() => {
    if (!selected) setText("");
  }, [selected]);
  const invalid = selected && value != null && (!Number.isInteger(value) || value < 10 || value > 600);
  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radii.button,
          borderColor: selected ? palette.ctaPlayBg : palette.playLine,
          backgroundColor: selected ? palette.playSelected : palette.surface,
        },
      ]}
    >
      <AppText style={styles.label}>{label}</AppText>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={invalid ? invalidMessage : undefined}
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={3}
          value={text}
          onChangeText={(next) => {
            const digits = next.replace(/\D/g, "");
            setText(digits);
            onChange(digits === "" ? null : Number(digits));
          }}
          style={[styles.input, { borderRadius: radii.button, borderColor: palette.playLine, backgroundColor: palette.surface, color: palette.main }]}
        />
        <AppText tone="secondary" style={styles.unit}>{unit}</AppText>
      </View>
      {invalid && invalidMessage ? (
        <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{invalidMessage}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 112, alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 8, paddingVertical: 12 },
  label: { fontSize: 16, fontWeight: "700" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { width: 96, minHeight: 44, borderWidth: 1, paddingHorizontal: 8, textAlign: "center", fontSize: 20, fontWeight: "700" },
  unit: { fontWeight: "700" },
  error: { fontSize: 12, fontWeight: "600", textAlign: "center" },
});
