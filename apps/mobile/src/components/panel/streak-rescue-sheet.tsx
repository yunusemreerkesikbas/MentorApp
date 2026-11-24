import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { ApiClientError } from "@mentor/api-client";
import type { StreakRescueView } from "@mentor/types";
import { art } from "../../lib/art.js";
import { purchaseStreakRescue } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { BottomSheet, LedgeButton } from "./primitives.js";

/** Break days already offered since the app started; the web keeps the same list per browser tab. */
const offeredBreakDays = new Set<string>();

/**
 * The Coin-bought streak freeze (the web's `useStreakRescue`). When the free monthly freezes are
 * spent and a single gap is buyable, the panel asks once per break day; there is no standing
 * freeze chrome. Short on Coin, the same sheet points at the quests instead.
 */
export function StreakRescueSheet({
  offer,
  onRescued,
  onOpenQuests,
  onError,
}: {
  offer: StreakRescueView | null;
  onRescued: () => void;
  onOpenQuests: () => void;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const [shown, setShown] = useState<StreakRescueView | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!offer?.eligible || !offer.date || offeredBreakDays.has(offer.date)) return;
    offeredBreakDays.add(offer.date);
    setShown(offer);
  }, [offer]);

  const close = () => setShown(null);

  const rescue = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await purchaseStreakRescue();
      haptics.success();
      close();
      onRescued();
    } catch (error) {
      close();
      onError(error instanceof ApiClientError ? error.message : null);
    } finally {
      setBusy(false);
    }
  };

  const short = shown !== null && !shown.canAfford;

  return (
    <BottomSheet visible={shown !== null} onClose={close} closeLabel={t("rescue_later")}>
      {shown ? (
        <View style={styles.body}>
          <Image source={art.puhuEncouraging} style={styles.puhu} contentFit="contain" />
          <AppText accessibilityRole="header" style={styles.title}>
            {short ? t("rescue_short_title") : t("rescue_title")}
          </AppText>
          <AppText style={[styles.message, { color: palette.secondary }]}>
            {short
              ? t("rescue_short_body", { cost: shown.cost })
              : t("rescue_body", { cost: shown.cost })}
          </AppText>
          <View style={styles.actions}>
            <LedgeButton
              accessibilityLabel={short ? t("rescue_short_cta") : t("rescue_cta")}
              onPress={() => {
                if (short) {
                  close();
                  onOpenQuests();
                } else {
                  void rescue();
                }
              }}
            >
              {(ink) => (
                <AppText numberOfLines={1} style={[styles.ledgeLabel, { color: ink }]}>
                  {short ? t("rescue_short_cta") : t("rescue_cta")}
                </AppText>
              )}
            </LedgeButton>
            <Pressable accessibilityRole="button" onPress={close} style={styles.later}>
              <AppText numberOfLines={1} style={[styles.laterLabel, { color: palette.secondary }]}>
                {short ? t("rescue_short_ok") : t("rescue_later")}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  puhu: {
    width: 96,
    height: 96,
  },
  title: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    textAlign: "center",
  },
  actions: {
    alignSelf: "stretch",
    gap: 4,
    marginTop: 12,
  },
  ledgeLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  later: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  laterLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
});
