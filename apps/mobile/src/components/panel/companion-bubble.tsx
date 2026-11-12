import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { art, careerArt } from "../../lib/art.js";
import { mixHex } from "../../lib/layout.js";
import { useIsPremium } from "../../lib/premium.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { PLAY_RADIUS } from "./primitives.js";

const PUHU_SIZE = 72;
const FOLDED_LINES = 3;

/**
 * Puhu speaking in a bubble (the web's `CompanionBubble`): one line, first person. Puhu wears the
 * user's field when they picked one, the same rule as the web's `PuhuImage`.
 */
export function CompanionBubble({
  text,
  mood = "default",
  aiLabel = null,
}: {
  text: string;
  mood?: "default" | "happy";
  /** Set when the line was written by the AI; a rule-based line passes none and never pretends. */
  aiLabel?: string | null;
}) {
  const { user } = useAuth();
  const { palette } = useThemeTokens();
  const premium = useIsPremium();
  // The hero mask marks Premium (DESIGN.md §7), so it wins over the career art.
  const source = premium
    ? art.puhuPremiumHero
    : user?.careerGroup
      ? careerArt[user.careerGroup]
      : mood === "happy"
        ? art.puhuHappy
        : art.puhuDefault;

  return (
    <View style={styles.row}>
      <Image source={source} style={styles.puhu} contentFit="contain" accessible={false} />
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: aiLabel
              ? mixHex(palette.premiumRingFrom, palette.surface, 0.1)
              : palette.playSelected,
          },
        ]}
      >
        {aiLabel ? (
          <AppText style={[styles.aiLabel, { color: palette.playSelectedInk }]}>{aiLabel}</AppText>
        ) : null}
        {/* Keyed by the text, so a new note starts folded and is measured again. */}
        <ExpandableNote key={text} text={text} />
      </View>
    </View>
  );
}

/**
 * Long notes fold to three lines behind "Daha fazla göster". A note only one line longer shows
 * whole: the toggle would take more room than the line it hides.
 */
function ExpandableNote({ text }: { text: string }) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const [fullLines, setFullLines] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const needsToggle = fullLines !== null && fullLines > FOLDED_LINES + 1;

  return (
    <View>
      <AppText
        numberOfLines={needsToggle && !expanded ? FOLDED_LINES : undefined}
        // The first layout is unclamped, so it reports the note's real height in lines.
        onTextLayout={(event) => {
          if (fullLines === null) setFullLines(event.nativeEvent.lines.length);
        }}
        style={[styles.line, { color: palette.main }]}
      >
        {text}
      </AppText>
      {needsToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={styles.toggle}
        >
          <AppText style={[styles.toggleLabel, { color: palette.main }]}>
            {expanded ? t("note_less") : t("note_more")}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  puhu: {
    width: PUHU_SIZE,
    height: PUHU_SIZE,
  },
  bubble: {
    flex: 1,
    minWidth: 0,
    borderRadius: PLAY_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  aiLabel: {
    marginBottom: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  line: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "600",
  },
  toggle: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
