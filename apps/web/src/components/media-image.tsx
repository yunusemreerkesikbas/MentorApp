"use client";

import Image, { type ImageProps } from "next/image";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";

interface MediaImageProps extends Omit<ImageProps, "src" | "onError"> {
  src?: string | null;
  privateMedia?: boolean;
  retryable?: boolean;
  fallback?: ReactNode;
  onError?: () => void;
}

/** Every instance owns its failure state; no private bytes or capabilities enter a shared cache. */
export function MediaImage({ privateMedia = true, ...props }: MediaImageProps) {
  return privateMedia ? (
    <PrivateMediaImage {...props} />
  ) : (
    <ImageAttempt key={String(props.src)} {...props} />
  );
}

function PrivateMediaImage(props: MediaImageProps) {
  const { status, user } = useAuth();
  if (status !== "authenticated" || !user) return null;
  return <ImageAttempt key={`${user.id}:${String(props.src)}`} {...props} />;
}

function ImageAttempt({
  src,
  alt,
  fill,
  className,
  style,
  retryable = false,
  fallback,
  onError,
  ...props
}: MediaImageProps) {
  const t = useTranslations("media");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!src || failed) {
    if (fallback) return fallback;
    return (
      <span
        className={`${fill ? "absolute inset-0 flex" : "inline-flex"} flex-col items-center justify-center gap-2 overflow-hidden bg-[var(--color-surface-container)] p-2 text-center text-xs text-[var(--color-secondary)] ${className ?? ""}`}
        style={style}
        data-media-unavailable
      >
        <span role="img" aria-label={alt || t("unavailable")}>
          {t("unavailable")}
        </span>
        {src && retryable ? (
          <button
            type="button"
            className="min-h-11 rounded-[var(--radius-card)] px-3 font-semibold text-[var(--color-main)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setAttempt((value) => value + 1);
              setFailed(false);
            }}
          >
            {t("retry")}
          </button>
        ) : null}
      </span>
    );
  }
  return (
    <Image
      {...props}
      key={attempt}
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      style={style}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}
