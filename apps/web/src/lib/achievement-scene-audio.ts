/**
 * Plays the achievement scene's sound design on the Web Audio clock. Voices are synthesised once
 * per session (achievement-scene-sfx.ts): the ones the opening needs while the curtain has barely
 * started to fall (a stall there is invisible; during the spark's flight it would not be), the
 * rest one per idle slot. Cues are scheduled sample-accurately; a batch can be cancelled (a skip)
 * and the gather hum is cut with a short fade at the ignite.
 *
 * Graph: source → cue gain → pan → bus → (dry + room) → master → limiter → speakers.
 */
import {
  SCENE_MASTER_GAIN,
  SFX_VOICES,
  synthesizeRoom,
  synthesizeVoice,
  type SfxCue,
  type SfxVoice,
  type StereoClip,
} from "./achievement-scene-sfx";
import { achievementAudioContext, pageHasUserActivation, unlockAchievementAudio } from "./achievement-sound";

/** A cue more than this late (the context unlocked late) is dropped instead of played out of step. */
const STALE_AFTER = 0.08;
/** Fades for a cut hum and for a dismissed scene, seconds. */
const CUT_FADE = 0.06;
const SILENCE_FADE = 0.12;

interface Rig {
  context: AudioContext;
  bus: GainNode;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  voice: SfxVoice;
  startAt: number;
}

export interface CueBatch {
  /** Stops the cues of this batch that have not started yet. */
  cancel(): void;
}

const NO_BATCH: CueBatch = { cancel: () => undefined };
const buffers = new Map<SfxVoice, AudioBuffer>();
const live = new Set<Voice>();
let rig: Rig | null = null;
let warming = false;

function toBuffer(context: BaseAudioContext, clip: StereoClip): AudioBuffer {
  const buffer = context.createBuffer(2, clip.left.length, clip.sampleRate);
  buffer.getChannelData(0).set(clip.left);
  buffer.getChannelData(1).set(clip.right);
  return buffer;
}

function voiceBuffer(context: AudioContext, voice: SfxVoice): AudioBuffer {
  let buffer = buffers.get(voice);
  if (!buffer) {
    buffer = toBuffer(context, synthesizeVoice(voice, context.sampleRate));
    buffers.set(voice, buffer);
  }
  return buffer;
}

function ensureRig(context: AudioContext): Rig {
  if (rig?.context === context) return rig;
  const bus = context.createGain();
  const room = context.createConvolver();
  room.normalize = false;
  room.buffer = toBuffer(context, synthesizeRoom(context.sampleRate));
  const master = context.createGain();
  master.gain.value = SCENE_MASTER_GAIN;
  // A safety limiter for overlaps (the burst lands on the gather's tail and the chime).
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  bus.connect(master);
  bus.connect(room).connect(master);
  master.connect(limiter).connect(context.destination);
  rig = { context, bus };
  return rig;
}

/** The context, if the page may make sound yet. */
function readyContext(): AudioContext | null {
  return pageHasUserActivation() ? achievementAudioContext() : null;
}

/** Sound is decoration: a browser without part of Web Audio must never stop the scene. */
function quietly<T>(fallback: T, run: () => T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

/** Tries to start audio now; returns whether it is running. Call it again from a gesture. */
export function unlockSceneAudio(): Promise<boolean> {
  return pageHasUserActivation() ? unlockAchievementAudio() : Promise.resolve(false);
}

/** Renders `now` immediately and every other voice one per idle slot. */
export function warmSceneAudio(now: ReadonlyArray<SfxVoice>): void {
  const context = readyContext();
  if (!context || !quietly(false, () => (ensureRig(context), true))) return;
  for (const voice of now) quietly(null, () => voiceBuffer(context, voice));
  if (warming) return;
  warming = true;
  const idle = (step: () => void) =>
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(step, { timeout: 400 })
      : window.setTimeout(step, 16);
  const next = () => {
    const voice = SFX_VOICES.find((candidate) => !buffers.has(candidate));
    if (!voice) {
      warming = false;
      return;
    }
    if (!quietly(false, () => (voiceBuffer(context, voice), true))) {
      warming = false;
      return;
    }
    idle(next);
  };
  idle(next);
}

/** Schedules `cues` relative to a moment `startsIn` seconds from now (negative: already past). */
export function playSceneCues(cues: ReadonlyArray<SfxCue>, startsIn: number): CueBatch {
  return quietly(NO_BATCH, () => schedule(cues, startsIn));
}

function schedule(cues: ReadonlyArray<SfxCue>, startsIn: number): CueBatch {
  const context = readyContext();
  if (!context) return NO_BATCH;
  const { bus } = ensureRig(context);
  const batch: Voice[] = [];
  for (const cue of cues) {
    const when = startsIn + cue.at;
    if (when < -STALE_AFTER) continue;
    const source = context.createBufferSource();
    source.buffer = voiceBuffer(context, cue.voice);
    source.playbackRate.value = cue.pitch ?? 1;
    const gain = context.createGain();
    gain.gain.value = cue.gain ?? 1;
    const pan = context.createStereoPanner();
    pan.pan.value = cue.pan ?? 0;
    source.connect(gain).connect(pan).connect(bus);
    const entry: Voice = { source, gain, voice: cue.voice, startAt: context.currentTime + Math.max(0, when) };
    source.onended = () => {
      live.delete(entry);
      pan.disconnect();
    };
    source.start(entry.startAt);
    live.add(entry);
    batch.push(entry);
  }
  return {
    cancel: () =>
      quietly(undefined, () => {
        for (const entry of batch) {
          if (live.has(entry) && entry.startAt > context.currentTime) entry.source.stop();
        }
      }),
  };
}

function fadeOut(entries: Iterable<Voice>, seconds: number): void {
  const context = rig?.context;
  if (!context) return;
  const now = context.currentTime;
  for (const entry of entries) {
    if (entry.startAt > now) {
      entry.source.stop();
      continue;
    }
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
    entry.gain.gain.linearRampToValueAtTime(0, now + seconds);
    entry.source.stop(now + seconds + 0.01);
  }
}

/** The ignite: the hum that was gathering stops as the light goes off. */
export function cutSceneGather(): void {
  quietly(undefined, () => fadeOut([...live].filter((entry) => entry.voice === "gather"), CUT_FADE));
}

/** A dismissed scene takes its sound with it. */
export function silenceScene(): void {
  quietly(undefined, () => fadeOut([...live], SILENCE_FADE));
}
