import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import { canonicalHm, minuteChoices, pad } from "@mentor/core";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText } from "../ui/text.js";

const ROW = 44;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * The web's time popover as a sheet: an hour column and a minute column. Each tap applies at once
 * (the web's `commit`); the sheet closes with × or the scrim.
 */
export function PlanTimeSheet({
  value,
  title,
  onPick,
  onClose,
}: {
  /** The field's current `HH:mm`; null keeps the sheet closed. */
  value: string | null;
  title: string;
  onPick: (hm: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const current = value ? canonicalHm(value) : null;
  const hour = current ? Number(current.slice(0, 2)) : null;
  const minute = current ? Number(current.slice(3, 5)) : null;

  return (
    <FormSheet
      visible={value !== null}
      title={title}
      closeLabel={tCommon("close")}
      onClose={onClose}
    >
      <View style={styles.columns}>
        <Column
          label={t("time_picker_hour")}
          items={HOURS}
          selected={hour}
          onSelect={(next) => onPick(`${pad(next)}:${pad(minute ?? 0)}`)}
        />
        <Column
          label={t("time_picker_minute")}
          items={minuteChoices(minute)}
          selected={minute}
          onSelect={(next) => onPick(`${pad(hour ?? 9)}:${pad(next)}`)}
        />
      </View>
    </FormSheet>
  );
}

function Column({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: number[];
  selected: number | null;
  onSelect: (value: number) => void;
}) {
  const { palette, radii } = useThemeTokens();
  const scroller = useRef<ScrollViewInstance>(null);
  const index = selected === null ? -1 : items.indexOf(selected);

  return (
    <View style={styles.column}>
      <AppText tone="secondary" style={styles.columnLabel}>
        {label}
      </AppText>
      <ScrollView
        ref={scroller}
        style={[styles.list, { borderColor: palette.border, borderRadius: radii.inner }]}
        nestedScrollEnabled
        // Start with the picked value in view, two rows from the top.
        onLayout={() =>
          scroller.current?.scrollTo({ y: Math.max(0, (index - 2) * ROW), animated: false })
        }
      >
        {items.map((item) => {
          const active = item === selected;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                haptics.selection();
                onSelect(item);
              }}
              style={[styles.item, active && { backgroundColor: palette.ctaPlayBg }]}
            >
              <AppText
                tabularNums
                style={[styles.itemText, { color: active ? palette.ctaPlayInk : palette.main }]}
              >
                {pad(item)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: {
    flexDirection: "row",
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 6,
  },
  columnLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  list: {
    height: ROW * 6,
    borderWidth: 1,
  },
  item: {
    height: ROW,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
  },
});
