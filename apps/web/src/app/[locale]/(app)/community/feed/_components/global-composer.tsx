"use client";

import { Check, ChevronDown, ListChecks, Paperclip } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ForumTagView, ZoneView } from "@mentor/types";
import { forumPollInputSchema, type ForumPollInput } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { useDialog } from "@mentor/ui";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { trackCommunityEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { getForumTrends, listForumTags, listZones, postThread } from "@/lib/forum";
import { AttachmentPreviewStrip } from "../../_components/attachment-preview-strip";
import { AudienceSelector } from "../../_components/audience-selector";
import { AuthorAvatar } from "../../_components/author-avatar";
import { ComposerBodyField } from "../../_components/composer-body-field";
import {
  collectSuggestedTagIds,
  filterHashtagSuggestions,
  getActiveHashtagToken,
  replaceHashtagToken,
  type HashtagToken,
} from "../../_components/composer-hashtags";
import { eligibleComposerZones, type ComposerAudienceMode } from "../../_components/composer-audience";
import { resolveComposerThreadText } from "../../_components/composer-thread-text";
import { DEFAULT_FORUM_POLL, ForumPollComposer } from "../../_components/forum-poll-composer";
import { HashtagSuggestions } from "../../_components/hashtag-suggestions";
import { FORUM_ATTACHMENT_ACCEPT, useForumImagePicker } from "../../_components/use-forum-image-picker";
import {
  getComposerPresentation,
  shouldCollapseComposerOnOutside,
} from "./composer-presentation";
import { QuestionComposerDialog } from "./question-composer-dialog";
import { rankQuestionTags } from "./question-composer-state";

type ComposerMode = ComposerAudienceMode;

export function GlobalComposer({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("community");
  const { user } = useAuth();
  const hashtagListboxId = useId();
  const composerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dialog = useDialog();
  const picker = useForumImagePicker();
  const { items, error: attachmentError, addFiles, removeAt, uploadAll, reset, fileRef, atLimit } = picker;
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<ComposerMode>("share");
  const [zones, setZones] = useState<ZoneView[]>([]);
  const [tags, setTags] = useState<ForumTagView[]>([]);
  const [trendingTagIds, setTrendingTagIds] = useState<string[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pollTitle, setPollTitle] = useState("");
  const [hashtagToken, setHashtagToken] = useState<HashtagToken | null>(null);
  const [activeHashtagIndex, setActiveHashtagIndex] = useState(0);
  const [poll, setPoll] = useState<ForumPollInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      listZones(),
      listForumTags(),
      getForumTrends("relevant", 6).catch(() => null),
    ])
      .then(([zoneResult, tagResult, trendResult]) => {
        if (!active) return;
        setZones(zoneResult.items);
        setTags(tagResult.filter((tag) => tag.isActive));
        setTrendingTagIds(trendResult?.items.map((tag) => tag.id) ?? []);
      })
      .catch(() => active && setError(t("error")));
    return () => { active = false; };
  }, [t]);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (composerRef.current?.contains(event.target as Node)) return;
      if (shouldCollapseComposerOnOutside({ mode, hasPoll: Boolean(poll), busy })) {
        setExpanded(false);
        setHashtagToken(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [busy, expanded, mode, poll]);

  const eligibleZones = useMemo(() => eligibleComposerZones(zones, mode), [mode, zones]);
  const questionZones = useMemo(() => eligibleComposerZones(zones, "question"), [zones]);
  const questionTags = useMemo(
    () => rankQuestionTags(tags, trendingTagIds),
    [tags, trendingTagIds],
  );
  const selectedZone = eligibleZones.find((zone) => zone.id === zoneId) ?? null;
  const hashtagSuggestions = useMemo(
    () => (hashtagToken ? filterHashtagSuggestions(tags, hashtagToken.query) : []),
    [hashtagToken, tags],
  );
  const composerBody = poll ? pollTitle : body;
  const presentation = getComposerPresentation({ expanded, mode, hasPoll: Boolean(poll) });
  const tagIds = useMemo(() => collectSuggestedTagIds(composerBody, tags), [composerBody, tags]);

  const changeMode = (nextMode: ComposerMode) => {
    if (nextMode === "question") {
      setQuestionDialogOpen(true);
      trackCommunityEvent("forum_composer_open", { mode: "question" });
      return;
    }
    setMode(nextMode);
    setZoneId("");
    setTitle("");
    setPollTitle("");
    setPoll(null);
    setHashtagToken(null);
    setError(null);
    setExpanded(true);
  };

  const addPoll = async () => {
    setExpanded(true);
    if (items.length > 0) {
      const confirmed = await dialog.confirm({ title: t("poll_media_conflict_title"), message: t("poll_media_conflict_message"), confirmLabel: t("poll_media_remove_confirm"), cancelLabel: t("cancel"), closeLabel: t("close") });
      if (!confirmed) return;
      reset();
    }
    setPollTitle(body);
    setBody("");
    setHashtagToken(null);
    setExpanded(true);
    setPoll({ ...DEFAULT_FORUM_POLL, options: [...DEFAULT_FORUM_POLL.options] });
  };

  const removePoll = () => {
    setBody(pollTitle);
    setPollTitle("");
    setPoll(null);
    setHashtagToken(null);
  };

  const chooseAttachment = async () => {
    setExpanded(true);
    if (poll) {
      const confirmed = await dialog.confirm({ title: t("poll_media_conflict_title"), message: t("poll_remove_for_media_message"), confirmLabel: t("poll_remove"), cancelLabel: t("cancel"), closeLabel: t("close") });
      if (!confirmed) return;
      removePoll();
    }
    fileRef.current?.click();
  };

  const submit = async () => {
    const threadText = resolveComposerThreadText({
      mode,
      body,
      title,
      pollTitle,
      hasPoll: Boolean(poll),
    });
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
      await postThread(selectedZone.id, threadText.body, threadText.title, attachments, tagIds, parsedPoll?.success ? parsedPoll.data : undefined);
      trackCommunityEvent("forum_thread_created", { mode, zone_type: selectedZone.type, tag_count: tagIds.length });
      setTitle("");
      setBody("");
      setPollTitle("");
      setHashtagToken(null);
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

  const syncHashtag = (value: string, caret: number) => {
    setHashtagToken(getActiveHashtagToken(value, caret));
    setActiveHashtagIndex(0);
  };

  const selectHashtag = (tag: ForumTagView) => {
    if (!hashtagToken) return;
    const next = replaceHashtagToken(body, hashtagToken, tag);
    setBody(next.value);
    setHashtagToken(null);
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const handleHashtagKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!hashtagToken) return false;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && hashtagSuggestions.length > 0) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveHashtagIndex(
        (current) => (current + direction + hashtagSuggestions.length) % hashtagSuggestions.length,
      );
      return true;
    }
    if ((event.key === "Enter" || event.key === "Tab") && hashtagSuggestions.length > 0) {
      if (event.metaKey || event.ctrlKey) return false;
      event.preventDefault();
      selectHashtag(hashtagSuggestions[Math.min(activeHashtagIndex, hashtagSuggestions.length - 1)]!);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setHashtagToken(null);
      return true;
    }
    return false;
  };

  return (
    <>
    <div ref={composerRef} className="mb-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <AuthorAvatar
          name={user?.displayName ?? "Mentor"}
          src={user?.avatarUrl}
          size={40}
        />
        <div className="min-w-0 flex-1">
          {presentation.showAudience && presentation.showTypeSelector ? (
            <div className="flex flex-wrap items-center gap-2">
              <AudienceSelector zones={eligibleZones} value={zoneId} onChange={(next) => { setZoneId(next); setError(null); setExpanded(true); }} disabled={busy} />
              <ComposerTypeSelector value={mode} onChange={changeMode} disabled={busy} />
            </div>
          ) : null}

          {presentation.showQuestionTitle ? <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder={t("composer_question_title")} className="mt-2 min-h-11 w-full border-0 bg-transparent px-0 text-lg font-extrabold text-[var(--color-main)] outline-none placeholder:text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" /> : null}
          {presentation.showPollTitle ? <input value={pollTitle} onChange={(event) => setPollTitle(event.target.value)} maxLength={200} placeholder={t("composer_poll_title")} aria-label={t("composer_poll_title")} className="mt-2 min-h-11 w-full border-0 bg-transparent px-0 text-lg font-extrabold text-[var(--color-main)] outline-none placeholder:text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" /> : null}

          {presentation.showBody ? <div className="relative"><ComposerBodyField id="global-thread-body" label={t("composer_content")} value={body} onValueChange={setBody} placeholder={t("composer_content_placeholder")} disabled={busy} rows={expanded ? 3 : 1} compact hideLabel minimal textareaRef={bodyRef} onCaretChange={syncHashtag} onKeyDown={handleHashtagKeyDown} autocomplete={{ expanded: Boolean(hashtagToken), controls: hashtagListboxId, activeDescendant: hashtagSuggestions.length > 0 ? `${hashtagListboxId}-${Math.min(activeHashtagIndex, hashtagSuggestions.length - 1)}` : undefined }} onFocus={() => { setExpanded(true); trackCommunityEvent("forum_composer_open", { mode }); }} onBlur={() => setHashtagToken(null)} onSubmit={() => void submit()} toolbarActions={<>
        {mode === "share" ? <button type="button" aria-label={t("poll_add")} aria-pressed={Boolean(poll)} disabled={busy || Boolean(poll)} onClick={() => void addPoll()} className="flex size-8 items-center justify-center rounded-full text-[var(--color-secondary)] hover:bg-[var(--color-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-40"><ListChecks size={18} aria-hidden /></button> : null}
        <button type="button" aria-label={t("attach")} disabled={busy || atLimit} onClick={() => void chooseAttachment()} className="flex size-8 items-center justify-center rounded-full text-[var(--color-secondary)] hover:bg-[var(--color-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-40"><Paperclip size={18} aria-hidden /></button>
      </>} footerAction={<button type="button" disabled={busy || !composerBody.trim() || !selectedZone} onClick={() => void submit()} className="min-h-10 rounded-full bg-[var(--color-btn)] px-5 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40">{t("composer_submit")}</button>} />
          {hashtagToken ? <HashtagSuggestions id={hashtagListboxId} query={hashtagToken.query} suggestions={hashtagSuggestions} activeIndex={activeHashtagIndex} onActiveIndexChange={setActiveHashtagIndex} onSelect={selectHashtag} /> : null}</div> : null}

          <input ref={fileRef} type="file" accept={FORUM_ATTACHMENT_ACCEPT} multiple hidden onChange={(event) => addFiles(event.target.files)} />
          {expanded ? <AttachmentPreviewStrip items={items} onRemove={removeAt} /> : null}
          {expanded && poll ? <ForumPollComposer value={poll} onChange={setPoll} onRemove={removePoll} disabled={busy} /> : null}

          {error || attachmentError ? <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{error ?? attachmentError}</p> : null}
          {expanded && poll ? <div className="mt-3 flex justify-end"><button type="button" disabled={busy || !composerBody.trim() || !selectedZone} onClick={() => void submit()} className="min-h-10 rounded-full bg-[var(--color-btn)] px-5 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40">{t("composer_submit")}</button></div> : null}
        </div>
      </div>
    </div>
    <QuestionComposerDialog
      open={questionDialogOpen}
      zones={questionZones}
      tags={questionTags}
      onClose={() => setQuestionDialogOpen(false)}
      onCreated={() => {
        setQuestionDialogOpen(false);
        onCreated();
      }}
    />
    </>
  );
}

function ComposerTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: ComposerMode;
  onChange: (mode: ComposerMode) => void;
  disabled: boolean;
}) {
  const t = useTranslations("community");
  const options = (["share", "question"] as const).map((mode) => ({
    mode,
    label: t(mode === "share" ? "composer_share" : "composer_question"),
  }));
  const selectedLabel = options.find((option) => option.mode === value)?.label;

  return (
    <PopoverMenu
      align="left"
      panelRole="listbox"
      menuClassName="w-44"
      trigger={({ open, setOpen, menuId }) => (
        <button
          type="button"
          disabled={disabled}
          aria-label={t("composer_type_label")}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen(!open)}
          className="flex h-8 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50"
        >
          {selectedLabel}
          <ChevronDown size={14} aria-hidden />
        </button>
      )}
    >
      {options.map((option) => (
        <PopoverMenuItem
          key={option.mode}
          role="option"
          selected={option.mode === value}
          onClick={() => onChange(option.mode)}
        >
          <span className="flex items-center justify-between gap-3">
            {option.label}
            {option.mode === value ? <Check size={16} aria-hidden /> : null}
          </span>
        </PopoverMenuItem>
      ))}
    </PopoverMenu>
  );
}
