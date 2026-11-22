import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import { FORUM_REACTION_EMOJIS, ModerationTargetType, type ForumPollView } from "@mentor/types";
import { BookmarkIcon as BookmarkSolidIcon } from "@solar-icons/react-native/bold/bookmark";
import { BookmarkIcon as BookmarkLinearIcon } from "@solar-icons/react-native/linear/bookmark";
import { ChatRoundDotsIcon } from "@solar-icons/react-native/linear/chat-round-dots";
import { LikeIcon } from "@solar-icons/react-native/linear/like";
import { MenuDotsIcon } from "@solar-icons/react-native/linear/menu-dots";
import { SmileCircleIcon } from "@solar-icons/react-native/linear/smile-circle";
import { useQueryClient } from "@tanstack/react-query";
import { deriveQuestionStatus, type CommunityPostModel } from "../../lib/community-view.js";
import { bookmarkThread, deleteForumThread, setHelpfulVote, toggleThreadReaction } from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { formatNotificationTime } from "../../lib/notifications-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { ActionSheet, PanelCard, type SheetAction } from "../panel/primitives.js";
import { AppText, Chip } from "../ui/index.js";
import { CommunityAvatar } from "./community-avatar.js";
import { ForumPollCard } from "./forum-poll-card.js";
import { DeleteForumConfirmDialog, ReportReasonSheet, type ReportTarget } from "./moderation-sheets.js";

