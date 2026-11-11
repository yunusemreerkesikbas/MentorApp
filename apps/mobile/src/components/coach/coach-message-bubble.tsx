import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import type { CoachActionStatus, CoachMessageDto } from "@mentor/types";
import { decideCoachAction, setCoachMessageFeedback } from "../../lib/coach-api.js";
import { createPlanTask } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip } from "../ui/index.js";

export interface CoachMessageBubbleProps {
  message: CoachMessageDto;
  onActionMutated: () => void;
}

export function CoachMessageBubble({
  message,
  onActionMutated,
}: CoachMessageBubbleProps) {
  const router = useRouter();
  const t = useTranslations("coach");
  const tDash = useTranslations("dashboard");
  const { palette, radii, space } = useThemeTokens();

  const [actionStatus, setActionStatus] = useState<CoachActionStatus | undefined>(
    message.actionStatus,
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [suggestedAdded, setSuggestedAdded] = useState(false);
  const [feedback, setFeedback] = useState<number | null>(message.feedback);

  const isUser = message.role === "USER";

  const handleDecision = async (decision: "ACCEPT" | "CANCEL") => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const res = await decideCoachAction(message.id, { decision });
      setActionStatus(res.status);
      haptics.success();
      onActionMutated();
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddSuggestedTask = async () => {
    if (!message.suggestedTask || suggestedAdded || actionBusy) return;
    setActionBusy(true);
    try {
      await createPlanTask({
        title: message.suggestedTask.title,
        subject: message.suggestedTask.subject,
      });
      setSuggestedAdded(true);
      haptics.success();
      onActionMutated();
    } finally {
      setActionBusy(false);
    }
  };

  const handleFeedback = async (next: 1 | -1) => {
    const value = feedback === next ? null : next;
    setFeedback(value);
    haptics.selection();
    try {
      await setCoachMessageFeedback(message.id, value);
    } catch {
      // Best-effort rating
    }
  };

  if (isUser) {
    return (
      <View
        style={[
          styles.userBubble,
          {
            backgroundColor: palette.ctaPlayBg,
            borderColor: palette.ctaPlayEdge,
            borderRadius: radii.card,
            padding: space.md,
          },
        ]}
      >
        <AppText variant="body" style={{ color: palette.ctaPlayInk }}>
          {message.content}
        </AppText>
      </View>
    );
  }

  return (
    <Card variant="coach" style={{ gap: space.md }}>
      <AppText variant="caption" tone="coach">
        Puhu
      </AppText>

      <AppText variant="body" tone="main">
        {message.content}
      </AppText>

      {/* Official Countdown Data Card (Guardrail §4 #1 — verbatim, never paraphrased) */}
      {message.officialCountdown ? (
        <View
          style={[
            styles.subBox,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.inner,
              padding: space.md,
              gap: 4,
            },
          ]}
        >
          <AppText variant="caption" tone="secondary">
            {message.officialCountdown.examName} · {tDash("countdown_title")}
          </AppText>
          <AppText variant="cardTitle" tabularNums>
            {tDash("countdown_days", {
              days: message.officialCountdown.daysRemaining,
            })}
          </AppText>
          <AppText variant="caption">
            {message.officialCountdown.examDateLabel}
          </AppText>
          <AppText variant="micro" tone="muted">
            {tDash("countdown_source", {
              source: message.officialCountdown.source,
            })}
          </AppText>
        </View>
      ) : null}

      {/* Proposed Coach Action */}
      {message.action ? (
        <View
          style={[
            styles.subBox,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.inner,
              padding: space.md,
              gap: space.sm,
            },
          ]}
        >
          <AppText variant="cardTitle">{message.action.label}</AppText>
          {actionStatus === "ACCEPTED" || actionStatus === "COMPLETED" ? (
            <Chip label={t("action_accepted")} tone="success" />
          ) : actionStatus === "CANCELLED" ? (
            <Chip label={t("action_cancelled")} tone="default" />
          ) : (
            <View style={styles.rowBtns}>
              <View style={{ flex: 1 }}>
                <Button
                  label={t("action_accept_cta")}
                  onPress={() => void handleDecision("ACCEPT")}
                  disabled={actionBusy}
                  variant="primary"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={t("action_cancel_cta")}
                  onPress={() => void handleDecision("CANCEL")}
                  disabled={actionBusy}
                  variant="secondary"
                />
              </View>
            </View>
          )}
        </View>
      ) : message.suggestedTask ? (
        <View
          style={[
            styles.subBox,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.inner,
              padding: space.md,
              gap: space.sm,
            },
          ]}
        >
          <AppText variant="body">{message.suggestedTask.title}</AppText>
          {suggestedAdded ? (
            <Chip label={t("suggested_task_added")} tone="success" />
          ) : (
            <Button
              label={t("add_suggested_task_cta")}
              onPress={() => void handleAddSuggestedTask()}
              disabled={actionBusy}
              variant="primary"
            />
          )}
        </View>
      ) : null}

      {/* Verified Editorial Sources */}
      {message.sources.length > 0 ? (
        <View style={{ gap: 4 }}>
          <AppText variant="micro" tone="muted">
            {t("sources_label")}
          </AppText>
          <View style={styles.chipRow}>
            {message.sources.map((src) => (
              <Chip
                key={src.slug}
                label={src.title}
                tone="default"
                onPress={() => {
                  haptics.selection();
                  router.push({
                    pathname: "/(app)/knowledge" as never,
                    params: { slug: src.slug },
                  });
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Helpful / Feedback Row */}
      <View style={styles.feedbackRow}>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => void handleFeedback(1)}
        >
          <AppText
            variant="micro"
            tone={feedback === 1 ? "success" : "muted"}
          >
            👍 {t("helpful_yes")}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => void handleFeedback(-1)}
        >
          <AppText
            variant="micro"
            tone={feedback === -1 ? "warning" : "muted"}
          >
            👎 {t("helpful_no")}
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    borderWidth: 1,
  },
  subBox: {
    borderWidth: 1,
  },
  rowBtns: {
    flexDirection: "row",
    gap: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
});
