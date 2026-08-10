"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Attachment } from "@mentor/types";
import { resolveApiUrl } from "@/lib/api-base";
import { formatBytes } from "@/lib/format-bytes";

/**
 * Post image gallery. Multiple images use a 1.25-slide swipe rail on mobile and tile inside the
 * shared 16:9 frame on desktop. Tapping opens the uncropped lightbox carousel (arrows + keyboard +
 * swipe + dots across all images of the post). Lives inside clickable feed rows, so interactions
 * stop propagation to avoid triggering the row's navigation.
 */
export function AttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  const t = useTranslations("community");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");
  const count = images.length;
  const touchStartX = useRef<number | null>(null);

  const close = useCallback(() => setActiveIndex(null), []);
  const go = useCallback(
    (dir: number) => setActiveIndex((i) => (i === null ? i : (i + dir + count) % count)),
    [count],
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIndex, close, go]);

  if (count === 0 && files.length === 0) return null;

  const single = count === 1;
  const active = activeIndex === null ? null : images[activeIndex]!;

  return (
    <>
      {count > 0 && (
      <div
        className={
          single
            ? "mt-2 grid aspect-[16/9] grid-cols-1 overflow-hidden rounded-[var(--radius-card)]"
            : `mt-2 flex snap-x snap-mandatory overflow-x-auto gap-1 overscroll-x-contain rounded-[var(--radius-card)] md:grid md:aspect-[16/9] md:grid-cols-2 md:overflow-hidden ${count > 2 ? "md:grid-rows-2" : ""}`
        }
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        {images.map((a, i) => {
          const span = count === 3 && i === 0 ? "md:row-span-2" : "";
          return (
            <button
              key={a.id}
              type="button"
              aria-label={t("attach_view")}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(i);
              }}
              className={`relative block h-full min-h-0 cursor-pointer overflow-hidden bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${single ? "w-full" : "aspect-[16/9] w-4/5 shrink-0 snap-start md:aspect-auto md:w-full md:shrink md:[scroll-snap-align:none]"} ${span}`}
            >
              {/* Storage URL (not next/image — dev fake endpoint + R2 aren't in the image config). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveApiUrl(a.url)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover object-center"
              />
            </button>
          );
        })}
      </div>
      )}

      {files.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {files.map((a) => (
            <a
              key={a.id}
              href={resolveApiUrl(a.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2 transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium" style={{ color: "var(--color-main)" }}>
                  {a.fileName ?? t("attach_file")}
                </span>
                <span className="block text-[11px]" style={{ color: "var(--color-secondary)" }}>
                  {formatBytes(a.sizeBytes)}
                </span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={t("attach_close")}
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label={t("attach_prev")}
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button
                type="button"
                aria-label={t("attach_next")}
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveApiUrl(active.url)}
            alt=""
            className="max-h-full max-w-full rounded-[var(--radius-card)] object-contain"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              touchStartX.current = e.changedTouches[0]!.clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const dx = e.changedTouches[0]!.clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            }}
          />

          {count > 1 && (
            <div className="absolute bottom-5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {images.map((a, i) => (
                <span
                  key={a.id}
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full transition-opacity"
                  style={{ background: "#fff", opacity: i === activeIndex ? 1 : 0.4 }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
