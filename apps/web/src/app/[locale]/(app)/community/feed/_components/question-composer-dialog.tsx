"use client";

import dynamic from "next/dynamic";
import { Paperclip, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type { ForumTagView, ThreadView, ZoneView } from "@mentor/types";
import { createThreadSchema } from "@mentor/validation";
import { trackCommunityEvent } from "@/lib/analytics";
import { postThread, suggestForumTag } from "@/lib/forum";
import {
  copyForumAttachment,
  readDisplayedImageSize,
} from "@/lib/forum-attachments";
import { AttachmentPreviewStrip } from "../../_components/attachment-preview-strip";
import { AudienceSelector } from "../../_components/audience-selector";
import {
  FORUM_ATTACHMENT_ACCEPT,
  useForumImagePicker,
} from "../../_components/use-forum-image-picker";
import {
  QUESTION_TAG_LIMIT,
  getQuestionTagSuggestions,
  questionMarkdownToPlainText,
  toggleQuestionTag,
} from "./question-composer-state";

const QuestionRichTextEditor = dynamic(
  () =>
    import("./question-rich-text-editor").then(
      (module) => module.QuestionRichTextEditor,
    ),
  {
    ssr: false,
    loading: () => <QuestionEditorSkeleton />,
  },
);

export function QuestionComposerDialog({
  open,
  zones,
  tags,
  handoff,
  onClose,
  onCreated,
}: {
  open: boolean;
  zones: ZoneView[];
  tags: ForumTagView[];
  /**
   * Set when the student arrived from a card in their mistake notebook.
   *
   * The composer knows nothing about notebooks and is not about to learn: it takes two finished
   * strings and shows them. Where they came from, and the linking that happens after the thread
   * exists, stay entirely on the caller's side.
   */
  handoff?: {
    label: string;
    errorTypeLabel: string;
    photo?: { storageKey: string; url: string };
  } | null;
  onClose: () => void;
  /**
   * Reports the thread that was just created, not merely that one was. The mistake notebook hands a
   * stuck question over to this composer and needs the new thread's id to link it back to the card;
   * the composer itself stays unaware of any of that — it only says what it made.
   */
  onCreated: (thread: ThreadView) => void;
}) {
  const t = useTranslations("community");
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const {
    items,
    error: attachmentError,
    setError: setAttachmentError,
    addFiles,
    addReady,
    removeAt,
    uploadAll,
    reset,
    fileRef,
    atLimit,
  } = useForumImagePicker();
  const [zoneId, setZoneId] = useState("");
  /**
   * Seeded from the card the student came in on.
   *
   * The handoff used to carry nothing but an id, so pressing "topluluğa sor" landed them on an empty
   * form with no sign of which card they were asking about. `handoff.label` is already "Ders · Konu"
   * — a start, not a question, which is why only the title is seeded and the body is left alone: a
   * pre-written body is a body that gets published unread. Initial state rather than an effect; the
   * caller remounts this dialog when a handoff arrives.
   */
  const [title, setTitle] = useState(handoff?.label ?? "");
  const [body, setBody] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  /**
   * The notebook photo, once. Copied server-side rather than uploaded: the bytes are already in the
   * store, and the browser cannot read them from the source origin anyway.
   */
  const [photoAdded, setPhotoAdded] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const attachNotebookPhoto = async () => {
    const photo = handoff?.photo;
    if (!photo || photoBusy) return;
    setPhotoBusy(true);
    setAttachmentError(null);
    try {
      const size = await readDisplayedImageSize(photo.url);
      const attachment = await copyForumAttachment({
        sourceKey: photo.storageKey,
        ...size,
      });
      // Marked added only if the picker took it — at the limit it refuses and says why.
      if (addReady(attachment, photo.url)) setPhotoAdded(true);
    } catch {
      setAttachmentError(t("attach_failed"));
    } finally {
      setPhotoBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = previewImageUrl
      ? undefined
      : window.setTimeout(() => titleInputRef.current?.focus(), 0);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        if (previewImageUrl) {
          event.preventDefault();
          setPreviewImageUrl(null);
          return;
        }
        if ((event.target as Element | null)?.closest("[role='listbox']"))
          return;
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        (previewImageUrl
          ? previewRef.current
          : panelRef.current
        )?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), [contenteditable='true'], a[href]",
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, onClose, open, previewImageUrl]);

  const selectedZone = zones.find((zone) => zone.id === zoneId) ?? null;
  const plainBody = questionMarkdownToPlainText(body);

  const submit = async () => {
    if (busy) return;
    if (!selectedZone) {
      setError(t("audience_required"));
      return;
    }

    const parsed = createThreadSchema.safeParse({
      title,
      body: plainBody ? body : "",
      tagIds: selectedTagIds,
    });
    if (!parsed.success) {
      setError(
        title.trim().length < 5
          ? t("composer_question_title_error")
          : t("question_content_error"),
      );
      return;
    }

    setBusy(true);
    setError(null);
    setAttachmentError(null);
    try {
      const attachments = await uploadAll();
      const thread = await postThread(
        selectedZone.id,
        parsed.data.body,
        parsed.data.title,
        attachments,
        selectedTagIds,
      );
      trackCommunityEvent("forum_thread_created", {
        mode: "question",
        zone_type: selectedZone.type,
        tag_count: selectedTagIds.length,
      });
      setZoneId("");
      setTitle("");
      setBody("");
      setSelectedTagIds([]);
      reset();
      onCreated(thread);
    } catch (submitError) {
      setError(
        submitError instanceof ApiClientError
          ? submitError.body.message
          : t("error"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] sm:max-w-2xl sm:rounded-[var(--radius-card)]"
      >
        <div
          className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--color-border)] sm:hidden"
          aria-hidden
        />
        <header className="flex min-h-14 items-center justify-between border-b border-[var(--color-border)] px-4 sm:px-5">
          <h2
            id={titleId}
            className="text-lg font-extrabold text-[var(--color-main)]"
          >
            {t("question_dialog_title")}
          </h2>
          <button
            type="button"
            aria-label={t("question_dialog_close")}
            disabled={busy}
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full text-[var(--color-secondary)] hover:bg-[var(--color-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-40"
          >
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-5">
            {/* Above the audience picker, because it answers the question the student is asking
                themselves at that moment: why am I looking at this form? The second line is the
                part that was genuinely missing — the link to the card is made after the thread is
                posted, and until now the only sign of it was a toast that arrived afterwards. */}
            {handoff ? (
              <div
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2.5"
                style={{ borderLeft: "3px solid var(--color-accent)" }}
              >
                <p className="text-xs font-bold text-[var(--color-secondary)]">
                  {t("notebook_handoff_title")}
                </p>
                <p className="text-sm font-bold text-[var(--color-main)]">
                  {handoff.label}
                  <span className="font-semibold text-[var(--color-secondary)]">
                    {" · "}
                    {handoff.errorTypeLabel}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-secondary)]">
                  {t("notebook_handoff_hint")}
                </p>

                {/* A button, not an automatic attachment. The photo on a notebook card is usually a
                    page out of somebody's book — the notebook warns about exactly that before it
                    sends anyone here — and putting copyrighted material into a public post by
                    default is not a decision this dialog gets to make on the student's behalf.
                    The thumbnail is there so they can see what they are about to publish. */}
                {handoff.photo && !photoAdded ? (
                  <button
                    type="button"
                    disabled={busy || photoBusy || atLimit}
                    onClick={() => void attachNotebookPhoto()}
                    className="mt-2 flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-1.5 pr-3 text-xs font-bold text-[var(--color-main)] transition-colors duration-150 hover:bg-[var(--color-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50 motion-reduce:transition-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={handoff.photo.url}
                      alt=""
                      className="size-8 rounded-[calc(var(--radius-card)-4px)] object-cover"
                    />
                    {photoBusy
                      ? t("notebook_handoff_photo_busy")
                      : t("notebook_handoff_photo_add")}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-sm font-bold text-[var(--color-main)]">
                {t("question_audience")}
              </p>
              <AudienceSelector
                zones={zones}
                value={zoneId}
                onChange={(nextZoneId) => {
                  setZoneId(nextZoneId);
                  setError(null);
                }}
                disabled={busy}
              />
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-[var(--color-main)]">
                {t("composer_question_title")}
              </span>
              <input
                ref={titleInputRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                disabled={busy}
                className="min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base font-bold text-[var(--color-main)] outline-none placeholder:text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
              />
            </label>

            <div>
              <p className="mb-1.5 text-sm font-bold text-[var(--color-main)]">
                {t("question_content_label")}
              </p>
              <QuestionRichTextEditor
                value={body}
                onChange={setBody}
                disabled={busy}
              />
              <p className="mt-1 text-right text-xs text-[var(--color-secondary)]">
                {body.length}/4000
              </p>
            </div>

            <QuestionTagSelector
              tags={tags}
              selectedIds={selectedTagIds}
              onChange={setSelectedTagIds}
              disabled={busy}
            />

            <div>
              <input
                ref={fileRef}
                type="file"
                accept={FORUM_ATTACHMENT_ACCEPT}
                multiple
                hidden
                onChange={(event) => addFiles(event.target.files)}
              />
              <button
                type="button"
                disabled={busy || atLimit}
                onClick={() => fileRef.current?.click()}
                className="inline-flex min-h-11 w-fit items-center gap-2 whitespace-nowrap rounded-full border border-[var(--color-border)] px-4 text-sm font-bold text-[var(--color-main)] hover:bg-[var(--color-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-40"
              >
                <Paperclip size={17} aria-hidden />
                {t("composer_attachments")}
              </button>
              <AttachmentPreviewStrip
                items={items}
                onRemove={removeAt}
                onPreviewImage={(image) => setPreviewImageUrl(image.url)}
                layout="compact"
              />
            </div>

            {error || attachmentError ? (
              <p
                role="alert"
                className="text-sm font-medium text-[var(--color-error)]"
              >
                {error ?? attachmentError}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={
              busy || !selectedZone || title.trim().length < 5 || !plainBody
            }
            onClick={() => void submit()}
            className="min-h-11 rounded-full bg-[var(--color-btn)] px-6 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("question_submit")}
          </button>
        </footer>
      </section>
      {previewImageUrl ? (
        <div
          ref={previewRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("attach_view")}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4"
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) setPreviewImageUrl(null);
          }}
        >
          <button
            type="button"
            autoFocus
            aria-label={t("attach_close")}
            onClick={() => setPreviewImageUrl(null)}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/15 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={22} aria-hidden />
          </button>
          {/* Local object-URL preview (not next/image). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImageUrl}
            alt=""
            className="max-h-full max-w-full rounded-[var(--radius-card)] object-contain"
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function QuestionTagSelector({
  tags,
  selectedIds,
  onChange,
  disabled,
}: {
  tags: ForumTagView[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const t = useTranslations("community");
  const [query, setQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(
    null,
  );
  const filteredTags = useMemo(() => {
    const selected = new Set(selectedIds);
    const selectedFirst = [
      ...tags.filter((tag) => selected.has(tag.id)),
      ...tags.filter((tag) => !selected.has(tag.id)),
    ];
    return getQuestionTagSuggestions(selectedFirst, query);
  }, [query, selectedIds, tags]);
  const suggestionName = query.trim().replace(/^#+/, "");

  const suggestTag = async () => {
    if (suggesting || suggestionName.length < 2) return;
    setSuggesting(true);
    setSuggestionMessage(null);
    try {
      const suggestion = await suggestForumTag(suggestionName);
      setSuggestionMessage(
        t("question_tag_suggested", { tag: suggestion.normalizedSlug }),
      );
    } catch (suggestionError) {
      setSuggestionMessage(
        suggestionError instanceof ApiClientError
          ? suggestionError.body.message
          : t("question_tag_suggest_error"),
      );
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-bold text-[var(--color-main)]">
        {t("question_tags_label")}
      </legend>
      <p className="mt-1 text-xs text-[var(--color-secondary)]">
        {t("question_tags_hint")}
      </p>
      <label className="mt-2 flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]">
        <Search
          size={16}
          className="shrink-0 text-[var(--color-secondary)]"
          aria-hidden
        />
        <span className="sr-only">{t("question_tag_search")}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("question_tag_search")}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-main)] outline-none placeholder:text-[var(--color-secondary)]"
        />
      </label>
      <div
        className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto"
        aria-live="polite"
      >
        {filteredTags.map((tag) => {
          const selected = selectedIds.includes(tag.id);
          const limitReached = selectedIds.length >= QUESTION_TAG_LIMIT;
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled || (!selected && limitReached)}
              onClick={() => onChange(toggleQuestionTag(selectedIds, tag.id))}
              className={`min-h-11 rounded-full border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 ${
                selected
                  ? "border-[var(--community-blue-border)] bg-[var(--community-blue-soft)] text-[var(--community-blue-ink)]"
                  : "border-[var(--color-border)] text-[var(--color-main)] hover:bg-[var(--color-soft)]"
              }`}
            >
              #{tag.slug}
            </button>
          );
        })}
        {filteredTags.length === 0 && suggestionName.length >= 2 ? (
          <div className="flex w-full items-center justify-between gap-3 py-2">
            <p className="text-xs text-[var(--color-secondary)]">
              {t("question_no_tags")}
            </p>
            <button
              type="button"
              disabled={disabled || suggesting}
              onClick={suggestTag}
              className="min-h-11 shrink-0 rounded-full border border-[var(--community-blue-border)] px-3 text-xs font-bold text-[var(--community-blue-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50"
            >
              {suggesting
                ? t("question_tag_suggesting")
                : t("question_tag_suggest_action", { tag: suggestionName })}
            </button>
          </div>
        ) : null}
      </div>
      {suggestionMessage ? (
        <p className="mt-2 text-xs text-[var(--color-secondary)]" role="status">
          {suggestionMessage}
        </p>
      ) : null}
    </fieldset>
  );
}

function QuestionEditorSkeleton() {
  const t = useTranslations("community");
  return (
    <div
      className="grid min-h-64 place-items-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-soft)] text-sm text-[var(--color-secondary)]"
      aria-live="polite"
    >
      {t("question_editor_loading")}
    </div>
  );
}
