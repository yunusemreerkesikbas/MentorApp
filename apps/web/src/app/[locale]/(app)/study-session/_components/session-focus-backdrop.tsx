"use client";

import { useState } from "react";
import Image from "next/image";

export const SESSION_FOCUS_BG_SRC = "/visuals/session-focus-bg.webp";

/**
 * Immersive focus/break ground: approved visual when present, DESIGN blobs otherwise,
 * plus concentric ripples behind the timer.
 */
export function SessionFocusBackdrop() {
  const [visualFailed, setVisualFailed] = useState(false);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {visualFailed ? (
        <BlobFallback />
      ) : (
        <Image
          src={SESSION_FOCUS_BG_SRC}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          onError={() => setVisualFailed(true)}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-bg) 42%, transparent)",
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <span className="session-focus-ripple session-focus-ripple-1" />
        <span className="session-focus-ripple session-focus-ripple-2" />
        <span className="session-focus-ripple session-focus-ripple-3" />
      </div>
    </div>
  );
}

function BlobFallback() {
  return (
    <div className="absolute inset-0" style={{ backgroundColor: "var(--color-bg)" }}>
      <div
        className="absolute -left-24 -top-24 h-96 w-96 rounded-full blur-[150px]"
        style={{
          backgroundColor: "var(--blob-pink)",
          opacity: "var(--blob-pink-opacity)",
        }}
      />
      <div
        className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full blur-[150px]"
        style={{
          backgroundColor: "var(--blob-blue)",
          opacity: "var(--blob-blue-opacity)",
        }}
      />
      <div
        className="absolute -bottom-32 left-1/4 h-96 w-96 rounded-full blur-[150px]"
        style={{
          backgroundColor: "var(--blob-cyan)",
          opacity: "var(--blob-cyan-opacity)",
        }}
      />
    </div>
  );
}
