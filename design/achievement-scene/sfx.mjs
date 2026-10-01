/**
 * Sound for the "Işık Yandı" films, synthesised from the timeline's cue list: no samples, no
 * licences, and every hit lands on the frame it belongs to. The chime is the app's own
 * (apps/web/src/lib/achievement-sound.ts: E5 → G♯5 → B5 sines at 0 / 0.14 / 0.30 s).
 */
import { rng } from "./engine.mjs";

const RATE = 48_000;
const TAU = Math.PI * 2;

export function synthesize(cues, duration) {
  const length = Math.ceil(duration * RATE);
  const L = new Float32Array(length);
  const R = new Float32Array(length);
  const random = rng(99);
  for (const cue of cues) {
    const voice = VOICES[cue.type];
    if (voice) voice({ L, R, at: Math.round(cue.t * RATE), cue, random, gain: cue.gain ?? 1, pitch: cue.pitch ?? 1 });
  }
  reverb(L, R, 0.2);
  master(L, R);
  return wav(L, R);
}

// ── Building blocks ────────────────────────────────────────────────────────

function add(ctx, i, value, pan = 0) {
  const idx = ctx.at + i;
  if (idx < 0 || idx >= ctx.L.length) return;
  const angle = ((pan + 1) * Math.PI) / 4;
  ctx.L[idx] += value * Math.cos(angle);
  ctx.R[idx] += value * Math.sin(angle);
}

/** Chamberlin state-variable filter; call with a cutoff per sample for sweeps. */
function svf() {
  let low = 0;
  let band = 0;
  return (x, cutoff, damping = 0.5) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, RATE / 6)) / RATE);
    const high = x - low - damping * band;
    band += f * high;
    low += f * band;
    return { low, band, high };
  };
}

const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

function tone(ctx, { freq, start = 0, dur, gain, attack = 0.006, decay, pan = 0, glide = 0, harmonic = 0 }) {
  const n = Math.round(dur * RATE);
  const offset = Math.round(start * RATE);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const f = freq * (1 + glide * (t / dur));
    phase += (TAU * f) / RATE;
    const e = env(t, attack, decay ?? dur / 4) * (1 - Math.max(0, (t - dur + 0.02) / 0.02));
    const v = Math.sin(phase) + harmonic * Math.sin(phase * 2);
    add(ctx, offset + i, v * e * gain, pan);
  }
}

function noiseSweep(ctx, { start = 0, dur, from, to, gain, damping = 0.45, shape = "bell", panFrom = 0, panTo = 0 }) {
  const n = Math.round(dur * RATE);
  const offset = Math.round(start * RATE);
  const filter = svf();
  for (let i = 0; i < n; i += 1) {
    const p = i / n;
    const cutoff = from * (to / from) ** p;
    const { band } = filter(ctx.random() * 2 - 1, cutoff, damping);
    const e = shape === "bell" ? Math.sin(Math.PI * p) ** 1.6 : shape === "rise" ? p ** 2.2 : (1 - p) ** 2.4;
    add(ctx, offset + i, band * e * gain, panFrom + (panTo - panFrom) * p);
  }
}

// ── Voices ─────────────────────────────────────────────────────────────────

