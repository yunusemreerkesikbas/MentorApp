import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CheckIcon } from "@solar-icons/react-native/bold/check";
import { haptics } from "../../lib/haptics.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

export type PlayWell = "blue" | "peri" | "violet" | "coral" | "pink";

/** The web's play choices: 2dp border with a 4dp bottom edge that presses down to 2dp. */
function useCardLook(selected: boolean) {
  const { palette, radii } = useThemeTokens();
  return {
    card: {
      borderRadius: radii.button, borderWidth: 2,
      borderColor: selected ? palette.ctaPlayBg : palette.playLine,
      backgroundColor: selected ? palette.playSelected : palette.surface,
    },
    ink: selected ? palette.playSelectedInk : palette.main,
  };
}

const pressedEdge = (pressed: boolean) => ({ borderBottomWidth: pressed ? 2 : 4, transform: [{ translateY: pressed ? 2 : 0 }] });

export function PlayIconWell({ well, size = 44, children }: { well: PlayWell; size?: number; children: ReactNode }) {
  const { palette } = useThemeTokens();
  const bg = {
    blue: palette.playWellBlue, peri: palette.playWellPeri, violet: palette.playWellViolet,
    coral: palette.playWellCoral, pink: palette.playWellPink,
  }[well];
  return (
    <View accessible={false} style={[styles.well, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {children}
    </View>
  );
}

type ChoiceProps = { label: string; sub?: string; selected: boolean; disabled?: boolean; onSelect: () => void };

const press = (onSelect: () => void) => () => {
  haptics.selection();
  onSelect();
};

/** Full-width radio row: optional lead (icon well), label + sub, check mark. */
export function PlayOptionRow({
  label, sub, lead, selected, disabled, onSelect, multiple = false,
}: ChoiceProps & { lead?: ReactNode; multiple?: boolean }) {
  const { card, ink } = useCardLook(selected);
  const { palette } = useThemeTokens();
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      disabled={disabled}
      onPress={press(onSelect)}
      style={({ pressed }) => [styles.row, card, pressedEdge(pressed)]}
    >
      {lead}
      <View style={styles.rowText}>
        <AppText style={[styles.label, { color: ink }]}>{label}</AppText>
        {sub ? <AppText tone="secondary" style={styles.sub}>{sub}</AppText> : null}
      </View>
      {selected ? (
        <View style={[styles.check, { backgroundColor: palette.ctaPlayBg }]}>
          <CheckIcon size={16} color={palette.ctaPlayInk} />
        </View>
      ) : (
        <View style={[styles.check, styles.checkEmpty, { borderColor: palette.playLine }]} />
      )}
    </Pressable>
  );
}

/** Grid radio card: art on top, label (+ sub) below, optional pill badge on the top edge. */
export function PlayGridCard({
  label, sub, art, badge, compact = false, selected, disabled, onSelect,
}: ChoiceProps & { art: ReactNode; badge?: string; compact?: boolean }) {
  const { card, ink } = useCardLook(selected);
  const { palette } = useThemeTokens();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={[badge, label, sub].filter(Boolean).join(", ")}
      disabled={disabled}
      onPress={press(onSelect)}
      style={({ pressed }) => [styles.grid, compact && styles.gridCompact, card, pressedEdge(pressed)]}
    >
      {badge ? (
        <View style={[styles.badge, { backgroundColor: palette.ctaPlayBg }]}>
          <AppText style={[styles.badgeText, { color: palette.ctaPlayInk }]}>{badge}</AppText>
        </View>
      ) : null}
      {art}
      <AppText style={[styles.label, compact && styles.labelCompact, styles.centered, { color: ink }]}>{label}</AppText>
      {sub ? <AppText tone="secondary" style={[styles.sub, styles.centered]}>{sub}</AppText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  well: { alignItems: "center", justifyContent: "center" },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  labelCompact: { fontSize: 14, lineHeight: 18 },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  centered: { textAlign: "center" },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  checkEmpty: { borderWidth: 2 },
  grid: { flex: 1, minHeight: 112, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 12 },
  gridCompact: { minHeight: 116, paddingHorizontal: 6, paddingVertical: 10 },
  badge: { position: "absolute", top: -12, alignSelf: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: "800" },
});
