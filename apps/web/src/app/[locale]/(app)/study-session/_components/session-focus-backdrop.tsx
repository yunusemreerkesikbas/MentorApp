"use client";

import { useState } from "react";
import Image from "next/image";
import type { StudyRoomTheme } from "@mentor/types";
import { RoomBackdrop } from "./room-backdrop";

export const SESSION_FOCUS_BG_SRC = "/visuals/session-focus-bg.webp";

/**
 * Immersive focus/break ground: approved visual when present, DESIGN blobs otherwise,
 * plus concentric ripples behind the timer.
 *
 * When the session is seated at a study room, the room's themed ground replaces the solo
 * one — same screen, same timer, different table. The ripples stay either way, so focus mode
 * reads as one thing whether you are alone or at a table.
 */
export function SessionFocusBackdrop({
  roomTheme = null,
}: {
  roomTheme?: StudyRoomTheme | null;
}) {
  const [visualFailed, setVisualFailed] = useState(false);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {roomTheme ? (
        <RoomBackdrop theme={roomTheme} veilPercent={42} />
      ) : (
        <>
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
        </>
      )}
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
