import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@mentor/api-client";
import type {
  CoachDirectnessPreference,
  CoachSupportPreference,
} from "@mentor/types";
import type { CoachProfilePatchInput } from "@mentor/validation";
import {
  deleteCoachMemory,
  fetchCoachProfile,
  listCoachMemories,
  updateCoachProfilePreferences,
} from "../../lib/coach-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip } from "../ui/index.js";
import { CoachCalibrationCard, type PreferenceChoices } from "./coach-calibration-card.js";

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

const KNOWN_MEMORY_KEYS = new Set([
  "STUDY_TIME",
  "RESPONSE_PREFERENCE",
  "CHALLENGE_CATEGORY",
  "PRIORITY_SUBJECT",
]);

const KNOWN_MEMORY_VALUES = new Set([
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "LATE_NIGHT",
  "SHORT",
  "BALANCED",
  "DETAILED",
  "FOCUS",
  "PROCRASTINATION",
  "ANXIETY",
  "CONSISTENCY",
  "PLANNING",
]);

export function CoachProfileMemoryCard({ calibrationOnly = false, children }: {
  calibrationOnly?: boolean;
  children?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();
  const t = useTranslations("coach");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PreferenceChoices>({});

  const profileQuery = useQuery({
    queryKey: ["coach", "profile"],
    queryFn: fetchCoachProfile,
  });

  const memoriesQuery = useQuery({
    queryKey: ["coach", "memories"],
    queryFn: listCoachMemories,
    enabled: open,
  });

  const patchProfileMutation = useMutation({
    mutationFn: updateCoachProfilePreferences,
    onSuccess: async (_updated, patch) => {
      haptics.selection();
      await queryClient.invalidateQueries({ queryKey: ["coach", "profile"] });
      if (patch.calibrationStatus) setDraft({});
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
  const needsCalibration =
    profile?.calibrationStatus === "NOT_STARTED" ||
    profile?.calibrationStatus === "IN_PROGRESS";
  const preferences = profile && needsCalibration ? { ...profile, ...draft } : profile;
  const patchProfile = (patch: CoachProfilePatchInput) => {
    if (!patchProfileMutation.isPending) patchProfileMutation.mutate(patch);
  };
  const choosePreference = (choice: PreferenceChoices) => {
    if (patchProfileMutation.isPending) return;
    if (needsCalibration) setDraft((current) => ({ ...current, ...choice }));
    else patchProfileMutation.mutate(choice);
  };

  if (calibrationOnly) {
    if (!needsCalibration || !preferences) return children ?? null;
    return <CoachCalibrationCard
      preferences={preferences}
      busy={patchProfileMutation.isPending}
      error={patchProfileMutation.error
        ? patchProfileMutation.error instanceof ApiClientError
          ? patchProfileMutation.error.body.message
          : t("calibration_error")
        : null}
      onChoose={choosePreference}
      onSave={() => patchProfile({ ...draft, calibrationStatus: "COMPLETED" })}
      onSkip={() => patchProfile({ calibrationStatus: "SKIPPED" })}
    />;
  }

  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.rowBetween}>
        <AppText variant="sectionHeading">{t("prefs_title")}</AppText>
        <Chip
          label={t("prefs_toggle_cta")}
          selected={open}
          onPress={() => {
            haptics.selection();
            if (!open && !profile && !profileQuery.isFetching) {
              void profileQuery.refetch();
            }
            setOpen((prev) => !prev);
          }}
        />
      </View>

      {needsCalibration ? (
        <>
          <AppText tone="secondary">{t("calibration_title")}</AppText>
          <Button
            label={t("calibration_skip")}
            variant="secondary"
            disabled={patchProfileMutation.isPending}
            onPress={() => patchProfile({ calibrationStatus: "SKIPPED" })}
          />
        </>
      ) : null}

      {patchProfileMutation.error || deleteMemoryMutation.error ? (
        <AppText tone="danger" accessibilityLiveRegion="polite">
          {(patchProfileMutation.error ?? deleteMemoryMutation.error) instanceof ApiClientError
            ? ((patchProfileMutation.error ?? deleteMemoryMutation.error) as ApiClientError).body.message
            : t("calibration_error")}
        </AppText>
      ) : null}

      {open && preferences ? (
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
                  selected={preferences.supportPreference === mode}
                  onPress={() => choosePreference({ supportPreference: mode })}
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
                  selected={preferences.directnessPreference === mode}
                  onPress={() => choosePreference({ directnessPreference: mode })}
                />
              ))}
            </View>
          </View>

          <View style={styles.rowBetween}>
            <AppText variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
              {t("memory_consent_label")}
            </AppText>
            {needsCalibration ? (
              <View style={styles.chipRow}>
                {(["GRANTED", "DECLINED"] as const).map((consent) => (
                  <Chip
                    key={consent}
                    label={t(`memory_consent_${consent}`)}
                    selected={preferences.memoryConsent === consent}
                    onPress={() => choosePreference({ memoryConsent: consent })}
                  />
                ))}
              </View>
            ) : (
              <Chip
                label={
                  preferences.memoryConsent === "GRANTED"
                    ? t("memory_consent_GRANTED")
                    : t("memory_consent_DECLINED")
                }
                selected={preferences.memoryConsent === "GRANTED"}
                onPress={() =>
                  choosePreference({
                    memoryConsent:
                      preferences.memoryConsent === "GRANTED" ? "DECLINED" : "GRANTED",
                  })
                }
              />
            )}
          </View>

          {needsCalibration ? (
            <Button
              label={t("calibration_save")}
              disabled={
                patchProfileMutation.isPending ||
                !preferences.supportPreference ||
                !preferences.directnessPreference ||
                preferences.memoryConsent === "PENDING"
              }
              onPress={() => patchProfile({ ...draft, calibrationStatus: "COMPLETED" })}
            />
          ) : null}

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
                      {KNOWN_MEMORY_KEYS.has(fact.key)
                        ? t(`memory_key_${fact.key}` as never)
                        : fact.key}
                    </AppText>
                    <AppText variant="caption">
                      {KNOWN_MEMORY_VALUES.has(fact.value)
                        ? t(`memory_val_${fact.value}` as never)
                        : fact.value}
                    </AppText>
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
    flexWrap: "wrap",
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
