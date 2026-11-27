import { useMemo } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import type { ForumCoachIntent, ZoneView } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunityReplyCard } from "../../components/community/community-reply-card.js";
import { ReplyBar } from "../../components/community/reply-bar.js";
import { FeedPostCard } from "../../components/community/feed-post-card.js";
import { PanelCard } from "../../components/panel/primitives.js";
import { AppText, Button, ScreenLoadingSkeleton, StateView } from "../../components/ui/index.js";
import { art } from "../../lib/art.js";
import { threadViewToPostModel } from "../../lib/community-view.js";
import {
  getQuestion,
  getThreadDetail,
  listForumZones,
  postQuestionAnswer,
  postThreadComment,
} from "../../lib/forum-api.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

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
  const { palette, space } = useThemeTokens();
  const t = useTranslations("community");

  const threadId = typeof id === "string" ? id.trim() : "";
  const isQuestion = kind === "question";

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

  async function handleReply(body: string, attachments: AttachmentInput[]) {
    if (isQuestion) await postQuestionAnswer({ threadId, body, attachments });
    else await postThreadComment({ threadId, body, attachments });
    await queryClient.invalidateQueries({ queryKey: ["forum"] });
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
              excerptLines={0}
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
                  onOpenReplies={() => router.push({ pathname: "/(app)/community-comment", params: { id: comment.id } })}
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
        <ReplyBar
          placeholder={isQuestion ? t("answer_placeholder") : t("comment_placeholder")}
          submitLabel={t("post_comment_cta")}
          onSubmit={handleReply}
        />
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
});
