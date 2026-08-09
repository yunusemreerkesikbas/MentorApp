"use client";

import { useTranslations } from "next-intl";
import { formatBytes } from "@/lib/format-bytes";
import type { PickedAttachment } from "./use-forum-image-picker";

const RemoveButton = ({
  label,
  onClick,
  prominent = false,
}: {
  label: string;
  onClick: () => void;
  prominent?: boolean;
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`${prominent ? "h-8 w-8 bg-black/70 hover:bg-black/85" : "h-5 w-5 bg-black/55 hover:bg-black/70"} flex flex-shrink-0 items-center justify-center rounded-full text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/70 motion-reduce:transition-none`}
  >
    <svg width={prominent ? 16 : 12} height={prominent ? 16 : 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
);

/** Composer preview strip — image thumbnails + file chips with a remove control on each. */
export function AttachmentPreviewStrip({
  items,
  onRemove,
  layout = "strip",
}: {
  items: PickedAttachment[];
  onRemove: (idx: number) => void;
  layout?: "strip" | "media";
}) {
  const t = useTranslations("community");
  if (items.length === 0) return null;

  return (
    <div
      className={
        layout === "media"
          ? "mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-[var(--radius-card)]"
          : "mt-2 flex flex-wrap gap-2"
      }
    >
      {items.map((p, i) =>
        p.kind === "image" ? (
          <div
            key={p.url}
            className={
              layout === "media"
                ? `relative min-h-48 overflow-hidden bg-[var(--color-surface-container)] ${items.filter((item) => item.kind === "image").length === 1 ? "col-span-2 aspect-[16/9]" : "aspect-square"}`
                : "relative h-16 w-16 overflow-hidden rounded-[var(--radius-card)]"
            }
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          >
            {/* Local object-URL preview (not next/image — it's a client blob). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            <span className={layout === "media" ? "absolute right-2 top-2" : "absolute right-0.5 top-0.5"}>
              <RemoveButton
                label={t("attach_remove")}
                onClick={() => onRemove(i)}
                prominent={layout === "media"}
              />
            </span>
          </div>
        ) : (
          <div
            key={`file-${i}`}
            className="flex max-w-full items-center gap-2 rounded-[var(--radius-card)] px-2.5 py-2"
            style={{ border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="min-w-0">
              <span className="block max-w-[160px] truncate text-[12px] font-medium" style={{ color: "var(--color-main)" }}>
                {p.file.name}
              </span>
              <span className="block text-[11px]" style={{ color: "var(--color-secondary)" }}>
                {formatBytes(p.file.size)}
              </span>
            </span>
            <RemoveButton label={t("attach_remove")} onClick={() => onRemove(i)} />
          </div>
        ),
      )}
    </div>
  );
}
