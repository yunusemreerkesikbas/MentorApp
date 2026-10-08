"use client";

import { ListChecks, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ForumTagView, ThreadView, ZoneView } from "@mentor/types";
import { forumPollInputSchema, type ForumPollInput } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Button, useDialog } from "@mentor/ui";
import { trackCommunityEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { getForumTrends, listForumTags, listZones, postThread } from "@/lib/forum";
import { clearSpentQueryParam } from "@/lib/spent-query-param";
import { AttachmentPreviewStrip } from "../../_components/attachment-preview-strip";
import { AudienceSelector } from "../../_components/audience-selector";
import { AuthorAvatar } from "../../_components/author-avatar";
import { ComposerBodyField } from "../../_components/composer-body-field";
import { collectSuggestedTagIds } from "../../_components/composer-hashtags";
import { eligibleComposerZones, type ComposerAudienceMode } from "../../_components/composer-audience";
import { resolveComposerThreadText } from "../../_components/composer-thread-text";
import { DEFAULT_FORUM_POLL, ForumPollComposer } from "../../_components/forum-poll-composer";
import { HashtagSuggestions } from "../../_components/hashtag-suggestions";
import { FORUM_ATTACHMENT_ACCEPT, useForumImagePicker } from "../../_components/use-forum-image-picker";
import { ComposerTypeSelector } from "./composer-type-selector";
import { getComposerPresentation, shouldCollapseComposerOnOutside } from "./composer-presentation";
import { QuestionComposerDialog } from "./question-composer-dialog";
import { rankQuestionTags } from "./question-composer-state";
import { useComposerHashtags } from "./use-composer-hashtags";
import { useNotebookHandoff } from "./use-notebook-handoff";

type ComposerMode = ComposerAudienceMode;

/** Keşfet's ledges land here: `?compose=post` opens this box, `?compose=question` the question dialog. */
const COMPOSE_PARAM = "compose";

const TOOL =
  "flex size-10 items-center justify-center rounded-[var(--radius-card)] text-[var(--color-secondary)] hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-40";

export function GlobalComposer({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("community");
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const composerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dialog = useDialog();
  const picker = useForumImagePicker();
  const { items, error: attachmentError, addFiles, removeAt, uploadAll, reset, fileRef, atLimit } = picker;
  const [expanded, setExpanded] = useState(() => searchParams.get(COMPOSE_PARAM) === "post");
  const [mode, setMode] = useState<ComposerMode>("share");
  const [zones, setZones] = useState<ZoneView[]>([]);
  const [tags, setTags] = useState<ForumTagView[]>([]);
  const [trendingTagIds, setTrendingTagIds] = useState<string[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pollTitle, setPollTitle] = useState("");
  const [poll, setPoll] = useState<ForumPollInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualQuestionOpen, setManualQuestionOpen] = useState(
    () => searchParams.get(COMPOSE_PARAM) === "question",
  );
  const reduceMotion = useReducedMotion();
  const hashtags = useComposerHashtags({ tags, body, setBody, bodyRef });
  const clearHashtag = hashtags.clear;
  const notebook = useNotebookHandoff();
  // They already pressed "ask in the community"; making them pick question mode again here would be
  // asking the same thing twice.
  const questionDialogOpen = manualQuestionOpen || Boolean(notebook.entryId);

  // The compose instruction is single-use: read once into state above, then out of the address bar.
  useEffect(() => {
    const compose = new URLSearchParams(window.location.search).get(COMPOSE_PARAM);
    if (!compose) return;
    clearSpentQueryParam(COMPOSE_PARAM);
    if (compose === "post") requestAnimationFrame(() => bodyRef.current?.focus());
  }, []);

  const handleQuestionCreated = async (thread: ThreadView) => {
    setManualQuestionOpen(false);
    await notebook.linkCreated(thread);
    onCreated();
  };

  useEffect(() => {
    let active = true;
    Promise.all([listZones(), listForumTags(), getForumTrends("relevant", 6).catch(() => null)])
      .then(([zoneResult, tagResult, trendResult]) => {
        if (!active) return;
        setZones(zoneResult.items);
        setTags(tagResult.filter((tag) => tag.isActive));
        setTrendingTagIds(trendResult?.items.map((tag) => tag.id) ?? []);
      })
      .catch(() => active && setError(t("error")));
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (composerRef.current?.contains(event.target as Node)) return;
      if (shouldCollapseComposerOnOutside({ mode, hasPoll: Boolean(poll), busy })) {
        setExpanded(false);
        clearHashtag();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [busy, expanded, mode, poll, clearHashtag]);

  const eligibleZones = useMemo(() => eligibleComposerZones(zones, mode), [mode, zones]);
  const questionZones = useMemo(() => eligibleComposerZones(zones, "question"), [zones]);
  const questionTags = useMemo(() => rankQuestionTags(tags, trendingTagIds), [tags, trendingTagIds]);
  const selectedZone = eligibleZones.find((zone) => zone.id === zoneId) ?? null;
  const composerBody = poll ? pollTitle : body;
  const presentation = getComposerPresentation({ expanded, mode, hasPoll: Boolean(poll) });
  const tagIds = useMemo(() => collectSuggestedTagIds(composerBody, tags), [composerBody, tags]);
  const canSubmit = !busy && Boolean(composerBody.trim()) && Boolean(selectedZone);

  const changeMode = (nextMode: ComposerMode) => {
    if (nextMode === "question") {
      setManualQuestionOpen(true);
      trackCommunityEvent("forum_composer_open", { mode: "question" });
      return;
    }
    setMode(nextMode);
    setZoneId("");
    setTitle("");
    setPollTitle("");
    setPoll(null);
    hashtags.clear();
    setError(null);
    setExpanded(true);
  };

  const addPoll = async () => {
    setExpanded(true);
    if (items.length > 0) {
      const confirmed = await dialog.confirm({
        title: t("poll_media_conflict_title"),
        message: t("poll_media_conflict_message"),
        confirmLabel: t("poll_media_remove_confirm"),
        cancelLabel: t("cancel"),
        closeLabel: t("close"),
      });
      if (!confirmed) return;
      reset();
    }
    setPollTitle(body);
    setBody("");
    hashtags.clear();
    setPoll({ ...DEFAULT_FORUM_POLL, options: [...DEFAULT_FORUM_POLL.options] });
  };

  const removePoll = () => {
    setBody(pollTitle);
    setPollTitle("");
    setPoll(null);
    hashtags.clear();
  };

  const chooseAttachment = async () => {
    setExpanded(true);
    if (poll) {
      const confirmed = await dialog.confirm({
        title: t("poll_media_conflict_title"),
        message: t("poll_remove_for_media_message"),
        confirmLabel: t("poll_remove"),
        cancelLabel: t("cancel"),
        closeLabel: t("close"),
      });
      if (!confirmed) return;
      removePoll();
    }
    fileRef.current?.click();
  };

  const submit = async () => {
    const threadText = resolveComposerThreadText({ mode, body, title, pollTitle, hasPoll: Boolean(poll) });
    if (busy || !selectedZone || !threadText.body) {
      if (!selectedZone) setError(t("audience_required"));
      return;
    }
    if (mode === "question" && (threadText.title?.length ?? 0) < 5) {
      setError(t("composer_question_title_error"));
      return;
    }
    const parsedPoll = poll ? forumPollInputSchema.safeParse(poll) : null;
    if (parsedPoll && !parsedPoll.success) {
      setError(t("poll_validation_error"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const attachments = poll ? [] : await uploadAll();
      await postThread(
        selectedZone.id,
        threadText.body,
        threadText.title,
        attachments,
        tagIds,
        parsedPoll?.success ? parsedPoll.data : undefined,
      );
      trackCommunityEvent("forum_thread_created", { mode, zone_type: selectedZone.type, tag_count: tagIds.length });
      setTitle("");
      setBody("");
      setPollTitle("");
      hashtags.clear();
      setPoll(null);
      reset();
      setExpanded(false);
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof ApiClientError ? submitError.body.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  const submitButton = (
    <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
      {t("composer_submit")}
    </Button>
  );

  return (
    <>
      <div
        ref={composerRef}
        className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)] sm:px-5"
      >
        <div className="flex items-start gap-3">
          <AuthorAvatar name={user?.displayName ?? "Mentor"} src={user?.avatarUrl} size={40} />
          <div className="min-w-0 flex-1">
            <AnimatePresence initial={false}>
              {presentation.showAudience && presentation.showTypeSelector ? (
                <motion.div
                  key="composer-options"
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <AudienceSelector
                      zones={eligibleZones}
                      value={zoneId}
                      onChange={(next) => {
                        setZoneId(next);
                        setError(null);
                        setExpanded(true);
                      }}
                      disabled={busy}
                    />
                    <ComposerTypeSelector value={mode} onChange={changeMode} disabled={busy} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {presentation.showQuestionTitle ? (
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder={t("composer_question_title")}
                className="mt-2 min-h-11 w-full border-0 bg-transparent px-0 text-lg font-extrabold text-[var(--color-main)] outline-none placeholder:text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              />
            ) : null}
            {presentation.showPollTitle ? (
              <input
                value={pollTitle}
                onChange={(event) => setPollTitle(event.target.value)}
                maxLength={200}
                placeholder={t("composer_poll_title")}
                aria-label={t("composer_poll_title")}
                className="mt-2 min-h-11 w-full border-0 bg-transparent px-0 text-lg font-extrabold text-[var(--color-main)] outline-none placeholder:text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              />
            ) : null}

            {presentation.showBody ? (
              <motion.div
                layout={reduceMotion ? false : "size"}
                transition={{ layout: { duration: reduceMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] } }}
                className="relative rounded-[var(--radius-card)]"
              >
                <ComposerBodyField
                  id="global-thread-body"
                  label={t("composer_content")}
                  value={body}
                  onValueChange={setBody}
                  placeholder={t("composer_content_placeholder")}
                  disabled={busy}
                  rows={expanded ? 3 : 1}
                  compact
                  hideLabel
                  minimal
                  textareaRef={bodyRef}
                  onCaretChange={hashtags.sync}
                  onKeyDown={hashtags.onKeyDown}
                  autocomplete={{
                    expanded: Boolean(hashtags.token),
                    controls: hashtags.listboxId,
                    activeDescendant: hashtags.activeDescendant,
                  }}
                  onFocus={() => {
                    setExpanded(true);
                    trackCommunityEvent("forum_composer_open", { mode });
                  }}
                  onBlur={hashtags.clear}
                  onSubmit={() => void submit()}
                  toolbarActions={
                    <>
                      {mode === "share" ? (
                        <button
                          type="button"
                          aria-label={t("poll_add")}
                          aria-pressed={Boolean(poll)}
                          disabled={busy || Boolean(poll)}
                          onClick={() => void addPoll()}
                          className={TOOL}
                        >
                          <ListChecks size={18} aria-hidden />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={t("attach")}
                        disabled={busy || atLimit}
                        onClick={() => void chooseAttachment()}
                        className={TOOL}
                      >
                        <Paperclip size={18} aria-hidden />
                      </button>
                    </>
                  }
                  footerAction={submitButton}
                />
                {hashtags.token ? (
                  <HashtagSuggestions
                    id={hashtags.listboxId}
                    query={hashtags.token.query}
                    suggestions={hashtags.suggestions}
                    activeIndex={hashtags.activeIndex}
                    onActiveIndexChange={hashtags.setActiveIndex}
                    onSelect={hashtags.select}
                  />
                ) : null}
              </motion.div>
            ) : null}

            <input
              ref={fileRef}
              type="file"
              accept={FORUM_ATTACHMENT_ACCEPT}
              multiple
              hidden
              onChange={(event) => addFiles(event.target.files)}
            />
            {expanded ? <AttachmentPreviewStrip items={items} onRemove={removeAt} /> : null}
            {expanded && poll ? (
              <ForumPollComposer value={poll} onChange={setPoll} onRemove={removePoll} disabled={busy} />
            ) : null}

            {error || attachmentError ? (
              <p role="alert" className="mt-3 text-caption font-semibold text-[var(--color-danger)]">
                {error ?? attachmentError}
              </p>
            ) : null}
            {expanded && poll ? <div className="mt-3 flex justify-end">{submitButton}</div> : null}
          </div>
        </div>
      </div>
      <QuestionComposerDialog
        open={questionDialogOpen}
        zones={questionZones}
        tags={questionTags}
        handoff={notebook.handoff}
        onClose={() => {
          setManualQuestionOpen(false);
          notebook.spend();
        }}
        onCreated={(thread) => void handleQuestionCreated(thread)}
      />
    </>
  );
}
