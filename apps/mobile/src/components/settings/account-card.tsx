import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ApiClientError, http, usersControllerUpdateMe } from "@mentor/api-client";
import { isCoach } from "@mentor/core";
import { EXAM_CATALOG, EXAM_TYPES, type AuthUser, type ExamType, type ExamVariant } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { errorText } from "../../lib/plan-view.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { ActionSheet } from "../panel/primitives.js";
import { ConfirmDialog } from "../ui/confirm-dialog.js";
import { SettingsCard, SettingsRow } from "./settings-row.js";

/**
 * The web's `AccountLinksCard`: exam, joined, Koçum, Koç ol, sign out, delete. The subscription row
 * stays off on mobile (no Premium sales in the app).
 */
export function AccountCard({ user }: { user: AuthUser }) {
  const t = useTranslations("settings");
  const tOnboarding = useTranslations("onboarding");
  const router = useRouter();
  const toast = useToast();
  const { locale } = useLocale();
  const { logout, setUserFromServer } = useAuth();
  const { availability } = useAppAvailability();
  const coach = isCoach(user);
  const [examSheet, setExamSheet] = useState<"type" | ExamType | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const signupOpen = useQuery({
    queryKey: ["coach-signup", "status"],
    queryFn: async () => ((await http<{ open?: boolean }>("/v1/auth/coach-signup/status")) as { open?: boolean }).open === true,
    enabled: availability.coachRegistration && !coach,
  }).data === true;

  const variantLabel = (variant: ExamVariant) => tOnboarding(`kpss_variant_${variant}`);
  const examSummary = user.examType
    ? user.examVariant ? `${user.examType} · ${variantLabel(user.examVariant)}` : user.examType
    : undefined;
  const joined = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(user.createdAt));

  async function saveExam(examType: ExamType, examVariant: ExamVariant | null) {
    try {
      setUserFromServer((await usersControllerUpdateMe({ examType, examVariant })) as unknown as AuthUser);
      haptics.success();
      toast.show(t("exam_saved_toast"));
    } catch (err) {
      haptics.error();
      toast.show(err instanceof ApiClientError ? err.body.message : t("exam_save_error"));
    }
  }

  // Store rule (Play + App Store): in-app account deletion. The server revokes every session.
  async function deleteAccount() {
    setDeleteOpen(false);
    setDeleting(true);
    try {
      await http<void>("/v1/account", { method: "DELETE" });
    } catch (error) {
      setDeleting(false);
      toast.show(errorText(error, t("delete_account_error")));
      return;
    }
    await logout().catch(() => undefined);
    router.replace("/(auth)/welcome" as never);
  }

  return (
    <SettingsCard title={t("account_section")}>
      <SettingsRow label={t(coach ? "exam_row_coach" : "exam_row")} description={examSummary} onPress={() => setExamSheet("type")} />
      <SettingsRow label={t("member_since")} description={joined} />
      {availability.humanCoaching && !coach ? (
        <SettingsRow label={t("my_coach")} onPress={() => router.push("/(app)/my-coach" as never)} />
      ) : null}
      {availability.coachRegistration && signupOpen && !coach ? (
        <SettingsRow label={t("become_coach")} description={t("become_coach_hint")}
          onPress={() => router.push("/(app)/coach-application" as never)} />
      ) : null}
      <SettingsRow label={t("logout_cta")} chevron={false}
        onPress={() => void logout().then(() => router.replace("/(auth)/welcome" as never))} />
      <SettingsRow label={deleting ? t("delete_account_deleting") : t("delete_account_cta")} danger chevron={false}
        onPress={() => { if (!deleting) setDeleteOpen(true); }} />

      {/* KPSS needs its level before anything is saved: the three guides have different exam dates. */}
      <ActionSheet
        title={examSheet === "type" ? t("exam_sheet_title") : examSheet ? t(coach ? "exam_variant_label_coach" : "exam_variant_label") : null}
        onClose={() => setExamSheet(null)}
        actions={examSheet === "type"
          ? EXAM_TYPES.map((exam) => ({
            label: user.examType === exam ? `${exam} ✓` : exam,
            onPress: () => {
              if (EXAM_CATALOG[exam].variants.length > 0) setExamSheet(exam);
              else { setExamSheet(null); void saveExam(exam, null); }
            },
          }))
          : examSheet ? EXAM_CATALOG[examSheet].variants.map((variant) => ({
            label: variantLabel(variant),
            onPress: () => { const exam = examSheet; setExamSheet(null); void saveExam(exam, variant); },
          })) : []}
      />

      <ConfirmDialog
        visible={deleteOpen}
        title={t("delete_account_title")}
        message={t("delete_account_body")}
        confirmLabel={t("delete_account_confirm")}
        cancelLabel={t("delete_account_cancel")}
        destructive
        onConfirm={() => void deleteAccount()}
        onCancel={() => setDeleteOpen(false)}
      />
    </SettingsCard>
  );
}
