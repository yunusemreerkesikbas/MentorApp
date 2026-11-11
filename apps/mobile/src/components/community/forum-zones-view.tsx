import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FORUM_REACTION_EMOJIS, type ZoneView } from "@mentor/types";
import {
  getThreadDetail,
  listZoneThreads,
  postThreadComment,
  postZoneThread,
  toggleThreadReaction,
} from "../../lib/community-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, TextField } from "../ui/index.js";

export interface ForumZonesViewProps {
  zones: ZoneView[];
}

export function ForumZonesView({ zones }: ForumZonesViewProps) {
  const t = useTranslations("community");
  const { palette, radii, space } = useThemeTokens();
  const queryClient = useQueryClient();

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    zones[0]?.id ?? null,
  );
  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const activeZone =
    zones.find((z) => z.id === selectedZoneId) ?? zones[0] ?? null;

  const threadsQuery = useQuery({
    queryKey: ["forum-threads", activeZone?.id],
    queryFn: () => listZoneThreads(activeZone!.id),
    enabled: Boolean(activeZone?.id),
  });

  const detailQuery = useQuery({
    queryKey: ["forum-thread-detail", expandedThreadId],
    queryFn: () => getThreadDetail(expandedThreadId!),
    enabled: Boolean(expandedThreadId),
  });

  const postThreadMutation = useMutation({
    mutationFn: () =>
      postZoneThread({
        zoneId: activeZone!.id,
        body: threadBody,
        title: threadTitle,
      }),
    onSuccess: () => {
      void haptics.success();
      setThreadTitle("");
      setThreadBody("");
      void queryClient.invalidateQueries({
        queryKey: ["forum-threads", activeZone?.id],
      });
    },
  });

  const reactMutation = useMutation({
    mutationFn: (input: { threadId: string; emoji: string; active: boolean }) =>
      toggleThreadReaction(input),
    onSuccess: () => {
      void haptics.selection();
      void queryClient.invalidateQueries({
        queryKey: ["forum-threads", activeZone?.id],
      });
    },
  });

  const postCommentMutation = useMutation({
    mutationFn: () =>
      postThreadComment({
        threadId: expandedThreadId!,
        body: commentDraft,
      }),
    onSuccess: () => {
      void haptics.success();
      setCommentDraft("");
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["forum-thread-detail", expandedThreadId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["forum-threads", activeZone?.id],
        }),
      ]);
    },
  });

  if (!activeZone) {
    return (
      <Card style={{ gap: space.sm }}>
        <AppText variant="body" tone="secondary">
          {t("zones_empty")}
        </AppText>
      </Card>
    );
  }

  const threads = threadsQuery.data ?? [];

  return (
    <View style={{ gap: space.md }}>
      <Card style={{ gap: space.sm }}>
        <AppText variant="sectionHeading">{t("zones_title")}</AppText>
        <View style={styles.chipRow}>
          {zones.map((zone) => (
            <Chip
              key={zone.id}
              label={`${zone.emoji ? `${zone.emoji} ` : ""}${zone.title}`}
              selected={zone.id === activeZone.id}
              onPress={() => {
                void haptics.selection();
                setSelectedZoneId(zone.id);
                setExpandedThreadId(null);
              }}
            />
          ))}
        </View>
      </Card>

      {activeZone.type !== "ANNOUNCEMENT" ? (
        <Card style={{ gap: space.sm }}>
          <AppText variant="sectionHeading">{t("new_thread_title")}</AppText>
          {activeZone.type === "QA" ? (
            <TextField
              label={t("thread_title_label")}
              value={threadTitle}
              onChangeText={setThreadTitle}
              placeholder={t("thread_title_placeholder")}
            />
          ) : null}
          <TextField
            label={t("thread_body_label")}
            value={threadBody}
            onChangeText={setThreadBody}
            placeholder={t("thread_body_placeholder")}
            multiline
          />
          <Button
            label={t("post_thread_cta")}
            disabled={!threadBody.trim()}
            loading={postThreadMutation.isPending}
            onPress={() => postThreadMutation.mutate()}
          />
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        {threads.length === 0 ? (
          <Card style={{ gap: space.sm }}>
            <AppText variant="body" tone="secondary">
              {t("threads_empty")}
            </AppText>
          </Card>
        ) : (
          threads.map((thread) => {
            const expanded = expandedThreadId === thread.id;
            return (
              <Card key={thread.id} style={{ gap: space.sm }}>
                <View style={styles.rowBetween}>
                  <AppText variant="caption" tone="accent">
                    {thread.authorName}
                    {thread.authorUsername ? ` (@${thread.authorUsername})` : ""}
                  </AppText>
                  <Chip
                    label={`💬 ${thread.commentCount}`}
                    selected={expanded}
                    onPress={() =>
                      setExpandedThreadId(expanded ? null : thread.id)
                    }
                  />
                </View>
                {thread.title ? (
                  <AppText variant="cardTitle">{thread.title}</AppText>
                ) : null}
                <AppText variant="body">{thread.body}</AppText>

                <View style={styles.chipRow}>
                  {FORUM_REACTION_EMOJIS.map((emoji) => {
                    const count = thread.reactionCounts[emoji] ?? 0;
                    const active = thread.myReactions.includes(emoji);
                    return (
                      <Chip
                        key={emoji}
                        label={`${emoji}${count > 0 ? ` ${count}` : ""}`}
                        selected={active}
                        onPress={() =>
                          reactMutation.mutate({
                            threadId: thread.id,
                            emoji,
                            active,
                          })
                        }
                      />
                    );
                  })}
                </View>

                {expanded ? (
                  <View
                    style={{
                      padding: space.sm,
                      borderRadius: radii.card,
                      borderWidth: 1,
                      backgroundColor: palette.surfaceAlt,
                      borderColor: palette.border,
                      gap: space.sm,
                    }}
                  >
                    <AppText variant="cardTitle">{t("comments_title")}</AppText>
                    {(detailQuery.data?.comments ?? []).map((comment) => (
                      <View key={comment.id} style={{ gap: 2 }}>
                        <AppText variant="caption" tone="accent">
                          {comment.authorName}
                        </AppText>
                        <AppText variant="body">{comment.body}</AppText>
                      </View>
                    ))}
                    <TextField
                      label={t("comment_placeholder")}
                      value={commentDraft}
                      onChangeText={setCommentDraft}
                      placeholder={t("comment_placeholder")}
                    />
                    <Button
                      label={t("post_comment_cta")}
                      variant="secondary"
                      disabled={!commentDraft.trim()}
                      loading={postCommentMutation.isPending}
                      onPress={() => postCommentMutation.mutate()}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
});
