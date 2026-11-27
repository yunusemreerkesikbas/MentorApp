import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import type { CommentView } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunityReplyCard } from "../../components/community/community-reply-card.js";
import { ReplyBar } from "../../components/community/reply-bar.js";
import { AppText, Chip, ScreenLoadingSkeleton, StateView } from "../../components/ui/index.js";
import { getCommentDetail, isForumDisabled, postCommentReply } from "../../lib/forum-api.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

/**
 * The web's `/topluluk/yorum/[postId]`: one comment, its direct replies (oldest first) and a reply
 * bar. Tapping a reply's reply pill opens this screen for that reply, like the web's nesting.
 */
export default function CommunityCommentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, highlight } = useLocalSearchParams<{ id?: string; highlight?: string }>();
  const { availability } = useAppAvailability();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("community");
  const postId = typeof id === "string" ? id.trim() : "";
  const detail = useQuery({
    queryKey: ["forum", "comment", postId],
    queryFn: () => getCommentDetail(postId),
    enabled: Boolean(postId) && availability.forum,
  });
  const comment = detail.data?.comment;

  const openMember = (username: string) => router.push({ pathname: "/(app)/community-member", params: { username } });
  const openComment = (target: string) => router.push({ pathname: "/(app)/community-comment", params: { id: target } });
  const card = (item: CommentView, highlighted = false) => (
    <CommunityReplyCard key={item.id} reply={{ kind: "comment", item }} threadId={item.threadId}
      onOpenMember={openMember} highlighted={highlighted}
      onOpenReplies={item.id === postId ? undefined : () => openComment(item.id)} />
  );

  async function reply(body: string, attachments: AttachmentInput[]) {
    await postCommentReply({ postId, body, attachments });
    await queryClient.invalidateQueries({ queryKey: ["forum"] });
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: palette.bg }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.topChrome, { paddingTop: insets.top, backgroundColor: palette.surface, borderBottomColor: palette.playLine }]}>
        <View style={styles.navBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("back_cta")} onPress={() => router.back()} style={styles.iconBtn}>
            <AltArrowLeftIcon size={22} color={palette.main} strokeWidth={1.75} />
          </Pressable>
          <AppText accessibilityRole="header" style={styles.navTitle} numberOfLines={1}>{t("comment_detail_title")}</AppText>
          <View style={styles.iconBtn} />
        </View>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        {!availability.forum || isForumDisabled(detail.error) ? (
          <StateView title={t("soon_title")} body={t("soon_desc")} />
        ) : !postId ? (
          <StateView title={t("error_title")} body={t("profile_not_found")} />
        ) : detail.isPending ? (
          <ScreenLoadingSkeleton />
        ) : detail.isError || !comment ? (
          <StateView tone="error" title={t("error_title")}
            body={detail.error instanceof ApiClientError ? detail.error.message : t("soon_desc")}
            actionLabel={t("retry")} onAction={() => void detail.refetch()} />
        ) : (
          <>
            <View style={styles.crumbs}>
              {comment.parentPostId ? (
                <Chip label={t("comment_detail_parent")} onPress={() => openComment(comment.parentPostId!)} />
              ) : (
                <Chip label={t("post_detail_title")}
                  onPress={() => router.push({ pathname: "/(app)/community-thread", params: { id: comment.threadId, kind: "thread" } })} />
              )}
            </View>
            {card(comment)}
            {detail.data.replies.length > 0 ? (
              <>
                <AppText variant="cardTitle">{t("replies_title")}</AppText>
                {detail.data.replies.map((item) => card(item, item.id === highlight))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {comment ? <ReplyBar placeholder={t("reply_placeholder")} submitLabel={t("reply_submit")} onSubmit={reply} /> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topChrome: { borderBottomWidth: StyleSheet.hairlineWidth },
  navBar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "800", textAlign: "center" },
  crumbs: { flexDirection: "row" },
});
