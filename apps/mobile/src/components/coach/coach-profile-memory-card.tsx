import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoachDirectnessPreference,
  CoachSupportPreference,
} from "@mentor/types";
import {
  deleteCoachMemory,
  fetchCoachProfile,
  listCoachMemories,
  updateCoachProfilePreferences,
} from "../../lib/coach-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Card, Chip } from "../ui/index.js";

const SUPPORT_MODES: CoachSupportPreference[] = [
  "EMOTIONAL",
  "BALANCED",
  "ACTION",
];

const DIRECTNESS_MODES: CoachDirectnessPreference[] = [
  "GENTLE",
  "BALANCED",
  "DIRECT",
];

export function CoachProfileMemoryCard() {
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();
  const t = useTranslations("coach");
  const [open, setOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["coach", "profile"],
    queryFn: fetchCoachProfile,
    enabled: open,
  });

  const memoriesQuery = useQuery({
    queryKey: ["coach", "memories"],
    queryFn: listCoachMemories,
    enabled: open,
  });

  const patchProfileMutation = useMutation({
    mutationFn: updateCoachProfilePreferences,
    onSuccess: async () => {
      haptics.selection();
      await queryClient.invalidateQueries({ queryKey: ["coach", "profile"] });
    },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => deleteCoachMemory(id),
    onSuccess: async () => {
      haptics.lightImpact();
      await queryClient.invalidateQueries({ queryKey: ["coach", "memories"] });
    },
  });

  const profile = profileQuery.data;
  const memories = memoriesQuery.data ?? [];

  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.rowBetween}>
        <AppText variant="sectionHeading">{t("prefs_title")}</AppText>
        <Chip
          label={t("prefs_toggle_cta")}
          selected={open}
          onPress={() => {
            haptics.selection();
            setOpen((prev) => !prev);
          }}
        />
      </View>

      {open && profile ? (
        <View style={{ gap: space.md }}>
          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="secondary">
              {t("support_label")}
            </AppText>
            <View style={styles.chipRow}>
              {SUPPORT_MODES.map((mode) => (
                <Chip
                  key={mode}
                  label={t(`support_${mode}` as never)}
                  selected={profile.supportPreference === mode}
                  onPress={() =>
                    patchProfileMutation.mutate({ supportPreference: mode })
                  }
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="secondary">
              {t("directness_label")}
            </AppText>
            <View style={styles.chipRow}>
              {DIRECTNESS_MODES.map((mode) => (
                <Chip
                  key={mode}
                  label={t(`directness_${mode}` as never)}
                  selected={profile.directnessPreference === mode}
                  onPress={() =>
                    patchProfileMutation.mutate({ directnessPreference: mode })
                  }
                />
              ))}
            </View>
          </View>

          <View style={styles.rowBetween}>
            <AppText variant="caption" tone="secondary">
              {t("memory_consent_label")}
            </AppText>
            <Chip
              label={
                profile.memoryConsent === "GRANTED"
                  ? t("memory_consent_GRANTED")
                  : t("memory_consent_DECLINED")
              }
              selected={profile.memoryConsent === "GRANTED"}
              onPress={() =>
                patchProfileMutation.mutate({
                  memoryConsent:
                    profile.memoryConsent === "GRANTED"
                      ? "DECLINED"
                      : "GRANTED",
                })
              }
            />
          </View>

          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="secondary">
              {t("memories_title")}
            </AppText>
            {memories.length === 0 ? (
              <AppText variant="micro" tone="muted">
                {t("memories_empty")}
              </AppText>
            ) : (
              memories.map((fact) => (
                <View
                  key={fact.id}
                  style={{
                    padding: space.sm,
                    borderRadius: radii.inner,
                    backgroundColor: palette.surfaceAlt,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="micro" tone="muted">
                      {fact.key}
                    </AppText>
                    <AppText variant="caption">{fact.value}</AppText>
                  </View>
                  <Chip
                    label={t("memory_delete_cta")}
                    onPress={() => deleteMemoryMutation.mutate(fact.id)}
                  />
                </View>
              ))
            )}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
