import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import {
  FORUM_REACTION_EMOJIS,
  ModerationTargetType,
  type AnswerView,
  type CommentView,
} from "@mentor/types";
import { BookmarkIcon as BookmarkSolidIcon } from "@solar-icons/react-native/bold/bookmark";
import { CheckCircleIcon } from "@solar-icons/react-native/bold/check-circle";
import { BookmarkIcon as BookmarkLinearIcon } from "@solar-icons/react-native/linear/bookmark";
import { LikeIcon } from "@solar-icons/react-native/linear/like";
import { MenuDotsIcon } from "@solar-icons/react-native/linear/menu-dots";
import { SmileCircleIcon } from "@solar-icons/react-native/linear/smile-circle";
import { useQueryClient } from "@tanstack/react-query";
import {
  acceptQuestionAnswer,
  bookmarkPost,
  deleteForumAnswer,
  setHelpfulVote,
  togglePostReaction,
} from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { formatNotificationTime } from "../../lib/notifications-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { ActionSheet, PanelCard, type SheetAction } from "../panel/primitives.js";
import { AppText, Button, Chip } from "../ui/index.js";
import { CommunityAvatar } from "./community-avatar.js";
import {
  DeleteForumConfirmDialog,
  ReportReasonSheet,
  type ReportTarget,
} from "./moderation-sheets.js";

export type ReplyItem =
  | { kind: "answer"; item: AnswerView; canAccept: boolean }
  | { kind: "comment"; item: CommentView };