const VOICES = {
  tap(ctx) {
    noiseSweep(ctx, { dur: 0.012, from: 5000, to: 2500, gain: 0.5 * ctx.gain, shape: "fall" });
    tone(ctx, { freq: 2900, dur: 0.05, gain: 0.07 * ctx.gain, decay: 0.012 });
  },
  press(ctx) {
    noiseSweep(ctx, { dur: 0.014, from: 3800, to: 1800, gain: 0.45, shape: "fall" });
    tone(ctx, { freq: 1500, dur: 0.06, gain: 0.08, decay: 0.016 });
  },
  check(ctx) {
    tone(ctx, { freq: 880, dur: 0.12, gain: 0.12, decay: 0.05, harmonic: 0.2 });
    tone(ctx, { freq: 1318.5, start: 0.07, dur: 0.22, gain: 0.12, decay: 0.08, harmonic: 0.15 });
  },
  flame(ctx) {
    noiseSweep(ctx, { dur: 0.22, from: 380, to: 2400, gain: 0.35, shape: "bell", damping: 0.7 });
    tone(ctx, { freq: 330, dur: 0.24, gain: 0.07, decay: 0.08, glide: 0.4 });
  },
  spark(ctx) {
    noiseSweep(ctx, { dur: 0.62, from: 700, to: 3600, gain: 0.32, shape: "bell", panFrom: -0.35, panTo: 0 });
    tone(ctx, { freq: 620, dur: 0.6, gain: 0.05, attack: 0.08, decay: 0.3, glide: 1.1 });
  },
  gather(ctx) {
    const dur = Math.max(0.2, ctx.cue.until - ctx.cue.t);
    const n = Math.round(dur * RATE);
    const filter = svf();
    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / RATE;
      const p = t / dur;
      const swell = 0.25 + 0.75 * p ** 1.8;
      p1 += (TAU * 220 * (1 + 0.5 * p)) / RATE;
      p2 += (TAU * 329.63 * (1 + 0.5 * p) * 1.003) / RATE;
      p3 += (TAU * 1760 * (1 + 0.25 * p)) / RATE;
      const trem = 0.6 + 0.4 * Math.sin(TAU * (5 + 9 * p) * t);
      const { band } = filter(ctx.random() * 2 - 1, 1500 + 4000 * p, 0.3);
      const fadeIn = Math.min(1, t / 0.25);
      const v = (0.08 * Math.sin(p1) + 0.065 * Math.sin(p2) + 0.03 * Math.sin(p3) * trem + 0.1 * band) * swell * fadeIn;
      add(ctx, i, v, Math.sin(TAU * 0.35 * t) * 0.25);
    }
  },
  pop(ctx) {
    tone(ctx, { freq: 560, dur: 0.09, gain: 0.14 * ctx.gain, attack: 0.003, decay: 0.03, glide: 0.7 });
  },
  burst(ctx) {
    // Low bloom with a pitch drop, a bright air burst, then a scatter of tiny pings.
    const n = Math.round(0.9 * RATE);
    let phase = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / RATE;
      const f = 55 + 85 * Math.exp(-t / 0.06);
      phase += (TAU * f) / RATE;
      add(ctx, i, Math.sin(phase) * env(t, 0.004, 0.22) * 0.42);
    }
    noiseSweep(ctx, { dur: 0.7, from: 6000, to: 1400, gain: 0.3, shape: "fall", damping: 0.9 });
    for (let k = 0; k < 14; k += 1) {
      tone(ctx, {
        freq: 2200 + ctx.random() * 3800,
        start: 0.05 + ctx.random() * 0.85,
        dur: 0.12,
        gain: 0.03 + ctx.random() * 0.03,
        attack: 0.002,
        decay: 0.035,
        pan: ctx.random() * 1.6 - 0.8,
      });
    }
  },
  chime(ctx) {
    const notes = [
      { freq: 659.25, start: 0, dur: 0.52 },
      { freq: 830.61, start: 0.14, dur: 0.62 },
      { freq: 987.77, start: 0.3, dur: 0.78 },
    ];
    for (const note of notes) {
      tone(ctx, { ...note, gain: 0.2, attack: 0.025, decay: note.dur / 3.2, harmonic: 0.12, pan: (note.freq - 820) / 900 });
    }
  },
  twinkle(ctx) {
    const pan = ctx.cue.pan ?? 0;
    tone(ctx, { freq: 2637 * ctx.pitch, dur: 0.35, gain: 0.07 * ctx.gain, attack: 0.002, decay: 0.07, pan });
    tone(ctx, { freq: 3520 * ctx.pitch, start: 0.05, dur: 0.3, gain: 0.05 * ctx.gain, attack: 0.002, decay: 0.06, pan });
  },
  swish(ctx) {
    noiseSweep(ctx, { dur: 0.3, from: 1300, to: 6200, gain: 0.3 * ctx.gain, shape: "bell", panFrom: -0.5, panTo: 0.5 });
  },
  land(ctx) {
    tone(ctx, { freq: 523.25 * ctx.pitch, dur: 0.32, gain: 0.1 * ctx.gain, attack: 0.004, decay: 0.09, harmonic: 0.3 });
  },
  fly(ctx) {
    noiseSweep(ctx, { dur: 0.66, from: 3200, to: 800, gain: 0.28, shape: "bell", panFrom: 0.2, panTo: -0.6 });
  },
  arrive(ctx) {
    tone(ctx, { freq: 1318.5 * ctx.pitch, dur: 0.6, gain: 0.12 * ctx.gain, attack: 0.003, decay: 0.16, pan: -0.5 });
    tone(ctx, { freq: 1975.5 * ctx.pitch, start: 0.04, dur: 0.5, gain: 0.07 * ctx.gain, attack: 0.003, decay: 0.12, pan: -0.5 });
  },
};

// ── Space and level ───────────────────────────────────────────────────────

function reverb(L, R, wet) {
  const combsL = [1557, 1617, 1491, 1422].map((d) => Math.round((d * RATE) / 44_100));
  const combsR = combsL.map((d) => d + 23);
  const process = (input, delays) => {
    const out = new Float32Array(input.length);
    for (const delay of delays) {
      const buffer = new Float32Array(delay);
      let index = 0;
      let damp = 0;
      for (let i = 0; i < input.length; i += 1) {
        const y = buffer[index];
        damp = y * 0.6 + damp * 0.4;
        buffer[index] = input[i] + damp * 0.8;
        out[i] += y;
        index = (index + 1) % delay;
      }
    }
    for (const delay of [556, 225].map((d) => Math.round((d * RATE) / 44_100))) {
      const buffer = new Float32Array(delay);
      let index = 0;
      for (let i = 0; i < out.length; i += 1) {
        const b = buffer[index];
        const y = -out[i] + b;
        buffer[index] = out[i] + b * 0.5;
        out[i] = y;
        index = (index + 1) % delay;
      }
    }
    return out;
  };
  const wl = process(L, combsL);
  const wr = process(R, combsR);
  for (let i = 0; i < L.length; i += 1) {
    L[i] += wl[i] * wet * 0.25;
    R[i] += wr[i] * wet * 0.25;
  }
}

function master(L, R) {
  let peak = 1e-9;
  for (let i = 0; i < L.length; i += 1) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = 0.9 / peak;
  for (let i = 0; i < L.length; i += 1) {
    L[i] = Math.tanh(L[i] * gain * 1.1) / Math.tanh(1.1);
    R[i] = Math.tanh(R[i] * gain * 1.1) / Math.tanh(1.1);
  }
}

function wav(L, R) {
  const frames = L.length;
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + frames * 4, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i += 1) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  return buffer;
}
