import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import { CoachMessageBubble } from "../../../components/coach/coach-message-bubble.js";
import { CoachProfileMemoryCard } from "../../../components/coach/coach-profile-memory-card.js";
import {
  AppText,
  Button,
  Card,
  Chip,
  ScreenLoadingSkeleton,
  TextField,
} from "../../../components/ui/index.js";
import {
  fetchCoachAccess,
  listCoachConversations,
  listCoachMessages,
  sendCoachMessage,
} from "../../../lib/coach-api.js";
import { haptics } from "../../../lib/haptics.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    seed?: string;
    contextMockExamId?: string;
    contextArticleSlug?: string;
  }>();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("coach");
  const tCommon = useTranslations("common");

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [draft, setDraft] = useState<string>(params.seed ?? "");
  const [sending, setSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ephemeralFollowUps, setEphemeralFollowUps] = useState<string[]>([]);

  const accessQuery = useQuery({
    queryKey: ["coach", "access"],
    queryFn: fetchCoachAccess,
  });

  const conversationsQuery = useQuery({
    queryKey: ["coach", "conversations"],
    queryFn: () => listCoachConversations(10),
  });

  const resolvedConversationId =
    activeConversationId ??
    (!params.seed ? (conversationsQuery.data?.[0]?.id ?? null) : null);

  const messagesQuery = useQuery({
    queryKey: ["coach", "messages", resolvedConversationId],
    queryFn: () => listCoachMessages(resolvedConversationId!, 40),
    enabled: Boolean(resolvedConversationId),
  });

  // API returns newest-first; display oldest -> newest
  const chronologicalMessages = messagesQuery.data?.items
    ? [...messagesQuery.data.items].reverse()
    : [];

  const canChat = accessQuery.data?.canChat ?? true;

  const refreshCoach = async (convId?: string | null) => {
    const targetId = convId ?? resolvedConversationId;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["coach", "access"] }),
      queryClient.invalidateQueries({ queryKey: ["coach", "conversations"] }),
      ...(targetId
        ? [
            queryClient.invalidateQueries({
              queryKey: ["coach", "messages", targetId],
            }),
          ]
        : []),
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] }),
    ]);
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
    if (!text || sending || !canChat) return;
    setSending(true);
    setErrorMessage(null);
    haptics.selection();
    try {
      const reply = await sendCoachMessage({
        message: text,
        conversationId: resolvedConversationId ?? undefined,
        contextMockExamId: params.contextMockExamId || undefined,
        contextArticleSlug: params.contextArticleSlug || undefined,
      });
      setDraft("");
      setActiveConversationId(reply.conversationId);
      setEphemeralFollowUps(reply.followUps ?? []);
      haptics.success();
      await refreshCoach(reply.conversationId);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : tCommon("error_body"),
      );
    } finally {
      setSending(false);
    }
  };

  const handleNewChat = () => {
    haptics.selection();
    setActiveConversationId(null);
    setEphemeralFollowUps([]);
    setErrorMessage(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: palette.bg }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: space.xl,
          paddingHorizontal: space.lg,
          gap: space.lg,
        }}
      >
        {/* Header (Companion register — zero Coin in chat zone per Guardrail §4 #3) */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="title">{t("title")}</AppText>
            <AppText variant="body" tone="secondary">
              {t("subtitle")}
            </AppText>
          </View>
          <Chip
            label={t("new_chat_cta")}
            onPress={handleNewChat}
            tone="coach"
          />
        </View>

        <CoachProfileMemoryCard />

        {/* Recent Conversations Strip */}
        {conversationsQuery.data && conversationsQuery.data.length > 0 ? (
          <View style={{ gap: space.xs }}>
            <AppText variant="caption" tone="muted">
              {t("threads_title")}
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.threadsRow}
            >
              {conversationsQuery.data.map((conv) => (
                <Chip
                  key={conv.id}
                  label={conv.title}
                  selected={resolvedConversationId === conv.id}
                  onPress={() => {
                    setActiveConversationId(conv.id);
                    setEphemeralFollowUps([]);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Messages or Empty Companion Desk */}
        {messagesQuery.isLoading ? (
          <ScreenLoadingSkeleton />
        ) : chronologicalMessages.length === 0 ? (
          <Card variant="coach" style={{ gap: space.md }}>
            <AppText variant="cardTitle">{t("empty_chat_title")}</AppText>
            <AppText variant="body" tone="secondary">
              {t("empty_chat_body")}
            </AppText>
            <View style={styles.starterCol}>
              <Chip
                label={t("starter_plan")}
                onPress={() => void handleSend(t("starter_plan"))}
              />
              <Chip
                label={t("starter_focus")}
                onPress={() => void handleSend(t("starter_focus"))}
              />
              <Chip
                label={t("starter_exam")}
                onPress={() => void handleSend(t("starter_exam"))}
              />
            </View>
          </Card>
        ) : (
          <View style={{ gap: space.md }}>
            {chronologicalMessages.map((msg) => (
              <CoachMessageBubble
                key={msg.id}
                message={msg}
                onActionMutated={() => void refreshCoach()}
              />
            ))}
          </View>
        )}

        {/* Ephemeral Follow-up Chips */}
        {ephemeralFollowUps.length > 0 ? (
          <View style={styles.followUpWrap}>
            {ephemeralFollowUps.map((prompt) => (
              <Chip
                key={prompt}
                label={prompt}
                onPress={() => void handleSend(prompt)}
                tone="coach"
              />
            ))}
          </View>
        ) : null}

        {/* Composer Card */}
        <Card style={{ gap: space.md }}>
          {!canChat ? (
            <AppText variant="caption" tone="secondary">
              {t("access_unavailable")}
            </AppText>
          ) : null}

          <TextField
            label={t("title")}
            placeholder={t("input_placeholder")}
            value={draft}
            onChangeText={setDraft}
            multiline
          />

          {errorMessage ? (
            <AppText variant="caption" tone="danger">
              {errorMessage}
            </AppText>
          ) : null}

          <Button
            label={sending ? t("sending_cta") : t("send_cta")}
            onPress={() => void handleSend()}
            disabled={sending || !canChat || draft.trim().length === 0}
            variant="primary"
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  threadsRow: {
    flexDirection: "row",
    gap: 8,
  },
  starterCol: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  followUpWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