export function FeedPostCard({
  post,
  showZone = true,
  excerptLines = 5,
  onOpenThread,
  onOpenMember,
  onOpenZone,
  onSelectTag,
  onDeleted,
}: {
  post: CommunityPostModel;
  showZone?: boolean;
  excerptLines?: number;
  onOpenThread: (post: CommunityPostModel) => void;
  onOpenMember?: (username: string) => void;
  onOpenZone?: (slug: string) => void;
  onSelectTag?: (slug: string) => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { locale } = useLocale();
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("community");
  const tNotif = useTranslations("notifications");
  const toast = useToast();

  const [poll, setPoll] = useState<ForumPollView | null>(post.poll);
  const [counts, setCounts] = useState<Record<string, number>>(post.reactionCounts);
  const [myReactions, setMyReactions] = useState<string[]>(post.myReactions);
  const [helpfulCount, setHelpfulCount] = useState(post.helpfulVoteCount);
  const [myHelpful, setMyHelpful] = useState(post.myHelpfulVote);
  const [bookmarked, setBookmarked] = useState(post.myBookmarked);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPoll(post.poll);
    setCounts(post.reactionCounts);
    setMyReactions(post.myReactions);
    setHelpfulCount(post.helpfulVoteCount);
    setMyHelpful(post.myHelpfulVote);
    setBookmarked(post.myBookmarked);
  }, [post]);

  const timeLabel = useMemo(
    () =>
      formatNotificationTime(post.createdAt, locale, {
        timeJustNow: tNotif("time_just_now"),
        timeHoursAgo: (c) => tNotif("time_hours_ago", { count: c }),
        timeYesterday: tNotif("time_yesterday"),
        timeDaysAgo: (c) => tNotif("time_days_ago", { count: c }),
      }),
    [locale, post.createdAt, tNotif],
  );

  const qaStatus = post.zone.type === "QA" ? deriveQuestionStatus(post) : null;
  const visibleReactions = FORUM_REACTION_EMOJIS.filter(
    (e) => (counts[e] ?? 0) > 0 || myReactions.includes(e),
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
      await toggleThreadReaction({ threadId: post.id, emoji, active });
      void queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      setCounts(prevCounts);
      setMyReactions(prevMine);
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    }
  }

  async function handleHelpful() {
    if (!post.canHelpfulVote) return;
    haptics.selection();
    const next = !myHelpful;
    setMyHelpful(next);
    setHelpfulCount((v) => Math.max(0, v + (next ? 1 : -1)));
    try {
      await setHelpfulVote(ModerationTargetType.THREAD, post.id, next);
      void queryClient.invalidateQueries({ queryKey: ["forum"] });
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
      await bookmarkThread(post.id, next);
      void queryClient.invalidateQueries({ queryKey: ["forum"] });
    } catch (err) {
      setBookmarked(!next);
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    }
  }

  async function handleDeleteConfirm() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteForumThread(post.id);
      setDeleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["forum"] });
      onDeleted?.();
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("error_title"));
    } finally {
      setDeleting(false);
    }
  }

  const isOwn = Boolean(user && post.author.id === user.id);
  const allowDelete = post.canDelete || isOwn;
  const menuActions: SheetAction[] = [
    { label: bookmarked ? t("bookmark_remove") : t("bookmark_add"), onPress: () => void handleBookmark() },
    ...(!isOwn
      ? [{ label: t("report"), onPress: () => setReportTarget({ targetType: ModerationTargetType.THREAD, targetId: post.id }) }]
      : []),
    ...(allowDelete ? [{ label: t("delete"), tone: "danger" as const, onPress: () => setDeleteOpen(true) }] : []),
  ];

  return (
    <PanelCard style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          disabled={!post.author.username || !onOpenMember}
          onPress={() => post.author.username && onOpenMember?.(post.author.username)}
          style={styles.authorBtn}
        >
          <CommunityAvatar name={post.author.displayName} avatarUrl={post.author.avatarUrl} size={36} />
          <View style={styles.authorMeta}>
            <AppText numberOfLines={1} style={styles.authorName}>{post.author.displayName}</AppText>
            <AppText numberOfLines={1} variant="caption" tone="muted">
              {post.author.username ? `@${post.author.username} · ${timeLabel}` : timeLabel}
            </AppText>
          </View>
        </Pressable>

        <View style={styles.headerRight}>
          {post.isPinned ? <Chip label={t("pin_badge")} tone="coach" /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("actions_label")}
            onPress={() => setMenuOpen(true)}
            style={styles.iconBtn}
          >
            <MenuDotsIcon size={20} color={palette.secondary} />
          </Pressable>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => onOpenThread(post)} style={styles.bodyWrap}>
        {(showZone || qaStatus) ? (
          <View style={styles.statusRow}>
            {showZone ? (
              <Chip
                label={post.zone.title}
                onPress={onOpenZone ? () => onOpenZone(post.zone.slug) : undefined}
              />
            ) : null}
            {qaStatus ? (
              <Chip
                label={
                  qaStatus.kind === "solved"
                    ? t("status_solved")
                    : qaStatus.kind === "answers"
                      ? t("status_answers", { count: qaStatus.answers })
                      : t("status_waiting")
                }
                tone={qaStatus.kind === "solved" ? "success" : qaStatus.kind === "waiting" ? "warning" : "default"}
              />
            ) : null}
          </View>
        ) : null}
        {post.title ? <AppText variant="cardTitle">{post.title}</AppText> : null}
        <AppText numberOfLines={excerptLines} variant="body" tone="secondary">
          {post.body}
        </AppText>
      </Pressable>

      {post.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {post.tags.map((tag) => (
            <Chip
              key={tag.id}
              label={`#${tag.name}`}
              onPress={onSelectTag ? () => onSelectTag(tag.slug) : undefined}
            />
          ))}
        </View>
      ) : null}

      {poll ? <ForumPollCard poll={poll} onUpdated={setPoll} /> : null}

      {pickerOpen ? (
        <View style={[styles.pickerRow, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, borderRadius: radii.pill }]}>
          {FORUM_REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              onPress={() => void handleReaction(emoji)}
              style={[styles.emojiBtn, myReactions.includes(emoji) && { backgroundColor: palette.playSelected, borderRadius: radii.pill }]}
            >
              <AppText>{emoji}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: palette.playLine }]}>
        <View style={styles.footerLeft}>
          {visibleReactions.map((emoji) => {
            const mine = myReactions.includes(emoji);
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                onPress={() => void handleReaction(emoji)}
                style={[
                  styles.pillBtn,
                  {
                    borderRadius: radii.pill,
                    borderColor: mine ? palette.ctaPlayEdge : palette.border,
                    backgroundColor: mine ? palette.playSelected : palette.surfaceAlt,
                  },
                ]}
              >
                <AppText variant="caption" tabularNums style={{ color: mine ? palette.playSelectedInk : palette.main, fontWeight: "700" }}>
                  {`${emoji} ${counts[emoji] ?? 0}`}
                </AppText>
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("reactions_add")}
            onPress={() => setPickerOpen((v) => !v)}
            style={styles.iconBtn}
          >
            <SmileCircleIcon size={20} color={palette.secondary} strokeWidth={1.75} />
          </Pressable>

          {post.zone.type === "QA" ? (
            <Pressable
              accessibilityRole="button"
              disabled={!post.canHelpfulVote}
              onPress={() => void handleHelpful()}
              style={[
                styles.pillBtn,
                {
                  borderRadius: radii.pill,
                  borderColor: myHelpful ? palette.ctaPlayEdge : palette.border,
                  backgroundColor: myHelpful ? palette.playSelected : palette.surfaceAlt,
                },
              ]}
            >
              <LikeIcon size={16} color={myHelpful ? palette.playSelectedInk : palette.secondary} strokeWidth={1.75} />
              <AppText variant="caption" tabularNums style={{ color: myHelpful ? palette.playSelectedInk : palette.secondary, fontWeight: "700" }}>
                {helpfulCount > 0 ? t("helpful_count", { count: helpfulCount }) : t("helpful")}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.footerRight}>
          <Pressable accessibilityRole="button" onPress={() => onOpenThread(post)} style={styles.commentBtn}>
            <ChatRoundDotsIcon size={19} color={palette.secondary} strokeWidth={1.75} />
            <AppText variant="caption" tone="secondary" tabularNums style={{ fontWeight: "700" }}>
              {post.commentCount}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? t("bookmark_remove") : t("bookmark_add")}
            onPress={() => void handleBookmark()}
            style={styles.iconBtn}
          >
            {bookmarked ? (
              <BookmarkSolidIcon size={20} color={palette.playSelectedInk} />
            ) : (
              <BookmarkLinearIcon size={20} color={palette.secondary} strokeWidth={1.75} />
            )}
          </Pressable>
        </View>
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
  authorBtn: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 },
  authorMeta: { flex: 1, minWidth: 0 },
  authorName: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  bodyWrap: { gap: 6 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pickerRow: { flexDirection: "row", justifyContent: "space-around", borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8 },
  emojiBtn: { minWidth: 40, minHeight: 36, alignItems: "center", justifyContent: "center" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 6 },
  footerLeft: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  pillBtn: { minHeight: 36, paddingHorizontal: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  commentBtn: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
