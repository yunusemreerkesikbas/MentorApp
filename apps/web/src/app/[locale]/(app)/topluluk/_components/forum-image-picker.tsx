"use client";

import { useTranslations } from "next-intl";
import { FORUM_IMAGE_MIMES } from "@mentor/types";
import type { useForumImagePicker } from "./use-forum-image-picker";

/**
 * Presentational image picker (preview strip + attach button + hidden input) for the QA composers,
 * driven by `useForumImagePicker`. ThreadComposer keeps its own inline layout (send-arrow footer).
 */
export function ForumImagePicker({
  picker,
  disabled,
}: {
  picker: ReturnType<typeof useForumImagePicker>;
  disabled?: boolean;
}) {
  const t = useTranslations("topluluk");
  const { images, removeImage, addFiles, fileRef, atLimit } = picker;

  return (
    <div>
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
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
      <button
        type="button"
        aria-label={t("attach_image")}
        disabled={disabled || atLimit}
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
    </div>
  );
}