export function CommunityReplyCard({
  reply,
  threadId,
  onOpenMember,
}: {
  reply: ReplyItem;
  threadId: string;
  onOpenMember: (username: string) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { locale } = useLocale();
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("community");
  const tNotif = useTranslations("notifications");
  const toast = useToast();

  const item = reply.item;
  const isAccepted = reply.kind === "answer" && reply.item.isAccepted;
  const isComment = reply.kind === "comment";

  const [counts, setCounts] = useState<Record<string, number>>(
    reply.kind === "comment" ? reply.item.reactionCounts : {},
  );
  const [myReactions, setMyReactions] = useState<string[]>(
    reply.kind === "comment" ? reply.item.myReactions : [],
  );
  const [helpfulCount, setHelpfulCount] = useState(item.helpfulVoteCount ?? 0);
  const [myHelpful, setMyHelpful] = useState(Boolean(item.myHelpfulVote));
  const [bookmarked, setBookmarked] = useState(item.myBookmarked);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCounts(reply.kind === "comment" ? reply.item.reactionCounts : {});
    setMyReactions(reply.kind === "comment" ? reply.item.myReactions : []);
    setHelpfulCount(reply.item.helpfulVoteCount ?? 0);
    setMyHelpful(Boolean(reply.item.myHelpfulVote));
    setBookmarked(reply.item.myBookmarked);
  }, [reply]);

  const timeLabel = useMemo(
    () =>
      formatNotificationTime(item.createdAt, locale, {
        timeJustNow: tNotif("time_just_now"),
        timeHoursAgo: (c) => tNotif("time_hours_ago", { count: c }),
        timeYesterday: tNotif("time_yesterday"),
        timeDaysAgo: (c) => tNotif("time_days_ago", { count: c }),
      }),
    [item.createdAt, locale, tNotif],
  );

  async function handleReaction(emoji: string) {
    haptics.selection();
    const active = myReactions.includes(emoji);
    const prevCounts = counts;
    const prevMine = myReactions;
    setMyReactions(active ? prevMine.filter((e) => e !== emoji) : [...prevMine, emoji]);
    setCounts({ ...prevCounts, [emoji]: Math.max(0, (prevCounts[emoji] ?? 0) + (active ? -1 : 1)) });
    setPickerOpen(false);
    try {
      await togglePostReaction({ postId: item.id, emoji, active });
      void queryClient.invalidateQueries({ queryKey: ["forum", "detail", threadId] });
    } catch (err) {
      setCounts(prevCounts);
      setMyReactions(prevMine);
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    }
  }

  async function handleHelpful() {
    if (reply.kind !== "answer" || !reply.item.canHelpfulVote) return;
    haptics.selection();
    const next = !myHelpful;
    setMyHelpful(next);
    setHelpfulCount((v) => Math.max(0, v + (next ? 1 : -1)));
    try {
      await setHelpfulVote(ModerationTargetType.POST, item.id, next);
      void queryClient.invalidateQueries({ queryKey: ["forum", "detail", threadId] });
    } catch (err) {
      setMyHelpful(!next);
      setHelpfulCount((v) => Math.max(0, v + (next ? -1 : 1)));
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    }
  }

  async function handleBookmark() {
    haptics.selection();
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await bookmarkPost(item.id, next);
      void queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      setBookmarked(!next);
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    }
  }

  async function handleAccept() {
    if (busy) return;
    setBusy(true);
    try {
      await acceptQuestionAnswer(threadId, item.id);
      haptics.success();
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    setBusy(true);
    try {
      await deleteForumAnswer(item.id);
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    } finally {
      setBusy(false);
    }
  }

  const isOwn = Boolean(user && item.authorId === user.id);
  const allowDelete = Boolean(item.capabilities?.canDelete) || isOwn;
  const menuActions: SheetAction[] = [
    { label: bookmarked ? t("bookmark_remove") : t("bookmark_add"), onPress: () => void handleBookmark() },
    ...(!isOwn
      ? [{ label: t("report"), onPress: () => setReportTarget({ targetType: ModerationTargetType.POST, targetId: item.id }) }]
      : []),
    ...(allowDelete
      ? [{ label: t("delete"), tone: "danger" as const, onPress: () => setDeleteOpen(true) }]
      : []),
  ];

  const visibleReactions = FORUM_REACTION_EMOJIS.filter(
    (e) => (counts[e] ?? 0) > 0 || myReactions.includes(e),
  );

  return (
    <PanelCard style={[styles.card, isAccepted && { borderColor: palette.success }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          disabled={!item.authorUsername}
          onPress={() => item.authorUsername && onOpenMember(item.authorUsername)}
          style={styles.authorBtn}
        >
          <CommunityAvatar name={item.authorName} avatarUrl={item.authorAvatarUrl} size={32} />
          <View style={styles.authorMeta}>
            <AppText numberOfLines={1} style={styles.authorName}>{item.authorName}</AppText>
            <AppText numberOfLines={1} variant="caption" tone="muted">
              {item.authorUsername ? `@${item.authorUsername} · ${timeLabel}` : timeLabel}
            </AppText>
          </View>
        </Pressable>

        <View style={styles.headerRight}>
          {isAccepted ? (
            <View style={styles.acceptedBadge}>
              <CheckCircleIcon size={16} color={palette.success} />
              <Chip label={t("accepted")} tone="success" />
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t("actions_label")} onPress={() => setMenuOpen(true)} style={styles.iconBtn}>
            <MenuDotsIcon size={20} color={palette.secondary} />
          </Pressable>
        </View>
      </View>

      <AppText variant="body">{item.body}</AppText>

      {pickerOpen && isComment ? (
        <View style={[styles.pickerRow, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, borderRadius: radii.pill }]}>
          {FORUM_REACTION_EMOJIS.map((emoji) => (
            <Pressable key={emoji} accessibilityRole="button" onPress={() => void handleReaction(emoji)} style={styles.emojiBtn}>
              <AppText>{emoji}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: palette.playLine }]}>
        <View style={styles.footerLeft}>
          {isComment ? (
            <>
              {visibleReactions.map((emoji) => {
                const mine = myReactions.includes(emoji);
                return (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    onPress={() => void handleReaction(emoji)}
                    style={[styles.pillBtn, { borderRadius: radii.pill, borderColor: mine ? palette.ctaPlayEdge : palette.border, backgroundColor: mine ? palette.playSelected : palette.surfaceAlt }]}
                  >
                    <AppText variant="caption" tabularNums>{`${emoji} ${counts[emoji] ?? 0}`}</AppText>
                  </Pressable>
                );
              })}
              <Pressable accessibilityRole="button" onPress={() => setPickerOpen((v) => !v)} style={styles.iconBtn}>
                <SmileCircleIcon size={19} color={palette.secondary} strokeWidth={1.75} />
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={!reply.item.canHelpfulVote}
              onPress={() => void handleHelpful()}
              style={[styles.pillBtn, { borderRadius: radii.pill, borderColor: myHelpful ? palette.ctaPlayEdge : palette.border, backgroundColor: myHelpful ? palette.playSelected : palette.surfaceAlt }]}
            >
              <LikeIcon size={16} color={myHelpful ? palette.playSelectedInk : palette.secondary} strokeWidth={1.75} />
              <AppText variant="caption" tabularNums>
                {helpfulCount > 0 ? t("helpful_count", { count: helpfulCount }) : t("helpful")}
              </AppText>
            </Pressable>
          )}

          {reply.kind === "answer" && reply.canAccept && !isAccepted ? (
            <Button label={t("accept")} loading={busy} onPress={() => void handleAccept()} variant="secondary" />
          ) : null}
        </View>

        <Pressable accessibilityRole="button" onPress={() => void handleBookmark()} style={styles.iconBtn}>
          {bookmarked ? (
            <BookmarkSolidIcon size={19} color={palette.playSelectedInk} />
          ) : (
            <BookmarkLinearIcon size={19} color={palette.secondary} strokeWidth={1.75} />
          )}
        </Pressable>
      </View>

      <ActionSheet title={menuOpen ? t("actions_label") : null} actions={menuActions} onClose={() => setMenuOpen(false)} />
      <ReportReasonSheet target={reportTarget} onClose={() => setReportTarget(null)} />
      <DeleteForumConfirmDialog visible={deleteOpen} onCancel={() => setDeleteOpen(false)} onConfirm={() => void handleDeleteConfirm()} />
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  authorBtn: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  authorMeta: { flex: 1, minWidth: 0 },
  authorName: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  acceptedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  pickerRow: { flexDirection: "row", justifyContent: "space-around", borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8 },
  emojiBtn: { minWidth: 40, minHeight: 36, alignItems: "center", justifyContent: "center" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 6 },
  footerLeft: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  pillBtn: { minHeight: 36, paddingHorizontal: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
