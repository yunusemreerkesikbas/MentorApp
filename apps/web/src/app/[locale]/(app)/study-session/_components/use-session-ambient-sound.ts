"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudyRoomTheme } from "@mentor/types";
import {
  type AmbientLayers,
  type AmbientTrackId,
  ambientLayers,
  migrateAmbientTrackId,
} from "@/lib/ambient-tracks";
import type { SessionPhase } from "./use-session-timer";

const STORAGE_KEY = "mentor.session.ambientSound";
/**
 * Fixed app gains — the user sets loudness with the device. The room leads; the music is a bed
 * under it, there to be felt rather than listened to.
 */
const LAYER_VOLUME: Record<keyof AmbientLayers, number> = {
  ambience: 0.35,
  music: 0.16,
};
const LAYER_KEYS = Object.keys(LAYER_VOLUME) as (keyof AmbientLayers)[];
const PREVIEW_DURATION_MS = 5000;

type LayerAudio = Partial<Record<keyof AmbientLayers, HTMLAudioElement>>;

function playAll(audio: LayerAudio): Promise<unknown> {
  return Promise.all(Object.values(audio).map((el) => el.play()));
}

function pauseAll(audio: LayerAudio): void {
  for (const el of Object.values(audio)) el.pause();
}

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

    const stored = parsed.trackId ? migrateAmbientTrackId(parsed.trackId) : null;
    if (stored) {
      return {
        trackId: stored,
        muted: parsed.muted === true,
      };
    }

    if (typeof parsed.enabled === "boolean") {
      return {
        trackId: parsed.enabled ? "scene" : "off",
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

/** Whether the user has ever expressed an ambient preference on this device. */
function hasStoredPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export interface UseSessionAmbientSoundOptions {
  phase: SessionPhase;
  isPaused: boolean;
  /** The room on screen: what `scene` sounds like, and what it switches to when the room does. */
  sceneTheme: StudyRoomTheme;
  /**
   * Track a study room suggests (`scene`). Only fills a preference the user has never set: an
   * explicit "Sessiz" is a real choice and must survive walking into a room. Nothing is
   * persisted until the user acts on it.
   */
  suggestedTrackId?: AmbientTrackId | null;
}

export interface UseSessionAmbientSoundResult {
  trackId: AmbientTrackId;
  muted: boolean;
  setTrackId: (trackId: AmbientTrackId) => void;
  toggleMute: () => void;
}

export function useSessionAmbientSound({
  phase,
  isPaused,
  sceneTheme,
  suggestedTrackId = null,
}: UseSessionAmbientSoundOptions): UseSessionAmbientSoundResult {
  const audioRef = useRef<LayerAudio>({});
  const sceneThemeRef = useRef(sceneTheme);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewActiveRef = useRef(false);
  const phaseRef = useRef(phase);

  const [preference, setPreference] = useState<AmbientSoundPreference>(() =>
    readPreference(),
  );
  /** Captured once, next to the preference it qualifies: has the user ever chosen a track? */
  const [hasOwnPreference] = useState(hasStoredPreference);

  /**
   * The track actually playing. A room's theme only fills a genuinely blank preference — an
   * explicit "Sessiz" is a real choice and survives walking into a room. Derived rather than
   * written into state, so the suggestion never becomes a stored preference on its own.
   */
  const trackId: AmbientTrackId =
    suggestedTrackId && !hasOwnPreference && preference.trackId === "off"
      ? suggestedTrackId
      : preference.trackId;

  /** Changes when the scene does (for `scene`), so the effects below swap the loops. */
  const layersKey = ambientLayers(trackId, sceneTheme)?.ambience ?? null;

  useEffect(() => {
    phaseRef.current = phase;
    sceneThemeRef.current = sceneTheme;
  }, [phase, sceneTheme]);

  const clearPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    previewActiveRef.current = false;
  }, []);

  const syncAudioSrc = useCallback((trackId: AmbientTrackId) => {
    const layers = ambientLayers(trackId, sceneThemeRef.current);
    const audio = audioRef.current;

    for (const key of LAYER_KEYS) {
      const src = layers?.[key] ?? null;
      let el = audio[key];
      if (!src) {
        if (el) {
          el.pause();
          el.removeAttribute("src");
        }
        continue;
      }
      if (!el) {
        el = new Audio();
        el.loop = true;
        el.preload = "auto";
        el.volume = LAYER_VOLUME[key];
        audio[key] = el;
      }
      // `el.src` reads back absolute; compare resolved URLs so an unchanged layer keeps playing.
      if (el.src !== new URL(src, window.location.href).href) {
        el.pause();
        el.src = src;
      }
    }
  }, []);

  const startIdlePreview = useCallback(
    (trackId: AmbientTrackId) => {
      clearPreview();
      if (phaseRef.current !== "idle" || trackId === "off") return;

      syncAudioSrc(trackId);
      const audio = audioRef.current;

      previewActiveRef.current = true;
      void playAll(audio).catch(() => {
        previewActiveRef.current = false;
      });

      previewTimerRef.current = setTimeout(() => {
        previewActiveRef.current = false;
        previewTimerRef.current = null;
        if (phaseRef.current === "idle") {
          pauseAll(audio);
        }
      }, PREVIEW_DURATION_MS);
    },
    [clearPreview, syncAudioSrc],
  );

  useEffect(() => {
    return () => {
      clearPreview();
      for (const el of Object.values(audioRef.current)) {
        el.pause();
        el.removeAttribute("src");
      }
      audioRef.current = {};
    };
  }, [clearPreview]);

  useEffect(() => {
    if (phase !== "idle") {
      clearPreview();
    }
  }, [phase, clearPreview]);

  useEffect(() => {
    syncAudioSrc(trackId);
  }, [trackId, layersKey, syncAudioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!layersKey) return;

    if (shouldPlayAudio(phase, isPaused, trackId, preference.muted)) {
      void playAll(audio).catch(() => {
        // Autoplay blocked without gesture — Başla click should unlock
      });
      return;
    }

    if (previewActiveRef.current) return;

    pauseAll(audio);
  }, [phase, isPaused, trackId, layersKey, preference.muted]);

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
            pauseAll(audioRef.current);
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
      // Acts on the track that is actually playing, so muting works on a room-suggested one
      // too — and that mute is the moment the suggestion becomes the user's own preference.
      if (trackId === "off") return prev;
      const next = { trackId, muted: !prev.muted };
      writePreference(next);

      if (!next.muted && shouldPlayAudio(phase, isPaused, next.trackId, next.muted)) {
        void playAll(audioRef.current).catch(() => {
          // Ignore
        });
      }

      return next;
    });
  }, [phase, isPaused, trackId]);


  return {
    trackId,
    muted: preference.muted,
    setTrackId,
    toggleMute,
  };
}
