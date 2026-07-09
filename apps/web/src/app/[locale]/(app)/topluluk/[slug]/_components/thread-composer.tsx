"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FORUM_IMAGE_MIMES } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "@/components/form";
import { useForumImagePicker } from "../../_components/use-forum-image-picker";
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
  const { images, error, setError, addFiles, removeImage, uploadAll, reset, fileRef, atLimit } =
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

          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((p, i) => (
                <div
                  key={p.url}
                  className="relative h-16 w-16 overflow-hidden rounded-[var(--radius-card)]"
                  style={{ border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  {/* Local object-URL preview (not next/image — it's a client blob). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={t("attach_remove")}
                    onClick={() => removeImage(i)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("attach_image")}
                disabled={busy || atLimit}
                onClick={() => fileRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[rgba(0,0,0,0.06)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: "var(--color-secondary)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={FORUM_IMAGE_MIMES.join(",")}
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
