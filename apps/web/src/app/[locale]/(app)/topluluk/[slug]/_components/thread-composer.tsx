"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AttachmentInput } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "@/components/form";
import { AttachmentPreviewStrip } from "../../_components/attachment-preview-strip";
import {
  FORUM_ATTACHMENT_ACCEPT,
  useForumImagePicker,
} from "../../_components/use-forum-image-picker";
import { useMentionAutocomplete } from "../../_components/use-mention-autocomplete";
import { MentionSuggestions } from "../../_components/mention-suggestions";

export function ThreadComposer({
  placeholder,
  submitLabel,
  onSubmit,
  zoneId,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string, attachments: AttachmentInput[]) => Promise<void>;
  /** Enables @mention autocomplete over the zone's members; omitted → plain textarea. */
  zoneId?: string;
}) {
  const t = useTranslations("topluluk");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionAutocomplete(zoneId, textareaRef, setValue);
  const { items, error, setError, addFiles, removeAt, uploadAll, reset, fileRef, atLimit } =
    useForumImagePicker();

  const send = async () => {
    const body = value.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const attachments = await uploadAll();
      await onSubmit(body, attachments);
      setValue("");
      reset();
    } catch (err) {
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
    <div className="flex flex-col gap-2 py-4 pl-3 pr-4">
      <div className="flex items-start gap-3">
        {/* Generic viewer avatar — decorative placeholder, no current-user fetch */}
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(0,0,0,0.06)" }}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onSelect={mention.sync}
            onBlur={mention.close}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            maxLength={4000}
            className="w-full resize-none border-0 bg-transparent text-[15px] leading-[22px] outline-none placeholder:font-medium placeholder:text-[color:var(--color-secondary)]"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
            {...mention.inputProps}
          />
          <MentionSuggestions mention={mention} />

          <AttachmentPreviewStrip items={items} onRemove={removeAt} />

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
              className="flex cursor-pointer items-center justify-center rounded-full transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              style={{
                width: 36,
                height: 36,
                background: value.trim() ? "var(--color-btn)" : "rgba(0,0,0,0.06)",
                color: value.trim() ? "#fff" : "var(--color-secondary)",
              }}
            >
              {busy ? (
                <span className="text-[10px] font-semibold">{t("compose_sending")}</span>
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
