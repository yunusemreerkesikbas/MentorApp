"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  achievementAudioContext,
  pageHasUserActivation,
} from "./achievement-sound";

/**
 * The notebook's paper sounds: a book lifted off the desk, a cover opening, a page turning.
 *
 * Synthesised, not sampled. Each one is a few hundred milliseconds of filtered noise and a falling
 * sine, which is what paper and cardboard actually are to the ear, and it costs no asset, no
 * request and no decode. They share the app's one AudioContext (`achievement-sound.ts`).
 *
 * Off by default nowhere and silent under reduced motion everywhere: a student who asked the
 * screen to hold still did not ask it to rustle either. The toggle on the desk persists per device.
 */

export type NotebookSfx =
  | "lift"
  | "open"
  | "close"
  | "land"
  | "page"
  | "riffle";

const STORAGE_KEY = "mentor.notebook-sound";
const CHANGE_EVENT = "mentor:notebook-sound";

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setNotebookSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* private mode: the toggle still works for this page */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useNotebookSound() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);
  const toggle = useCallback(
    () => setNotebookSoundEnabled(!readEnabled()),
    [],
  );
  return { enabled, toggle };
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** A second and a half of noise with a little brown in it, so it reads as paper rather than hiss. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const cached = noiseBuffers.get(context);
  if (cached) return cached;
  const length = Math.floor(context.sampleRate * 1.5);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[index] = white * 0.6 + last * 3.2;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

interface NoiseSpec {
  at: number;
  duration: number;
  type: BiquadFilterType;
  from: number;
  to?: number;
  q: number;
  gain: number;
  attack: number;
}

function noise(context: AudioContext, spec: NoiseSpec): void {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = spec.type;
  filter.Q.value = spec.q;
  filter.frequency.setValueAtTime(spec.from, spec.at);
  if (spec.to) {
    filter.frequency.exponentialRampToValueAtTime(spec.to, spec.at + spec.duration);
  }
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, spec.at);
  gain.gain.exponentialRampToValueAtTime(spec.gain, spec.at + spec.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, spec.at + spec.duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(spec.at, Math.random() * 0.4);
  source.stop(spec.at + spec.duration + 0.05);
}

function thump(
  context: AudioContext,
  at: number,
  duration: number,
  from: number,
  to: number,
  level: number,
): void {
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.05);
}

/** Plays one sound now, or quietly does nothing when sound is off, unwanted or unavailable. */
export function playNotebookSfx(kind: NotebookSfx, leaves = 4): void {
  if (typeof window === "undefined") return;
  if (!readEnabled() || prefersReducedMotion() || !pageHasUserActivation()) return;
  const context = achievementAudioContext();
  if (!context) return;
  try {
    if (context.state === "suspended") void context.resume();
    const at = context.currentTime + 0.01;
    switch (kind) {
      case "lift":
        noise(context, { at, duration: 0.42, type: "bandpass", from: 500, to: 2600, q: 0.9, gain: 0.16, attack: 0.12 });
        break;
      case "open":
        thump(context, at, 0.16, 190, 70, 0.3);
        noise(context, { at, duration: 0.34, type: "highpass", from: 1600, q: 0.7, gain: 0.07, attack: 0.02 });
        break;
      case "close":
        thump(context, at, 0.14, 150, 60, 0.34);
        noise(context, { at, duration: 0.18, type: "lowpass", from: 1200, q: 0.7, gain: 0.08, attack: 0.01 });
        break;
      case "land":
        thump(context, at, 0.12, 120, 55, 0.4);
        noise(context, { at, duration: 0.12, type: "lowpass", from: 900, q: 0.7, gain: 0.12, attack: 0.005 });
        break;
      case "page":
        noise(context, { at, duration: 0.36, type: "highpass", from: 1100, q: 0.6, gain: 0.09, attack: 0.08 });
        noise(context, { at: at + 0.05, duration: 0.09, type: "bandpass", from: 3200, q: 1.6, gain: 0.05, attack: 0.01 });
        break;
      case "riffle":
        for (let leaf = 0; leaf < Math.max(1, Math.min(12, leaves)); leaf += 1) {
          noise(context, { at: at + leaf * 0.07, duration: 0.07, type: "bandpass", from: 2400 + leaf * 60, q: 1.2, gain: 0.06, attack: 0.005 });
        }
        break;
    }
  } catch {
    /* audio is decoration; a failure here must never reach the page */
  }
}
