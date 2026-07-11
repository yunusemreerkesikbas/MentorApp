"use client";

import { useTranslations } from "next-intl";
import { AttachmentPreviewStrip } from "./attachment-preview-strip";
import { FORUM_ATTACHMENT_ACCEPT, type useForumImagePicker } from "./use-forum-image-picker";

/**
 * Presentational attachment picker (preview strip + attach button + hidden input) for the QA composers,
 * driven by `useForumImagePicker`. Accepts images + files (PDF/Office). ThreadComposer keeps its own
 * inline layout (send-arrow footer) but shares the same strip.
 */
export function ForumImagePicker({
  picker,
  disabled,
}: {
  picker: ReturnType<typeof useForumImagePicker>;
  disabled?: boolean;
}) {
  const t = useTranslations("topluluk");
  const { items, removeAt, addFiles, fileRef, atLimit } = picker;

  return (
    <div>
      <AttachmentPreviewStrip items={items} onRemove={removeAt} />
      <button
        type="button"
        aria-label={t("attach")}
        disabled={disabled || atLimit}
        onClick={() => fileRef.current?.click()}
        className="mt-2 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[rgba(0,0,0,0.06)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
    </div>
  );
}
