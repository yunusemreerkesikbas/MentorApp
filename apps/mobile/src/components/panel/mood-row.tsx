import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import type { MoodCheckinDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { moodArt } from "../../lib/art.js";
import { upsertMoodCheckin } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { requestMoodReflection, useIsPremium } from "../../lib/premium.js";
import { useCelebrations } from "../../providers/celebration-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { PLAY_RADIUS } from "./primitives.js";
import { PuhuSpeechModal } from "./puhu-speech-modal.js";

const MOODS = [1, 2, 3, 4, 5] as const;
type MoodLabelKey = `mood_${(typeof MOODS)[number]}`;

/**
 * "Bugün nasılsın?": today's mood in one tap (the web's phone `GreetingRow` + `useMoodCheckin`).
 * Puhu answers a fresh pick in his thought cloud: Premium Puhu's own words, or the rule-based
 * line for everyone else. A reward scene on screen goes first; the cloud waits for it.
 */
export function MoodRow({
  initial,
  canLighten,
  onSaved,
  onLighten,
}: {
  initial: MoodCheckinDto | null;
  /** Backend eligibility for "lighten today" (excludes finished and coach-assigned tasks). */
  canLighten: boolean;
  onSaved: () => void;
  onLighten: () => void;
}) {
  const t = useTranslations("panel");
  const tCommon = useTranslations("common");
  const { palette } = useThemeTokens();
  const premium = useIsPremium();
  const celebrations = useCelebrations();
  const [saved, setSaved] = useState<MoodCheckinDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechOpen, setSpeechOpen] = useState(false);
  const [reflection, setReflection] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const request = useRef(0);

  const mood = saved?.mood ?? initial?.mood ?? null;

  const pick = async (value: number) => {
    if (busy) return;
    haptics.selection();
    setBusy(true);
    setError(null);
    try {
      // The row has no note field; a re-pick resends the saved note so it is not wiped.
      const result = await upsertMoodCheckin({
        mood: value,
        struggleNote: initial?.struggleNote?.trim() || undefined,
      });
      setSaved(result);
      setReflection(null);
      setSpeechOpen(true);
      onSaved();
      if (premium) {
        // Premium never sees the rule line first: Puhu "writes" until his own words arrive.
        const id = ++request.current;
        setReflecting(true);
        const words = await requestMoodReflection();
        if (id === request.current) {
          setReflection(words);
          setReflecting(false);
        }
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : tCommon("error_body"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.stack}>
      <View
        style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.playLine }]}
      >
        <AppText style={styles.title}>{t("mood_title")}</AppText>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {MOODS.map((value) => {
            const selected = mood === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={t(`mood_${value}` as MoodLabelKey)}
                accessibilityState={{ selected, disabled: busy }}
                disabled={busy}
                onPress={() => void pick(value)}
                style={[
                  styles.option,
                  selected
                    ? { backgroundColor: palette.playSelected, borderColor: palette.ctaPlayBg }
                    : { borderColor: "transparent", opacity: mood === null ? 1 : 0.6 },
                ]}
              >
                <Image source={moodArt[value]} style={styles.face} contentFit="contain" />
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}

      <PuhuSpeechModal
        visible={speechOpen && !celebrations.active}
        loading={reflecting}
        text={reflecting ? null : (reflection ?? saved?.message ?? null)}
        onClose={() => {
          request.current += 1;
          setReflecting(false);
          setSpeechOpen(false);
        }}
      />

      {canLighten && mood !== null && mood <= 2 ? (
        <Pressable
          accessibilityRole="button"
          onPress={onLighten}
          style={[
            styles.lighten,
            { backgroundColor: palette.surface, borderColor: palette.progressTrack },
          ]}
        >
          <AppText style={styles.lightenText}>{t("mood_lighten_cta")}</AppText>
          <AltArrowRightIcon size={16} color={palette.main} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderRadius: PLAY_RADIUS,
    paddingVertical: 4,
    paddingLeft: 14,
    paddingRight: 4,
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  options: {
    flexDirection: "row",
    gap: 2,
  },
  // 44dp for the thumb; the web's pointer-sized option is 40.
  option: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    width: 28,
    height: 28,
  },
  lighten: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lightenText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
