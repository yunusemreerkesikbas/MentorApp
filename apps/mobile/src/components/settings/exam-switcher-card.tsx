import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import {
  EXAM_CATALOG,
  EXAM_TYPES,
  type AuthUser,
  type ExamType,
  type ExamVariant,
} from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip } from "../ui/index.js";

export function ExamSwitcherCard({ user }: { user: AuthUser }) {
  const { setUserFromServer } = useAuth();
  const { space } = useThemeTokens();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tOnboarding = useTranslations("onboarding");

  const [examType, setExamType] = useState<ExamType | null>(user.examType);
  const [examVariant, setExamVariant] = useState<ExamVariant | null>(
    user.examVariant,
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  const variants = examType ? EXAM_CATALOG[examType].variants : [];
  const needsVariant = variants.length > 0;
  const dirty =
    examType !== user.examType ||
    (needsVariant
      ? examVariant !== user.examVariant
      : user.examVariant !== null);
  const canSave =
    Boolean(examType) &&
    (!needsVariant || Boolean(examVariant)) &&
    dirty &&
    !saving;

  const handleSave = async () => {
    if (!examType || !canSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = (await usersControllerUpdateMe({
        examType,
        examVariant: needsVariant ? examVariant : null,
      })) as unknown as AuthUser;
      setUserFromServer(updated);
      haptics.success();
      setFeedback({ tone: "success", text: t("exam_saved") });
    } catch (err) {
      haptics.error();
      setFeedback({
        tone: "danger",
        text:
          err instanceof ApiClientError ? err.body.message : tOnboarding("save_error"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 4 }}>
        <AppText variant="sectionHeading">{t("exam_label")}</AppText>
        <AppText variant="caption" tone="secondary">
          {t("exam_subtitle")}
        </AppText>
      </View>

      <View style={styles.chipRow}>
        {EXAM_TYPES.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={examType === item}
            onPress={() => {
              setExamType(item);
              setFeedback(null);
              if (EXAM_CATALOG[item].variants.length === 0) {
                setExamVariant(null);
              } else if (!examVariant) {
                setExamVariant(EXAM_CATALOG[item].variants[0] ?? null);
              }
            }}
          />
        ))}
      </View>

      {needsVariant ? (
        <View style={styles.chipRow}>
          {variants.map((variant) => (
            <Chip
              key={variant}
              label={tOnboarding(`kpss_variant_${variant}`)}
              selected={examVariant === variant}
              onPress={() => {
                setExamVariant(variant);
                setFeedback(null);
              }}
            />
          ))}
        </View>
      ) : null}

      {feedback ? (
        <AppText variant="caption" tone={feedback.tone}>
          {feedback.text}
        </AppText>
      ) : null}

      {dirty ? (
        <Button
          label={tCommon("save")}
          loading={saving}
          disabled={!canSave}
          onPress={() => {
            void handleSave();
          }}
          variant="primary"
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
