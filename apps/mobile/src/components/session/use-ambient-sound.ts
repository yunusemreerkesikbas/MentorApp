import { useCallback, useEffect, useRef, useState } from "react";
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from "expo-audio";
import type { StudyRoomTheme } from "@mentor/types";
import { loadAmbientPreference, saveAmbientPreference } from "../../lib/session-store.js";
import {
  ambientTheme,
  shouldPlayAmbient,
  type AmbientPreference,
  type AmbientTrackId,
} from "../../lib/session-view.js";

import sceneLibraryAmbience from "../../../../web/public/audio/scene-library-ambience.mp3";
import sceneLibraryMusic from "../../../../web/public/audio/scene-library-music.mp3";
import sceneCafeAmbience from "../../../../web/public/audio/scene-cafe-ambience.mp3";
import sceneCafeMusic from "../../../../web/public/audio/scene-cafe-music.mp3";
import sceneHomeAmbience from "../../../../web/public/audio/scene-home-ambience.mp3";
import sceneHomeMusic from "../../../../web/public/audio/scene-home-music.mp3";

/** Bundled room sounds, the web's `AMBIENT_THEME_LAYERS`: the place's ambience over a quiet music bed. */
const LAYERS = {
  LIBRARY: {
    ambience: sceneLibraryAmbience,
    music: sceneLibraryMusic,
  },
  CAFE: {
    ambience: sceneCafeAmbience,
    music: sceneCafeMusic,
  },
  HOME: {
    ambience: sceneHomeAmbience,
    music: sceneHomeMusic,
  },
} as const satisfies Record<StudyRoomTheme, { ambience: number; music: number }>;

/** Fixed gains, as on the web: the room leads, the music is a bed. Loudness is the device's. */
const VOLUME = { ambience: 0.35, music: 0.16 };
const PREVIEW_MS = 5000;

function prepare(player: AudioPlayer, source: number, volume: number) {
  player.replace(source);
  player.loop = true;
  player.volume = volume;
}

/**
 * The web's `useSessionAmbientSound`: plays while the timer runs (focus or break, not paused),
 * and a 5-second preview when a sound is picked on the setup screen.
 */
export function useAmbientSound({
  phase,
  isPaused,
  sceneTheme,
}: {
  phase: "idle" | "focus" | "break" | "done";
  isPaused: boolean;
  sceneTheme: StudyRoomTheme;
}) {
  const [preference, setPreference] = useState<AmbientPreference>(loadAmbientPreference);
  const ambience = useAudioPlayer(null);
  const music = useAudioPlayer(null);
  const loadedTheme = useRef<StudyRoomTheme | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const room = ambientTheme(preference.trackId, sceneTheme);

  useEffect(() => {
    // The room should still play with the phone on silent, like a timer app's own sounds.
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const load = useCallback((theme: StudyRoomTheme) => {
    if (loadedTheme.current === theme) return;
    loadedTheme.current = theme;
    prepare(ambience, LAYERS[theme].ambience, VOLUME.ambience);
    prepare(music, LAYERS[theme].music, VOLUME.music);
  }, [ambience, music]);

  const pause = useCallback(() => {
    ambience.pause();
    music.pause();
  }, [ambience, music]);

  const clearPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
  }, []);

  useEffect(() => {
    if (shouldPlayAmbient(phase, isPaused, preference) && room) {
      clearPreview();
      load(room);
      ambience.play();
      music.play();
    } else if (!previewTimer.current) {
      pause();
    }
  }, [ambience, clearPreview, isPaused, load, music, pause, phase, preference, room]);

  useEffect(() => () => clearPreview(), [clearPreview]);

  const setTrackId = useCallback((trackId: AmbientTrackId) => {
    const next: AmbientPreference = { trackId, muted: trackId === "off" ? false : preference.muted };
    setPreference(next);
    saveAmbientPreference(next);
    const previewRoom = ambientTheme(trackId, sceneTheme);
    if (phase !== "idle") return;
    clearPreview();
    if (!previewRoom) {
      pause();
      return;
    }
    // A taste of the room on the setup screen, then quiet until the session starts.
    load(previewRoom);
    ambience.play();
    music.play();
    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;
      pause();
    }, PREVIEW_MS);
  }, [ambience, clearPreview, load, music, pause, phase, preference.muted, sceneTheme]);

  const toggleMute = useCallback(() => {
    if (preference.trackId === "off") return;
    const next = { ...preference, muted: !preference.muted };
    setPreference(next);
    saveAmbientPreference(next);
  }, [preference]);

  return { preference, setTrackId, toggleMute };
}
