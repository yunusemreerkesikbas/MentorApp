import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { isPastDate } from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { createPlanTaskSchema } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { createPlanTask } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, TextField } from "../ui/index.js";

export interface PlanTaskComposerProps {
  selectedDate: string;
  onTaskCreated: (task: PlanTaskDto) => void;
}

export function PlanTaskComposer({
  selectedDate,
  onTaskCreated,
}: PlanTaskComposerProps) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const { space } = useThemeTokens();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [durationRaw, setDurationRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const past = isPastDate(selectedDate);

  if (past) {
    return (
      <Card variant="alt">
        <AppText variant="caption" tone="muted">
          {t("past_date_readonly")}
        </AppText>
      </Card>
    );
  }

  const handleSubmit = async () => {
    if (busy) return;
    setErrorMessage(null);

    const parsedDuration =
      durationRaw.trim().length > 0 ? Number(durationRaw.trim()) : null;
    if (
      parsedDuration !== null &&
      (!Number.isInteger(parsedDuration) ||
        parsedDuration < 5 ||
        parsedDuration > 200)
    ) {
      setErrorMessage(tAuth("invalid_form"));
      return;
    }

    const parsed = createPlanTaskSchema.safeParse({
      taskDate: selectedDate,
      title,
      subject: subject.trim() || null,
      durationMinutes: parsedDuration,
    });

    if (!parsed.success) {
      setErrorMessage(tAuth("invalid_form"));
      return;
    }

    setBusy(true);
    try {
      const created = await createPlanTask(parsed.data);
      haptics.success();
      setTitle("");
      setSubject("");
      setDurationRaw("");
      onTaskCreated(created);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : tCommon("error_body"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <AppText variant="cardTitle">{t("add_task_title")}</AppText>

      <TextField
        label={t("task_title_label")}
        placeholder={t("task_title_placeholder")}
        value={title}
        onChangeText={setTitle}
      />

      <View style={styles.splitInputs}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t("task_subject_label")}
            placeholder={t("task_subject_placeholder")}
            value={subject}
            onChangeText={setSubject}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t("task_duration_label")}
            placeholder={t("task_duration_placeholder")}
            keyboardType="number-pad"
            value={durationRaw}
            onChangeText={setDurationRaw}
          />
        </View>
      </View>

      {errorMessage ? (
        <AppText variant="caption" tone="danger">
          {errorMessage}
        </AppText>
      ) : null}

      <Button
        label={busy ? tCommon("loading") : t("task_add_cta")}
        onPress={() => void handleSubmit()}
        disabled={busy || title.trim().length === 0}
        variant="primary"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  splitInputs: {
    flexDirection: "row",
    gap: 12,
  },
});
