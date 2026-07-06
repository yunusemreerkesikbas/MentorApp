"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Attachment } from "@mentor/types";
import { resolveApiUrl } from "@/lib/api-base";

/**
 * Post image gallery (Phase 1). 1 image keeps its aspect ratio (capped); 2–4 tile in a 2-col grid
 * (3 → first spans both columns). Tapping opens a lightbox. Lives inside clickable feed rows, so every
 * interaction stops propagation to avoid triggering the row's navigation.
 */
export function AttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  const t = useTranslations("topluluk");
  const [active, setActive] = useState<Attachment | null>(null);
  const images = attachments.filter((a) => a.kind === "image");

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  if (images.length === 0) return null;

  const single = images.length === 1;

  return (
    <>
      <div
        className={`mt-2 grid gap-1 overflow-hidden rounded-[var(--radius-card)] ${single ? "grid-cols-1" : "grid-cols-2"}`}
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        {images.map((a, i) => {
          const ratio = single && a.width && a.height ? `${a.width} / ${a.height}` : "1 / 1";
          const span = !single && images.length === 3 && i === 0 ? "col-span-2" : "";
          return (
            <button
              key={a.id}
              type="button"
              aria-label={t("attach_view")}
              onClick={(e) => {
                e.stopPropagation();
                setActive(a);
              }}
              className={`relative block w-full cursor-pointer overflow-hidden bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${span}`}
              style={{ aspectRatio: ratio, maxHeight: single ? 420 : undefined }}
            >
              {/* Storage URL (not next/image — dev fake endpoint + R2 aren't in the image config). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveApiUrl(a.url)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={(e) => {
            e.stopPropagation();
            setActive(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={t("attach_close")}
            onClick={(e) => {
              e.stopPropagation();
              setActive(null);
            }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveApiUrl(active.url)}
            alt=""
            className="max-h-full max-w-full rounded-[var(--radius-card)] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
