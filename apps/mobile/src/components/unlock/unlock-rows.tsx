import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { CoinsGlyph } from "../navigation/app-header.js";
import { PLAY_RADIUS } from "../panel/primitives.js";
import { Button } from "../ui/index.js";
import { AppText } from "../ui/text.js";

/**
 * The shared "Coin ile aç" parts (the web's `UnlockRow` kit), used by the weekly recap card and
 * the "Puhu'yla planla" sheet.
 */

/** One "açma" row: hairline above, icon, title, a count on the right. */
export function UnlockRow({
  title,
  icon,
  aside,
  flush = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  aside?: string;
  flush?: boolean;
  children?: ReactNode;
}) {
  const { palette } = useThemeTokens();
  return (
    <View style={[flush ? styles.rowFlush : styles.row, !flush && { borderTopColor: palette.playLine }]}>
      <View style={styles.rowHead}>
        {icon}
        <AppText accessibilityRole="header" style={[styles.rowTitle, { color: palette.main }]}>
          {title}
        </AppText>
        {aside ? (
          <AppText variant="caption" tone="secondary" tabularNums style={styles.bold}>
            {aside}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function UnlockCaption({
  children,
  tone = "secondary",
}: {
  children: ReactNode;
  tone?: "secondary" | "main";
}) {
  return (
    <AppText variant="caption" tone={tone}>
      {children}
    </AppText>
  );
}

/** The rolling allowance: filled pips are uses still available. */
export function UnlockPips({
  limit,
  remaining,
  label,
  text,
}: {
  limit: number;
  remaining: number;
  label: string;
  text: string;
}) {
  const { palette } = useThemeTokens();
  return (
    <View accessible accessibilityLabel={label} style={styles.pips}>
      {Array.from({ length: limit }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            i < remaining
              ? { backgroundColor: palette.ctaPlayBg }
              : {
                  backgroundColor: palette.playTrack,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: palette.secondary,
                  opacity: 0.6,
                },
          ]}
        />
      ))}
      <AppText variant="caption" style={styles.bold}>
        {text}
      </AppText>
    </View>
  );
}

/** The price confirmation: the Coin row's title, then balance from → to, a note and two actions. */
export function UnlockConfirm({
  title,
  lead,
  from,
  to,
  note,
  confirmLabel,
  cancelLabel,
  busy,
  flush = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  lead: string;
  from: string;
  to: string;
  note: string;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  /** Alone in a sheet the block drops its hairline: the sheet's header already draws one. */
  flush?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { palette } = useThemeTokens();
  return (
    <View style={[flush ? styles.rowFlush : styles.row, !flush && { borderTopColor: palette.playLine }]}>
      <View style={styles.rowHead}>
        <CoinsGlyph color={palette.ctaPlayBg} size={22} />
        <AppText style={[styles.rowTitle, { color: palette.main }]}>{title}</AppText>
      </View>
      <View style={[styles.confirm, { backgroundColor: palette.playSelected }]}>
        <AppText variant="caption" style={{ color: palette.playSelectedInk, fontWeight: "800" }}>
          {lead}
        </AppText>
        <View style={styles.fromTo}>
          <AppText tabularNums tone="secondary" style={styles.from}>
            {from}
          </AppText>
          <AppText style={{ color: palette.playSelectedInk, fontSize: 18 }}>→</AppText>
          <AppText tabularNums style={styles.to}>
            {to}
          </AppText>
        </View>
        <UnlockCaption tone="main">{note}</UnlockCaption>
        <View style={styles.confirmActions}>
          <Button label={confirmLabel} loading={busy} onPress={onConfirm} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.quietLink}>
            <AppText variant="caption" tone="secondary" style={styles.bold}>
              {cancelLabel}
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: "700",
  },
  row: {
    gap: 10,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  rowFlush: {
    gap: 10,
    paddingBottom: 4,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  pips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pip: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  confirm: {
    marginTop: 12,
    padding: 16,
    borderRadius: PLAY_RADIUS,
  },
  fromTo: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  from: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  to: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  confirmActions: {
    marginTop: 14,
    gap: 4,
  },
  quietLink: {
    minHeight: 44,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
