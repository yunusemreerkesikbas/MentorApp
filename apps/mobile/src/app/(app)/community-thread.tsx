import { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import type { ForumCoachIntent, ZoneView } from "@mentor/types";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunityReplyCard } from "../../components/community/community-reply-card.js";
import { FeedPostCard } from "../../components/community/feed-post-card.js";
import { PanelCard } from "../../components/panel/primitives.js";
import { AppText, Button, ScreenLoadingSkeleton, StateView } from "../../components/ui/index.js";
import { art } from "../../lib/art.js";
import { threadViewToPostModel } from "../../lib/community-view.js";
import { fontFamilyFor } from "../../lib/fonts.js";
import {
  getQuestion,
  getThreadDetail,
  listForumZones,
  postQuestionAnswer,
  postThreadComment,
} from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";

function bridgeLabelKey(intent: ForumCoachIntent) {
  if (intent === "PLAN") return "coach_bridge_PLAN" as const;
  if (intent === "NEXT_STEP") return "coach_bridge_NEXT_STEP" as const;
  if (intent === "STUDY_METHOD") return "coach_bridge_STUDY_METHOD" as const;
  return "coach_bridge_STRATEGY" as const;
}

export default function CommunityThreadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { user } = useAuth();
  const { palette, radii, space, typeScale } = useThemeTokens();
  const t = useTranslations("community");
  const toast = useToast();

  const threadId = typeof id === "string" ? id.trim() : "";
  const isQuestion = kind === "question";
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const zonesQuery = useQuery({
    queryKey: ["forum", "zones"],
    queryFn: listForumZones,
  });

  const questionQuery = useQuery({
    queryKey: ["forum", "detail", threadId, "question"],
    queryFn: () => getQuestion(threadId),
    enabled: Boolean(threadId) && isQuestion,
  });

  const threadQuery = useQuery({
    queryKey: ["forum", "detail", threadId, "thread"],
    queryFn: () => getThreadDetail(threadId),
    enabled: Boolean(threadId) && !isQuestion,
  });

  const activeQuery = isQuestion ? questionQuery : threadQuery;
  const thread = isQuestion ? questionQuery.data?.question : threadQuery.data?.thread;

  const zoneRef = useMemo(() => {
    if (!thread) return null;
    const matched = (zonesQuery.data as ZoneView[] | undefined)?.find((z) => z.id === thread.zoneId);
    if (matched) {
      return { id: matched.id, title: matched.title, slug: matched.slug, type: matched.type };
    }
    const pageZone = isQuestion ? questionQuery.data?.pageContext?.zone : threadQuery.data?.adContext?.zone;
    return {
      id: thread.zoneId,
      title: pageZone?.title ?? t(isQuestion ? "type_qa" : "type_chat"),
      slug: pageZone?.slug ?? "",
      type: isQuestion ? ("QA" as const) : ("CHAT" as const),
    };
  }, [isQuestion, questionQuery.data, t, thread, threadQuery.data, zonesQuery.data]);

  const postModel = useMemo(
    () => (thread && zoneRef ? threadViewToPostModel(thread, zoneRef) : null),
    [thread, zoneRef],
  );

  async function handleReply() {
    const trimmed = replyText.trim();
    if (!trimmed || !threadId || sending) return;
    setSending(true);
    try {
      if (isQuestion) await postQuestionAnswer({ threadId, body: trimmed });
      else await postThreadComment({ threadId, body: trimmed });
      haptics.success();
      setReplyText("");
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("composer_error"));
    } finally {
      setSending(false);
    }
  }

  const canAcceptBase = Boolean(
    isQuestion && thread && user && user.id === thread.authorId && thread.status === "OPEN",
  );
  const bridge = thread?.coachBridge ?? null;
  const answers = questionQuery.data?.answers ?? [];
  const comments = threadQuery.data?.comments ?? [];

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.topChrome,
          {
            paddingTop: insets.top,
            backgroundColor: palette.surface,
            borderBottomColor: palette.playLine,
          },
        ]}
      >
        <View style={styles.navBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back_cta")}
            onPress={() => router.back()}
            style={styles.iconBtn}
          >
            <AltArrowLeftIcon size={22} color={palette.main} strokeWidth={1.75} />
          </Pressable>
          <AppText accessibilityRole="header" style={styles.navTitle} numberOfLines={1}>
            {thread?.title ?? t(isQuestion ? "type_qa" : "type_chat")}
          </AppText>
          <View style={styles.spacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: space.md, paddingBottom: 24, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {!threadId ? (
          <StateView title={t("error_title")} body={t("profile_not_found")} />
        ) : activeQuery.isLoading ? (
          <ScreenLoadingSkeleton />
        ) : activeQuery.isError || !postModel ? (
          <StateView
            tone="error"
            title={t("error_title")}
            body={
              activeQuery.error instanceof ApiClientError
                ? activeQuery.error.message
                : t("soon_desc")
            }
            actionLabel={t("retry")}
            onAction={() => void activeQuery.refetch()}
          />
        ) : (
          <>
            <FeedPostCard
              post={postModel}
              excerptLines={undefined}
              onOpenThread={() => undefined}
              onOpenMember={(username) =>
                router.push({ pathname: "/(app)/community-member", params: { username } })
              }
              onOpenZone={(slug) =>
                slug
                  ? router.replace({
                      pathname: "/(app)/(tabs)/community",
                      params: { tab: "forum", zoneSlug: slug },
                    })
                  : undefined
              }
              onSelectTag={(slug) =>
                router.replace({
                  pathname: "/(app)/(tabs)/community",
                  params: { tab: "feed", tag: slug },
                })
              }
              onDeleted={() => router.back()}
            />

            {bridge ? (
              <PanelCard style={styles.bridgeCard}>
                <View style={styles.bridgeTop}>
                  <Image source={art.puhuDefault} style={styles.bridgeMascot} resizeMode="contain" />
                  <AppText variant="body" style={{ flex: 1 }}>
                    {t("coach_bridge_hint")}
                  </AppText>
                </View>
                <Button
                  label={t(bridgeLabelKey(bridge.intent))}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/(tabs)/coach",
                      params: {
                        seed: bridge.threadTitle ?? thread?.body.slice(0, 140) ?? "",
                      },
                    })
                  }
                />
              </PanelCard>
            ) : null}

            <AppText variant="cardTitle">
              {isQuestion ? t("answers_title") : t("comments_title")}
            </AppText>

            {isQuestion ? (
              answers.length === 0 ? (
                <StateView title={t("answer_compose_title")} body={t("answers_empty")} />
              ) : (
                answers.map((answer) => (
                  <CommunityReplyCard
                    key={answer.id}
                    reply={{
                      kind: "answer",
                      item: answer,
                      canAccept: canAcceptBase && !answer.isAccepted && answer.authorId !== user?.id,
                    }}
                    threadId={threadId}
                    onOpenMember={(username) =>
                      router.push({ pathname: "/(app)/community-member", params: { username } })
                    }
                  />
                ))
              )
            ) : comments.length === 0 ? (
              <StateView title={t("comments_title")} body={t("comments_empty")} />
            ) : (
              comments.map((comment) => (
                <CommunityReplyCard
                  key={comment.id}
                  reply={{ kind: "comment", item: comment }}
                  threadId={threadId}
                  onOpenMember={(username) =>
                    router.push({ pathname: "/(app)/community-member", params: { username } })
                  }
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {postModel ? (
        <View
          style={[
            styles.replyBar,
            {
              backgroundColor: palette.surface,
              borderTopColor: palette.playLine,
              paddingBottom: Math.max(10, insets.bottom),
            },
          ]}
        >
          <TextInput
            accessibilityLabel={isQuestion ? t("answer_placeholder") : t("comment_placeholder")}
            placeholder={isQuestion ? t("answer_placeholder") : t("comment_placeholder")}
            placeholderTextColor={palette.muted}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={4000}
            style={[
              styles.replyInput,
              {
                backgroundColor: palette.surfaceAlt,
                borderColor: palette.border,
                borderRadius: radii.inner,
                color: palette.main,
                fontSize: typeScale.body.fontSize,
                fontFamily: fontFamilyFor(typeScale.body.fontWeight),
              },
            ]}
          />
          <Button
            label={t("post_comment_cta")}
            onPress={() => void handleReply()}
            loading={sending}
            disabled={!replyText.trim()}
            variant="primary"
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topChrome: { borderBottomWidth: StyleSheet.hairlineWidth },
  navBar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "800", textAlign: "center" },
  spacer: { width: 44 },
  scroll: { flex: 1 },
  bridgeCard: { gap: 10 },
  bridgeTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  bridgeMascot: { width: 40, height: 40 },
  replyBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
