"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AmbientTrackId,
  ambientTrackSrc,
  isAmbientTrackId,
} from "@/lib/ambient-tracks";
import type { SessionPhase } from "./use-session-timer";

const STORAGE_KEY = "mentor.session.ambientSound";
/** Fixed app gain — user adjusts loudness via system volume. */
const PLAYBACK_VOLUME = 0.35;
const PREVIEW_DURATION_MS = 5000;

interface AmbientSoundPreference {
  trackId: AmbientTrackId;
  muted: boolean;
}

interface LegacyAmbientSoundPreference {
  enabled?: boolean;
  volume?: number;
  trackId?: string;
  muted?: boolean;
}

function readPreference(): AmbientSoundPreference {
  if (typeof window === "undefined") {
    return { trackId: "off", muted: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { trackId: "off", muted: false };

    const parsed = JSON.parse(raw) as Partial<AmbientSoundPreference> &
      LegacyAmbientSoundPreference;

    if (parsed.trackId && isAmbientTrackId(parsed.trackId)) {
      return {
        trackId: parsed.trackId,
        muted: parsed.muted === true,
      };
    }

    if (typeof parsed.enabled === "boolean") {
      return {
        trackId: parsed.enabled ? "soft" : "off",
        muted: false,
      };
    }

    return { trackId: "off", muted: false };
  } catch {
    return { trackId: "off", muted: false };
  }
}

function writePreference(preference: AmbientSoundPreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // localStorage unavailable — ignore
  }
}

function shouldPlayAudio(
  phase: SessionPhase,
  isPaused: boolean,
  trackId: AmbientTrackId,
  muted: boolean,
): boolean {
  return (
    trackId !== "off" &&
    !muted &&
    (phase === "focus" || phase === "break") &&
    !isPaused
  );
}

export interface UseSessionAmbientSoundOptions {
  phase: SessionPhase;
  isPaused: boolean;
}

export interface UseSessionAmbientSoundResult {
  trackId: AmbientTrackId;
  muted: boolean;
  isAudible: boolean;
  setTrackId: (trackId: AmbientTrackId) => void;
  toggleMute: () => void;
}

export function useSessionAmbientSound({
  phase,
  isPaused,
}: UseSessionAmbientSoundOptions): UseSessionAmbientSoundResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewActiveRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const [preference, setPreference] = useState<AmbientSoundPreference>(() =>
    readPreference(),
  );

  const clearPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    previewActiveRef.current = false;
  }, []);

  const syncAudioSrc = useCallback((trackId: AmbientTrackId) => {
    const src = ambientTrackSrc(trackId);
    let audio = audioRef.current;

    if (!src) {
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      loadedSrcRef.current = null;
      return;
    }

    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;
    }

    audio.volume = PLAYBACK_VOLUME;

    if (loadedSrcRef.current !== src) {
      audio.pause();
      audio.src = src;
      loadedSrcRef.current = src;
    }
  }, []);

  const startIdlePreview = useCallback(
    (trackId: AmbientTrackId) => {
      clearPreview();
      if (phaseRef.current !== "idle" || trackId === "off") return;

      syncAudioSrc(trackId);
      const audio = audioRef.current;
      if (!audio) return;

      previewActiveRef.current = true;
      void audio.play().catch(() => {
        previewActiveRef.current = false;
      });

      previewTimerRef.current = setTimeout(() => {
        previewActiveRef.current = false;
        previewTimerRef.current = null;
        if (phaseRef.current === "idle") {
          audio.pause();
        }
      }, PREVIEW_DURATION_MS);
    },
    [clearPreview, syncAudioSrc],
  );

  useEffect(() => {
    return () => {
      clearPreview();
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      audioRef.current = null;
      loadedSrcRef.current = null;
    };
  }, [clearPreview]);

  useEffect(() => {
    if (phase !== "idle") {
      clearPreview();
    }
  }, [phase, clearPreview]);

  useEffect(() => {
    syncAudioSrc(preference.trackId);
  }, [preference.trackId, syncAudioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !ambientTrackSrc(preference.trackId)) return;

    if (shouldPlayAudio(phase, isPaused, preference.trackId, preference.muted)) {
      void audio.play().catch(() => {
        // Autoplay blocked without gesture — Başla click should unlock
      });
      return;
    }

    if (previewActiveRef.current) return;

    audio.pause();
  }, [phase, isPaused, preference.trackId, preference.muted]);

  const setTrackId = useCallback(
    (trackId: AmbientTrackId) => {
      setPreference((prev) => {
        const next: AmbientSoundPreference = {
          trackId,
          muted: trackId === "off" ? false : prev.muted,
        };
        writePreference(next);

        if (phaseRef.current === "idle") {
          if (trackId === "off") {
            clearPreview();
            audioRef.current?.pause();
          } else {
            queueMicrotask(() => startIdlePreview(trackId));
          }
        }

        return next;
      });
    },
    [clearPreview, startIdlePreview],
  );

  const toggleMute = useCallback(() => {
    setPreference((prev) => {
      if (prev.trackId === "off") return prev;
      const next = { ...prev, muted: !prev.muted };
      writePreference(next);

      const audio = audioRef.current;
      if (
        audio &&
        !next.muted &&
        shouldPlayAudio(phase, isPaused, next.trackId, next.muted)
      ) {
        void audio.play().catch(() => {
          // Ignore
        });
      }

      return next;
    });
  }, [phase, isPaused]);

  const isAudible =
    previewActiveRef.current ||
    shouldPlayAudio(phase, isPaused, preference.trackId, preference.muted);

  return {
    trackId: preference.trackId,
    muted: preference.muted,
    isAudible,
    setTrackId,
    toggleMute,
  };
}
