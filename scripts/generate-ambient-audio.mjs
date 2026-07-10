/**
 * Generates ambient loops for study sessions (no third-party assets).
 * Run: node scripts/generate-ambient-audio.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../apps/web/public/audio");

const sampleRate = 44100;
const durationSec = 30;

/** Simple deterministic pseudo-random for pink-ish noise. */
function pinkSample(t) {
  const white = Math.sin(t * 12.9898) * 43758.5453;
  return (white - Math.floor(white)) * 2 - 1;
}

function synthesizeVariant({ padFreqs, padGain, noiseGain, masterGain }) {
  const numSamples = sampleRate * durationSec;
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, t / 4);
    const fadeOut = Math.min(1, (durationSec - t) / 4);
    const envelope = fadeIn * fadeOut;

    let pad = 0;
    for (const [freq, gain] of padFreqs) {
      pad += Math.sin(2 * Math.PI * freq * t) * gain;
    }
    const noise = pinkSample(i * 0.001) * noiseGain;
    samples[i] = (pad + noise) * envelope * masterGain;
  }

  return samples;
}

function writeWav(filePath, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(filePath, buffer);
  console.log(`Wrote ${filePath} (${buffer.length} bytes)`);
}

const variants = [
  {
    file: "focus-ambient-soft.wav",
    padFreqs: [
      [174, 0.08],
      [261.63, 0.05],
      [349.23, 0.03],
    ],
    padGain: 1,
    noiseGain: 0.025,
    masterGain: 0.6,
  },
  {
    file: "focus-ambient-rain.wav",
    padFreqs: [
      [220, 0.02],
      [330, 0.015],
    ],
    padGain: 1,
    noiseGain: 0.055,
    masterGain: 0.45,
  },
  {
    file: "focus-ambient-warm.wav",
    padFreqs: [
      [130.81, 0.09],
      [196, 0.06],
      [261.63, 0.035],
    ],
    padGain: 1,
    noiseGain: 0.012,
    masterGain: 0.55,
  },
];

mkdirSync(outDir, { recursive: true });

for (const variant of variants) {
  const samples = synthesizeVariant(variant);
  writeWav(join(outDir, variant.file), samples);
}
