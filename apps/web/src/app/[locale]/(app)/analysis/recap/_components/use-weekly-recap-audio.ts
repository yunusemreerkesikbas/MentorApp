"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PLAYBACK_VOLUME = 0.4;

export interface UseWeeklyRecapAudioOptions {
  audioSrc: string | null;
  audioStartSeconds: number;
  audioKey: string;
  shouldPlay: boolean;
}

export interface UseWeeklyRecapAudioResult {
  muted: boolean;
  available: boolean;
  toggleMuted: () => void;
}

export function useWeeklyRecapAudio({
  audioSrc,
  audioStartSeconds,
  audioKey,
  shouldPlay,
}: UseWeeklyRecapAudioOptions): UseWeeklyRecapAudioResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let audio = audioRef.current;
    if (!audioSrc) {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      loadedSrcRef.current = null;
      loadedKeyRef.current = audioKey;
      return;
    }

    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      audio.volume = PLAYBACK_VOLUME;
      audioRef.current = audio;
    }

    if (
      loadedSrcRef.current !== audioSrc ||
      loadedKeyRef.current !== audioKey
    ) {
      audio.pause();
      audio.src = audioSrc;
      audio.currentTime = audioStartSeconds;
      loadedSrcRef.current = audioSrc;
      loadedKeyRef.current = audioKey;
    }

    if (shouldPlay && !muted) {
      void audio.play().catch(() => {
        // Browser autoplay policy or unavailable asset: the visual story continues.
      });
    } else {
      audio.pause();
    }
  }, [audioKey, audioSrc, audioStartSeconds, muted, shouldPlay]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
      }
      audioRef.current = null;
      loadedSrcRef.current = null;
      loadedKeyRef.current = null;
    };
  }, []);

  const toggleMuted = useCallback(() => {
    if (!audioSrc) return;
    const nextMuted = !muted;
    setMuted(nextMuted);

    const audio = audioRef.current;
    if (!audio) return;
    if (nextMuted) {
      audio.pause();
    } else if (shouldPlay) {
      void audio.play().catch(() => {
        // The control remains non-blocking when the browser declines playback.
      });
    }
  }, [audioSrc, muted, shouldPlay]);

  return {
    muted,
    available: audioSrc !== null,
    toggleMuted,
  };
}
