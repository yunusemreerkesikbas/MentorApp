"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { AttachmentInput } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { AttachmentPreviewStrip } from "../../_components/attachment-preview-strip";
import { AuthorAvatar } from "../../_components/author-avatar";
import {
  FORUM_ATTACHMENT_ACCEPT,
  useForumImagePicker,
} from "../../_components/use-forum-image-picker";
import { useMentionAutocomplete } from "../../_components/use-mention-autocomplete";
import { MentionSuggestions } from "../../_components/mention-suggestions";

const COMPOSER_TEXTAREA_MAX_HEIGHT = 192;
const SUBMIT_PROGRESS_CEILING = 92;
const SUBMIT_PROGRESS_INTERVAL_MS = 160;
const SUBMIT_PROGRESS_RESET_MS = 220;

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, COMPOSER_TEXTAREA_MAX_HEIGHT);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > COMPOSER_TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
}

export function ThreadComposer({
  placeholder,
  submitLabel,
  onSubmit,
  zoneId,
  focusOnMount = false,
  variant = "default",
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string, attachments: AttachmentInput[]) => Promise<void>;
  /** Enables @mention autocomplete over the zone's members; omitted → plain textarea. */
  zoneId?: string;
  /** Community completion return: focus and reveal the empty composer after it mounts. */
  focusOnMount?: boolean;
  /** Reply dialogs reuse uploads and mentions but use a text submit control. */
  variant?: "default" | "reply-dialog";
}) {
  const t = useTranslations("community");
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mention = useMentionAutocomplete(zoneId, textareaRef, setValue);
  const { items, error, setError, addFiles, removeAt, uploadAll, reset, fileRef, atLimit } =
    useForumImagePicker();

  useEffect(() => {
    if (!focusOnMount) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    textarea.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [focusOnMount]);

  useEffect(
    () => () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (progressResetTimeoutRef.current) clearTimeout(progressResetTimeoutRef.current);
    },
    [],
  );

  const send = async () => {
    const body = value.trim();
    if (!body || busy) return;
    if (progressResetTimeoutRef.current) clearTimeout(progressResetTimeoutRef.current);
    setBusy(true);
    setSubmitProgress(8);
    setError(null);
    progressIntervalRef.current = setInterval(() => {
      setSubmitProgress((current) =>
        Math.min(
          SUBMIT_PROGRESS_CEILING,
          current + Math.max(1, Math.ceil((SUBMIT_PROGRESS_CEILING - current) * 0.12)),
        ),
      );
    }, SUBMIT_PROGRESS_INTERVAL_MS);
    try {
      const attachments = await uploadAll();
      await onSubmit(body, attachments);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      setSubmitProgress(100);
      setValue("");
      reset();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.overflowY = "hidden";
      }
      progressResetTimeoutRef.current = setTimeout(
        () => setSubmitProgress(0),
        reduceMotion ? 0 : SUBMIT_PROGRESS_RESET_MS,
      );
    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      setSubmitProgress(0);
      setError(err instanceof ApiClientError ? err.body.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.onKeyDown(e)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div
      className={`relative flex flex-col gap-2 overflow-hidden ${variant === "reply-dialog" ? "px-4 py-4 sm:px-5" : "py-4 pl-3 pr-4"}`}
      aria-busy={busy}
    >
      {submitProgress > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[var(--color-accent-soft)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(submitProgress)}
          aria-label={t("compose_sending")}
        >
          <motion.div
            className="relative h-full origin-left overflow-hidden bg-[var(--color-accent)]"
            initial={false}
            animate={{ scaleX: submitProgress / 100 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {busy && !reduceMotion && (
              <motion.span
                className="absolute inset-y-0 left-0 w-12 bg-white/45"
                animate={{ x: ["-100%", "700%"] }}
                transition={{ duration: 1.1, ease: "linear", repeat: Infinity }}
                aria-hidden="true"
              />
            )}
          </motion.div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <AuthorAvatar
          name={user?.displayName ?? "Mentor"}
          src={user?.avatarUrl}
          size={40}
        />
        <div className="relative min-w-0 flex-1 rounded-[var(--radius-card)] border border-transparent px-3 py-2 transition-colors duration-150 focus-within:border-[var(--color-focus-ring)] motion-reduce:transition-none">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              resizeTextarea(e.currentTarget);
            }}
            onSelect={mention.sync}
            onBlur={mention.close}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            maxLength={4000}
            className="block min-h-11 w-full resize-none overflow-hidden border-0 bg-transparent text-[15px] leading-[22px] outline-none placeholder:font-medium placeholder:text-[color:var(--color-secondary)]"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
            {...mention.inputProps}
          />
          <MentionSuggestions mention={mention} />

          <AttachmentPreviewStrip items={items} onRemove={removeAt} layout="media" />

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("attach")}
                disabled={busy || atLimit}
                onClick={() => fileRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[rgba(0,0,0,0.06)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: "var(--color-secondary)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={FORUM_ATTACHMENT_ACCEPT}
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
              <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                {value.length > 0 ? `${value.length}/4000` : ""}
              </span>
            </div>
            <button
              type="button"
              aria-label={submitLabel}
              disabled={busy || !value.trim()}
              onClick={() => void send()}
              className={`flex cursor-pointer items-center justify-center rounded-full font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${variant === "reply-dialog" ? "min-h-11 px-5 text-sm" : "h-9 w-9"}`}
              style={{
                background: value.trim() ? "var(--color-btn)" : "var(--color-soft)",
                color: value.trim() ? "#fff" : "var(--color-secondary)",
              }}
            >
              {variant === "reply-dialog" ? (
                submitLabel
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      <FormError message={error} />
    </div>
  );
}
