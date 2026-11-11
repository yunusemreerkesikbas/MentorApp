import { useState } from "react";
import { View } from "react-native";
import {
  availableAppDestination,
  homePathForUser,
  ONBOARDING_DAILY_GOALS,
  ONBOARDING_RECOMMENDED_GOAL_MINUTES,
  type OnboardingAudience,
  type OnboardingDailyGoalPreset,
} from "@mentor/core";
import { ApiClientError, http, usersControllerUpdateMe } from "@mentor/api-client";
import type {
  AuthUser,
  CareerGroup,
  MentorshipApplicationDto,
} from "@mentor/types";
import { updateMeSchema, usernameSchema } from "@mentor/validation";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Card, TextField } from "../ui/index.js";
import { OnboardingStepShell, PlayOptionCard } from "./step-shell.js";

export interface ReadySummary {
  dailyGoalMinutes: number | null;
  careerGroup: CareerGroup | null;
}

export function DailyGoalStep({
  user,
  progress,
  onBack,
  onSkip,
  onSaved,
}: {
  user: AuthUser;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSkip: () => void;
  onSaved: (minutes: number) => void;
}) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const { setUserFromServer } = useAuth();
  const { space } = useThemeTokens();
  const [selected, setSelected] = useState<number | null>(() =>
    user.dailyFocusGoalMinutes != null &&
    Number.isInteger(user.dailyFocusGoalMinutes) &&
    user.dailyFocusGoalMinutes >= 10 &&
    user.dailyFocusGoalMinutes <= 600
      ? user.dailyFocusGoalMinutes
      : ONBOARDING_RECOMMENDED_GOAL_MINUTES,
  );
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPreset = ONBOARDING_DAILY_GOALS.some((m) => m === selected);
  const valid =
    selected != null &&
    Number.isInteger(selected) &&
    selected >= 10 &&
    selected <= 600;

  const reactionText = !valid
    ? t("daily_goal_subtitle")
    : isPreset
      ? t(`daily_goal_reaction_${selected as OnboardingDailyGoalPreset}`)
      : t("daily_goal_reaction_custom");

  const handleSave = async () => {
    if (!valid || selected == null || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = (await usersControllerUpdateMe({
        dailyFocusGoalMinutes: selected,
      })) as unknown as AuthUser;
      setUserFromServer(updated);
      haptics.success();
      onSaved(selected);
    } catch (err) {
      haptics.error();
      setErrorMessage(
        err instanceof ApiClientError ? err.body.message : t("save_error"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepShell
      title={t("daily_goal_title")}
      subtitle={reactionText}
      progress={progress}
      onBack={onBack}
      skipLabel={tCommon("skip")}
      onSkip={onSkip}
      errorMessage={errorMessage}
      primaryLabel={tCommon("continue")}
      primaryDisabled={!valid}
      primaryLoading={saving}
      onPrimary={() => {
        void handleSave();
      }}
    >
      <View style={{ gap: space.sm }}>
        {ONBOARDING_DAILY_GOALS.map((minutes) => (
          <PlayOptionCard
            key={minutes}
            label={t(`daily_goal_level_${minutes}`)}
            subtitle={t("daily_goal_minutes", { minutes })}
            badge={
              minutes === ONBOARDING_RECOMMENDED_GOAL_MINUTES
                ? t("daily_goal_recommended")
                : undefined
            }
            selected={selected === minutes}
            disabled={saving}
            onPress={() => {
              setSelected(minutes);
              setCustomInput("");
            }}
          />
        ))}

        <TextField
          label={`${t("daily_goal_custom")} (${t("daily_goal_unit")})`}
          placeholder="90"
          keyboardType="number-pad"
          value={customInput}
          onChangeText={(txt) => {
            setCustomInput(txt);
            const num = Number.parseInt(txt.trim(), 10);
            setSelected(Number.isNaN(num) ? null : num);
          }}
          errorMessage={
            customInput.trim().length > 0 && !valid
              ? t("daily_goal_invalid")
              : null
          }
        />
      </View>
    </OnboardingStepShell>
  );
}

export function CoachProfileStep({
  progress,
  onBack,
  onSaved,
}: {
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("onboarding");
  const { space } = useThemeTokens();
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [institution, setInstitution] = useState("");
  const [branch, setBranch] = useState("");
  const [years, setYears] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSave = headline.trim() !== "" && bio.trim() !== "" && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await http<MentorshipApplicationDto>(
        "/v1/mentorship/coach-registration",
        {
          method: "POST",
          body: JSON.stringify({
            headline: headline.trim(),
            bio: bio.trim(),
            institution:
              institution.trim() === "" ? null : institution.trim(),
            branch: branch.trim() === "" ? null : branch.trim(),
            years: years.trim() === "" ? null : Number(years),
            note: null,
          }),
        },
      );
      haptics.success();
      onSaved();
    } catch (err) {
      haptics.error();
      setErrorMessage(
        err instanceof ApiClientError ? err.body.message : t("save_error"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepShell
      title={t("coach_profile_title")}
      subtitle={t("coach_profile_subtitle")}
      progress={progress}
      onBack={onBack}
      errorMessage={errorMessage}
      primaryLabel={t("coach_save_cta")}
      primaryDisabled={!canSave}
      primaryLoading={saving}
      onPrimary={() => {
        void handleSave();
      }}
    >
      <View style={{ gap: space.md }}>
        <TextField
          label={t("coach_headline_label")}
          placeholder={t("coach_headline_placeholder")}
          value={headline}
          onChangeText={setHeadline}
          maxLength={120}
        />
        <TextField
          label={t("coach_bio_label")}
          placeholder={t("coach_bio_placeholder")}
          value={bio}
          onChangeText={setBio}
          maxLength={1000}
          multiline
        />
        <AppText variant="caption" tone="secondary">
          {t("coach_claims_intro")}
        </AppText>
        <TextField
          label={t("coach_institution_label")}
          value={institution}
          onChangeText={setInstitution}
          maxLength={160}
        />
        <TextField
          label={t("coach_branch_label")}
          value={branch}
          onChangeText={setBranch}
          maxLength={80}
        />
        <TextField
          label={t("coach_years_label")}
          value={years}
          onChangeText={setYears}
          keyboardType="number-pad"
        />
      </View>
    </OnboardingStepShell>
  );
}

export function ProfileStep({
  user,
  progress,
  onBack,
  onSaved,
}: {
  user: AuthUser;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const { setUserFromServer } = useAuth();
  const [username, setUsername] = useState(user.username ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsed = usernameSchema.safeParse(username);

  const handleSave = async () => {
    if (!parsed.success || saving) return;
    if (user.username === parsed.data) {
      onSaved();
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const payload = updateMeSchema.parse({ username: parsed.data });
      const updated = (await usersControllerUpdateMe(
        payload,
      )) as unknown as AuthUser;
      setUserFromServer(updated);
      haptics.success();
      onSaved();
    } catch (err) {
      haptics.error();
      setErrorMessage(
        err instanceof ApiClientError ? err.body.message : t("save_error"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepShell
      title={t("profile_title")}
      progress={progress}
      onBack={onBack}
      errorMessage={errorMessage}
      primaryLabel={tCommon("continue")}
      primaryDisabled={!parsed.success}
      primaryLoading={saving}
      onPrimary={() => {
        void handleSave();
      }}
    >
      <TextField
        label={`${t("username_label")} (@)`}
        placeholder={t("username_placeholder")}
        value={username}
        onChangeText={(val) => {
          setUsername(val.toLowerCase());
          setErrorMessage(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
        hint={t("username_hint")}
      />
    </OnboardingStepShell>
  );
}

export function CompleteStep({
  user,
  audience,
  summary,
  onFinish,
}: {
  user: AuthUser;
  audience: OnboardingAudience;
  summary: ReadySummary;
  onFinish: (destination: string) => void;
}) {
  const t = useTranslations("onboarding");
  const { availability } = useAppAvailability();
  const { space } = useThemeTokens();

  const destination =
    availableAppDestination(homePathForUser(user), user, availability) ??
    homePathForUser(user);

  const examLine = user.examType
    ? user.examType === "KPSS" && user.examVariant
      ? `${user.examType} · ${t(`kpss_variant_${user.examVariant}`)}`
      : user.examType
    : null;

  return (
    <OnboardingStepShell
      title={
        audience === "coach" ? t("complete_title_coach") : t("complete_title")
      }
      subtitle={
        audience === "coach"
          ? t("complete_subtitle_coach")
          : t("complete_subtitle")
      }
      progress={null}
      primaryLabel={t("complete_cta")}
      onPrimary={() => {
        haptics.success();
        onFinish(destination);
      }}
    >
      <Card style={{ gap: space.md }}>
        {examLine ? (
          <AppText variant="cardTitle">
            🎯 {t("summary_exam", { exam: examLine })}
          </AppText>
        ) : null}
        {summary.dailyGoalMinutes ? (
          <AppText variant="body">
            ⏱️ {t("summary_goal", { minutes: summary.dailyGoalMinutes })}
          </AppText>
        ) : null}
        {summary.careerGroup ? (
          <AppText variant="body">
            🧭{" "}
            {t("summary_field", {
              field: t(`field_group_${summary.careerGroup}`),
            })}
          </AppText>
        ) : null}
        {audience === "student" ? (
          <AppText variant="caption" tone="secondary">
            📅 {t("summary_countdown")}
          </AppText>
        ) : null}
      </Card>
    </OnboardingStepShell>
  );
}
