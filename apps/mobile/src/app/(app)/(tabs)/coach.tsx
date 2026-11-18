import { useRef, useState } from "react";
import { ScrollView, View, type ScrollViewInstance } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import { CoachMessageBubble } from "../../../components/coach/coach-message-bubble.js";
import { CoachChatBackdrop, CoachComposer, CoachHistoryButton, CoachHistorySheet, CoachWelcome } from "../../../components/coach/coach-chat-chrome.js";
import { useKeyboardOpen } from "../../../components/navigation/role-tab-bar.js";
import {
  Chip,
  ScreenLoadingSkeleton,
} from "../../../components/ui/index.js";
import {
  fetchCoachAccess,
  fetchCoachProfile,
  listCoachConversations,
  listCoachMessages,
  sendCoachMessage,
} from "../../../lib/coach-api.js";
import { openCoachChat, type CoachChatRoute } from "../../../lib/coach-chat-state.js";
import { haptics } from "../../../lib/haptics.js";
import { tabBarClearance } from "../../../lib/layout.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function CoachScreen() {
  const entry = useLocalSearchParams<CoachChatRoute>();
  const { status } = useAuth();
  if (status !== "authenticated") return <ScreenLoadingSkeleton />;

  return (
    <CoachChat
      key={JSON.stringify([entry.seed, entry.contextMockExamId, entry.contextArticleSlug])}
      entry={entry}
    />
  );
}

function CoachChat({ entry }: { entry: CoachChatRoute }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("coach");
  const tCommon = useTranslations("common");

  const [chat, setChat] = useState(() => openCoachChat(entry));
  const [sending, setSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ephemeralFollowUps, setEphemeralFollowUps] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  const transcriptRef = useRef<ScrollViewInstance>(null);

  const accessQuery = useQuery({
    queryKey: ["coach", "access"],
    queryFn: fetchCoachAccess,
  });

  const conversationsQuery = useQuery({
    queryKey: ["coach", "conversations"],
    queryFn: () => listCoachConversations(10),
  });

  const profileQuery = useQuery({ queryKey: ["coach", "profile"], queryFn: fetchCoachProfile });

  const resolvedConversationId = chat.conversationId === undefined
    ? conversationsQuery.data?.[0]?.id ?? null
    : chat.conversationId;

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
    const text = (overrideText ?? chat.draft).trim();
    if (!text || sending || !canChat) return;
    setSending(true);
    setErrorMessage(null);
    haptics.selection();
    try {
      const reply = await sendCoachMessage({
        message: text,
        conversationId: resolvedConversationId ?? undefined,
        ...chat.context,
      });
      setChat(openCoachChat({}, reply.conversationId));
      setEphemeralFollowUps(reply.followUps ?? []);
      haptics.success();
      await refreshCoach(reply.conversationId);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiClientError ? err.body.message : tCommon("error_body"),
      );
    } finally {
      setSending(false);
    }
  };

  const selectConversation = (conversationId: string | null) => {
    if (sending || (conversationId !== null && conversationId === resolvedConversationId)) return;
    setChat(openCoachChat({}, conversationId));
    setEphemeralFollowUps([]);
    setErrorMessage(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <CoachChatBackdrop />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs }}>
        <CoachHistoryButton onPress={() => setHistoryOpen(true)} />
      </View>
      {messagesQuery.isLoading || profileQuery.isPending ? (
        <ScreenLoadingSkeleton />
      ) : chronologicalMessages.length === 0 ? (
        <CoachWelcome />
      ) : (
        <ScrollView
          ref={transcriptRef}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1 }}
          onContentSizeChange={() => transcriptRef.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={{
            flexGrow: 1,
            paddingVertical: space.sm,
            paddingHorizontal: space.lg,
            gap: space.md,
          }}
        >
          {chronologicalMessages.map((msg) => (
            <CoachMessageBubble
              key={msg.id}
              message={msg}
              onActionMutated={() => void refreshCoach()}
            />
          ))}
        </ScrollView>
      )}
      <View style={{ paddingBottom: keyboardOpen ? space.xs : tabBarClearance(insets.bottom) - space.md }}>
        <CoachComposer value={chat.draft} busy={sending} canChat={canChat} error={errorMessage} keyboardOpen={keyboardOpen}
          remaining={accessQuery.data?.freeCoinMessagesRemainingToday}
          onChange={(draft) => setChat((current) => ({ ...current, draft }))} onSend={() => void handleSend()}>
          {profileQuery.data?.calibrationStatus === "COMPLETED" || profileQuery.data?.calibrationStatus === "SKIPPED" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm, paddingBottom: space.sm }}>
              {(chronologicalMessages.length === 0
                ? [t("starter_plan"), t("starter_focus"), t("starter_exam")]
                : ephemeralFollowUps).map((prompt) => <Chip key={prompt} label={prompt}
                  onPress={() => setChat((current) => ({ ...current, draft: prompt }))}
                  style={{ backgroundColor: palette.surface, borderWidth: 0 }} />)}
            </View>
          ) : null}
        </CoachComposer>
      </View>
      {historyOpen ? <CoachHistorySheet open conversations={conversationsQuery.data ?? []}
        selectedId={resolvedConversationId} onSelect={selectConversation} onClose={() => setHistoryOpen(false)} /> : null}
    </View>
  );
}
