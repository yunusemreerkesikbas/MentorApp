import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MENTORSHIP_DATA_SCOPE } from "@mentor/types";
import {
  AppText,
  Button,
  Card,
  Skeleton,
  TextField,
} from "../../../components/ui/index.js";
import {
  fetchCoachRegistrationState,
  updateCoachProfile,
} from "../../../lib/mentorship-api.js";
import { haptics } from "../../../lib/haptics.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function CoachProfileScreen() {
  const t = useTranslations("students");
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  const queryClient = useQueryClient();

  const regQuery = useQuery({
    queryKey: ["mentorship-registration-state"],
    queryFn: fetchCoachRegistrationState,
  });

  const registration = regQuery.data?.registration ?? null;
  const [headlineDraft, setHeadlineDraft] = useState<string | null>(null);
  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const effectiveHeadline = headlineDraft ?? registration?.headline ?? "";
  const effectiveBio = bioDraft ?? registration?.bio ?? "";

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCoachProfile({
        headline: effectiveHeadline.trim(),
        bio: effectiveBio.trim(),
      }),
    onSuccess: () => {
      void haptics.success();
      setSavedNotice(true);
      void queryClient.invalidateQueries({
        queryKey: ["mentorship-registration-state"],
      });
    },
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.xl,
        gap: space.md,
      }}
    >
      <View style={{ gap: 4 }}>
        <AppText variant="caption" tone="coach">
          {t("badge")}
        </AppText>
        <AppText variant="title">{t("profile_title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("profile_subtitle")}
        </AppText>
      </View>

      {regQuery.isLoading ? (
        <Skeleton height={180} />
      ) : (
        <Card style={{ gap: space.sm }}>
          {registration ? (
            <AppText variant="caption" tone="coach">
              {t("profile_status_label", { status: registration.status })}
            </AppText>
          ) : null}

          <TextField
            label={t("profile_headline_label")}
            value={effectiveHeadline}
            onChangeText={(val) => {
              setHeadlineDraft(val);
              setSavedNotice(false);
            }}
          />
          <TextField
            label={t("profile_bio_label")}
            value={effectiveBio}
            onChangeText={(val) => {
              setBioDraft(val);
              setSavedNotice(false);
            }}
            multiline
          />
          {savedNotice ? (
            <AppText variant="caption" tone="success">
              {t("profile_saved")}
            </AppText>
          ) : null}
          <Button
            label={t("profile_save_cta")}
            disabled={!effectiveHeadline.trim() || !effectiveBio.trim()}
            loading={updateMutation.isPending}
            onPress={() => updateMutation.mutate()}
          />
        </Card>
      )}

      <Card style={{ gap: space.sm }}>
        <AppText variant="sectionHeading">{t("data_scope_title")}</AppText>
        {MENTORSHIP_DATA_SCOPE.map((scopeKey) => (
          <AppText key={scopeKey} variant="body" tone="secondary">
            • {t(`scope_${scopeKey}` as "scope_ACTIVITY")}
          </AppText>
        ))}
        <AppText variant="caption" tone="coach">
          {t("privacy_trust_notice")}
        </AppText>
      </Card>
    </ScrollView>
  );
}
