import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import type { ForumTagView, ZoneView } from "@mentor/types";
import { forumPollInputSchema } from "@mentor/validation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listForumTags, postZoneThread } from "../../lib/forum-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText, Button, Chip, TextField } from "../ui/index.js";
import { AttachButton, AttachmentStrip, useForumAttachments } from "./attachment-picker.js";

export type ComposerMode = "CHAT" | "QA";

const POLL_DURATIONS = [
  { minutes: 60, key: "poll_duration_1h" as const },
  { minutes: 1440, key: "poll_duration_1d" as const },
  { minutes: 4320, key: "poll_duration_3d" as const },
  { minutes: 10080, key: "poll_duration_7d" as const },
] as const;

export function CommunityComposerSheet({
  visible,
  zones,
  initialMode = "CHAT",
  initialZoneId = null,
  onClose,
  onCreated,
}: {
  visible: boolean;
  zones: readonly ZoneView[];
  initialMode?: ComposerMode;
  initialZoneId?: string | null;
  onClose: () => void;
  onCreated?: (threadId: string, zoneType: "CHAT" | "QA") => void;
}) {
  const queryClient = useQueryClient();
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("community");
  const tCommon = useTranslations("common");

  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [zoneId, setZoneId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollDurationMinutes, setPollDurationMinutes] = useState<number>(1440);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const picker = useForumAttachments();

  const tagsQuery = useQuery({
    queryKey: ["forum", "tags"],
    queryFn: listForumTags,
    enabled: visible,
  });

  const eligibleZones = useMemo(
    () => zones.filter((z) => z.myStatus === "ACTIVE" && z.type === mode),
    [mode, zones],
  );

  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setTitle("");
    setBody("");
    setSelectedTagIds([]);
    setPollOpen(false);
    setPollOptions(["", ""]);
    setPollDurationMinutes(1440);
    setErrorText(null);
    picker.reset();
  }, [initialMode, visible]);

  useEffect(() => {
    if (!visible) return;
    if (initialZoneId && eligibleZones.some((z) => z.id === initialZoneId)) {
      setZoneId(initialZoneId);
      return;
    }
    setZoneId((prev) =>
      eligibleZones.some((z) => z.id === prev) ? prev : (eligibleZones[0]?.id ?? ""),
    );
  }, [eligibleZones, initialZoneId, visible]);

  function toggleTag(tag: ForumTagView) {
    setSelectedTagIds((prev) => {
      if (prev.includes(tag.id)) return prev.filter((id) => id !== tag.id);
      if (prev.length >= 3) return prev;
      return [...prev, tag.id];
    });
  }

  function updatePollOption(index: number, value: string) {
    setPollOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  async function handleSubmit() {
    if (submitting || !zoneId) return;
    const trimmedBody = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedBody) {
      setErrorText(t("composer_error"));
      return;
    }
    if (mode === "QA" && trimmedTitle.length < 5) {
      setErrorText(t("thread_title_placeholder"));
      return;
    }

    let pollPayload: { options: string[]; durationMinutes: number } | undefined;
    if (pollOpen) {
      const cleaned = pollOptions.map((o) => o.trim()).filter((o) => o.length > 0);
      const parsed = forumPollInputSchema.safeParse({
        options: cleaned,
        durationMinutes: pollDurationMinutes,
      });
      if (!parsed.success) {
        setErrorText(t("poll_validation_error"));
        return;
      }
      pollPayload = parsed.data;
    }

    setSubmitting(true);
    setErrorText(null);
    let attachments;
    try {
      attachments = pollPayload ? [] : await picker.uploadAll();
    } catch {
      picker.setError(t("attach_failed"));
      setSubmitting(false);
      return;
    }
    try {
      const created = await postZoneThread({
        attachments,
        zoneId,
        body: trimmedBody,
        ...(mode === "QA" ? { title: trimmedTitle } : {}),
        ...(selectedTagIds.length > 0 ? { tagIds: selectedTagIds } : {}),
        ...(pollPayload ? { poll: pollPayload } : {}),
      });
      haptics.success();
      await queryClient.invalidateQueries({ queryKey: ["forum"] });
      onClose();
      onCreated?.(created.id, mode);
    } catch (err) {
      setErrorText(err instanceof ApiClientError ? err.message : t("composer_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    Boolean(zoneId) &&
    body.trim().length > 0 &&
    (mode === "CHAT" || title.trim().length >= 5) &&
    !submitting;

  return (
    <FormSheet
      visible={visible}
      title={mode === "QA" ? t("new_question_title") : t("new_thread_title")}
      closeLabel={tCommon("close")}
      closeDisabled={submitting}
      onClose={onClose}
      footer={
        <View style={styles.footerWrap}>
          {errorText ? (
            <AppText variant="caption" tone="danger">
              {errorText}
            </AppText>
          ) : null}
          <Button
            label={submitting ? t("composer_posting") : t("post_thread_cta")}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
            loading={submitting}
            variant="primary"
          />
        </View>
      }
    >
      <View style={styles.rowWrap}>
        <Chip
          label={t("composer_mode_post")}
          selected={mode === "CHAT"}
          onPress={() => setMode("CHAT")}
        />
        <Chip
          label={t("composer_mode_question")}
          selected={mode === "QA"}
          onPress={() => setMode("QA")}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="caption" tone="secondary">
          {t("composer_zone_label")}
        </AppText>
        {eligibleZones.length === 0 ? (
          <AppText variant="caption" tone="muted">
            {t("composer_no_zone")}
          </AppText>
        ) : (
          <View style={styles.rowWrap}>
            {eligibleZones.map((zone) => (
              <Chip
                key={zone.id}
                label={zone.title}
                selected={zone.id === zoneId}
                onPress={() => setZoneId(zone.id)}
              />
            ))}
          </View>
        )}
      </View>

      {mode === "QA" ? (
        <TextField
          label={t("thread_title_label")}
          placeholder={t("thread_title_placeholder")}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
        />
      ) : null}

      <TextField
        label={t("thread_body_label")}
        placeholder={t("thread_body_placeholder")}
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={4}
        style={styles.bodyInput}
        maxLength={4000}
      />

      {pollOpen ? null : (
        <View style={styles.attachRow}>
          <AttachButton picker={picker} disabled={submitting} />
          <View style={{ flex: 1 }}><AttachmentStrip picker={picker} disabled={submitting} /></View>
        </View>
      )}

      {tagsQuery.data && tagsQuery.data.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="caption" tone="secondary">
            {t("composer_tags_label")}
          </AppText>
          <View style={styles.rowWrap}>
            {tagsQuery.data.slice(0, 12).map((tag) => (
              <Chip
                key={tag.id}
                label={`#${tag.name}`}
                selected={selectedTagIds.includes(tag.id)}
                onPress={() => toggleTag(tag)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.pollHeader}>
          <AppText variant="caption" tone="secondary">
            {t("poll_title")}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPollOpen((v) => !v)}
            style={styles.pollToggleBtn}
          >
            <AppText variant="caption" style={{ color: palette.playSelectedInk, fontWeight: "700" }}>
              {pollOpen ? t("poll_remove") : t("poll_add")}
            </AppText>
          </Pressable>
        </View>

        {pollOpen ? (
          <View style={[styles.pollBox, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, borderRadius: radii.inner }]}>
            {pollOptions.map((opt, idx) => (
              <TextField
                key={`opt-${idx}`}
                label={t("poll_option_placeholder", { number: idx + 1 })}
                placeholder={t("poll_option_placeholder", { number: idx + 1 })}
                value={opt}
                onChangeText={(val) => updatePollOption(idx, val)}
                maxLength={25}
              />
            ))}
            {pollOptions.length < 4 ? (
              <Button
                label={t("poll_add_option")}
                onPress={() => setPollOptions((prev) => [...prev, ""])}
                variant="secondary"
              />
            ) : null}
            <AppText variant="caption" tone="secondary">
              {t("poll_duration_label")}
            </AppText>
            <View style={styles.rowWrap}>
              {POLL_DURATIONS.map((preset) => (
                <Chip
                  key={preset.minutes}
                  label={t(preset.key)}
                  selected={pollDurationMinutes === preset.minutes}
                  onPress={() => setPollDurationMinutes(preset.minutes)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  footerWrap: { gap: 8 },
  attachRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: -10 },
  section: { gap: 6 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bodyInput: { minHeight: 108, paddingTop: 12, textAlignVertical: "top" },
  pollHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pollToggleBtn: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  pollBox: { borderWidth: 1, padding: 12, gap: 10 },
});
