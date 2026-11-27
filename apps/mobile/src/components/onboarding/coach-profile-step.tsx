import { useState } from "react";
import { View } from "react-native";
import { ApiClientError, http } from "@mentor/api-client";
import type { MentorshipApplicationDto } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, TextField } from "../ui/index.js";
import { PlayError, PlayStepLayout, PuhuBubble } from "../onboarding-play/index.js";

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

/** The web's `CoachProfileStep`: the two lines a student reads first, plus optional claims. */
export function CoachProfileStep({
  progress, onBack, onSaved,
}: {
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("play");
  const tOnboarding = useTranslations("onboarding");
  const { space } = useThemeTokens();
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [institution, setInstitution] = useState("");
  const [branch, setBranch] = useState("");
  const [years, setYears] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canSave = headline.trim() !== "" && bio.trim() !== "" && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await http<MentorshipApplicationDto>("/v1/mentorship/coach-registration", {
        method: "POST",
        body: JSON.stringify({
          headline: headline.trim(),
          bio: bio.trim(),
          institution: orNull(institution),
          branch: orNull(branch),
          years: years.trim() === "" ? null : Number(years),
          note: null,
        }),
      });
      haptics.success();
      onSaved();
    } catch (err) {
      // A retry after a lost response: the first try already made them a coach, so the step is done.
      if (err instanceof ApiClientError && err.body.code === "MENTORSHIP_ALREADY_COACH") {
        haptics.success();
        onSaved();
        return;
      }
      haptics.error();
      setErrorMessage(err instanceof ApiClientError ? err.body.message : t("coach_profile_save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlayStepLayout
      progress={progress}
      onBack={onBack}
      busy={saving}
      heading={<PuhuBubble title={t("coach_profile_title")} sub={t("coach_profile_subtitle")} />}
      footer={
        <>
          <PlayError message={errorMessage} />
          <Button label={t("coach_profile_save")} disabled={!canSave} loading={saving} onPress={() => void save()} />
        </>
      }
    >
      <View style={{ gap: space.md }}>
        <TextField label={tOnboarding("coach_headline_label")} placeholder={tOnboarding("coach_headline_placeholder")} value={headline} onChangeText={setHeadline} editable={!saving} maxLength={120} />
        <TextField label={tOnboarding("coach_bio_label")} placeholder={tOnboarding("coach_bio_placeholder")} value={bio} onChangeText={setBio} editable={!saving} maxLength={1000} multiline />
        <AppText variant="caption" tone="secondary">{t("coach_profile_claims_intro")}</AppText>
        <TextField label={tOnboarding("coach_institution_label")} value={institution} onChangeText={setInstitution} editable={!saving} maxLength={160} />
        <TextField label={tOnboarding("coach_branch_label")} value={branch} onChangeText={setBranch} editable={!saving} maxLength={80} />
        <TextField label={tOnboarding("coach_years_label")} value={years} onChangeText={(value) => setYears(value.replace(/\D/g, "").slice(0, 2))} editable={!saving} keyboardType="number-pad" />
      </View>
    </PlayStepLayout>
  );
}
