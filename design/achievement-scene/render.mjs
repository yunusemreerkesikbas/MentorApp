#!/usr/bin/env node
/**
 * Renders the "Işık Yandı" prototype frame by frame: seek → screenshot → ffmpeg, 60 times a
 * second, so the video is exactly what the timeline says (no dropped frames, no timer drift).
 *
 *   node design/achievement-scene/render.mjs [single|deck|reduced|all]
 *        [--frames=0.5,3.2]   capture individual 1080² PNGs instead of a video (QA)
 *        [--storyboard]       capture the key-frame grid
 *        [--scale=2]          capture density; frames are downsampled to 1080² (default 2)
 *        [--out=dir]          output folder (default design/achievement-scene/renders)
 *
 * Env: FFMPEG_PATH (an ffmpeg with libx264 + aac, default `ffmpeg`), PLAYWRIGHT_PATH (module
 * path when `playwright` cannot be resolved from here, e.g. a global install).
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { synthesize } from "./sfx.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FILE = { single: "tek", deck: "deste", reduced: "azaltilmis-hareket" };

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}`));
const value = (name, fallback) => flag(name)?.split("=")[1] ?? fallback;
const which = args.find((a) => !a.startsWith("--")) ?? "all";
const names = which === "all" ? Object.keys(FILE) : [which];
const scale = Number(value("scale", "2"));
const workers = Math.max(1, Number(value("workers", String(Math.min(4, availableParallelism())))));
const outDir = resolve(value("out", join(HERE, "renders")));
mkdirSync(outDir, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".css": "text/css",
  ".json": "application/json",
};

function serve() {
  return new Promise((ok) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      const file = resolve(join(ROOT, decodeURIComponent(url.pathname)));
      if (!file.startsWith(ROOT + sep) || !existsSync(file) || statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => ok(server));
  });
}

async function loadChromium() {
  for (const candidate of [process.env.PLAYWRIGHT_PATH, "playwright", "@playwright/test"]) {
    if (!candidate) continue;
    try {
      const mod = await import(candidate.startsWith("/") ? pathToFileURL(candidate).href : candidate);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      // try the next one
    }
  }
  throw new Error("Playwright is not resolvable. Install it or set PLAYWRIGHT_PATH.");
}

function run(cmd, cmdArgs) {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, cmdArgs, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("close", (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited with ${code}`))));
  });
}

async function openScene(browser, base, name, density) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: density });
  await page.goto(`${base}/design/achievement-scene/index.html?scenario=${name}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.scene?.ready === true, null, { timeout: 60_000 });
  // `document.fonts.check()` answers true for a family with no face at all, so look at the faces.
  const nunito = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.family.replaceAll('"', "") === "Nunito" && f.status === "loaded").length,
  );
  if (nunito < 2) throw new Error("Nunito did not load; refusing to render with a fallback face.");
  return page;
}

/**
 * Chromium rasterises a page on one core, so frames are shared out across `workers` browsers
 * (each with its own renderer and GPU process), written as high-quality JPEGs, then encoded once.
 */
async function renderVideo(page, name, chromium, base) {
  const { duration, fps, cues } = await page.evaluate(() => ({
    duration: window.scene.duration,
    fps: window.scene.fps,
    cues: window.scene.cues,
  }));
  const frames = Math.round(duration * fps);
  const dir = join(outDir, `.frames-${name}`);
  mkdirSync(dir, { recursive: true });
  const started = Date.now();
  let written = 0;

  async function worker(index) {
    const browser = await chromium.launch();
    try {
      const own = await openScene(browser, base, name, scale);
      for (let f = index; f < frames; f += workers) {
        await own.evaluate((t) => window.scene.seek(t), f / fps);
        await own.screenshot({ path: join(dir, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 95 });
        written += 1;
        if (written % 30 === 0) process.stdout.write(`\r${name}: ${written}/${frames} frames`);
      }
    } finally {
      await browser.close();
    }
  }
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
  process.stdout.write(`\r${name}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)} s\n`);

  const silent = join(outDir, `.${name}-silent.mp4`);
  await run(FFMPEG, [
    "-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "%05d.jpg"),
    "-vf", "scale=1080:1080:flags=lanczos",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-movflags", "+faststart", silent,
  ]);
  rmSync(dir, { recursive: true });

  const wav = join(outDir, `.${name}.wav`);
  writeFileSync(wav, synthesize(cues, duration));
  const out = join(outDir, `isik-yandi-${FILE[name]}.mp4`);
  await run(FFMPEG, [
    "-y", "-loglevel", "error", "-i", silent, "-i", wav,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out,
  ]);
  rmSync(silent);
  rmSync(wav);
  console.log(`→ ${out}`);
}

async function renderFrames(page, name, times) {
  const dir = join(outDir, "qa");
  mkdirSync(dir, { recursive: true });
  for (const t of times) {
    await page.evaluate((time) => window.scene.seek(time), t);
    const file = join(dir, `${name}-${t.toFixed(2)}.png`);
    await page.screenshot({ path: file, type: "png" });
    console.log(`→ ${file}`);
  }
}

async function renderStoryboard(page, name) {
  const frames = await page.evaluate(() => window.scene.keyFrames());
  const dir = join(outDir, `.sb-${name}`);
  mkdirSync(dir, { recursive: true });
  for (const [i, frame] of frames.entries()) {
    await page.evaluate(({ t, label, n }) => {
      window.scene.seek(t);
      window.scene.setLabel(`${n}. ${label}`, `${t.toFixed(2)} sn`);
    }, { t: frame.t, label: frame.label, n: i + 1 });
    await page.screenshot({ path: join(dir, `${String(i).padStart(2, "0")}.png`), type: "png" });
  }
  await page.evaluate(() => window.scene.setLabel(""));
  const columns = 4;
  const rows = Math.ceil(frames.length / columns);
  const out = join(outDir, `storyboard-${FILE[name]}.png`);
  await run(FFMPEG, [
    "-y", "-loglevel", "error", "-framerate", "1", "-i", join(dir, "%02d.png"),
    "-vf", `scale=540:540:flags=lanczos,tile=${columns}x${rows}:padding=6:color=white`,
    "-frames:v", "1", out,
  ]);
  rmSync(dir, { recursive: true });
  console.log(`→ ${out}`);
}

/**
 * `--remux`: rebuild only the sound of finished renders. The cue list is pure data, so no browser
 * is needed; the picture stream is copied untouched.
 */
if (flag("remux")) {
  const { SCENARIOS, cuesFor } = await import("./timeline.mjs");
  for (const name of names) {
    const video = join(outDir, `isik-yandi-${FILE[name]}.mp4`);
    const scenario = SCENARIOS[name];
    const wav = join(outDir, `.${name}.wav`);
    writeFileSync(wav, synthesize(cuesFor(scenario), scenario.duration));
    const temp = join(outDir, `.${name}-remux.mp4`);
    await run(FFMPEG, [
      "-y", "-loglevel", "error", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", temp,
    ]);
    renameSync(temp, video);
    rmSync(wav);
    console.log(`→ ${video} (sound rebuilt)`);
  }
  process.exit(0);
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const chromium = await loadChromium();
const browser = await chromium.launch();
try {
  for (const name of names) {
    const framesArg = value("frames", null);
    const density = framesArg || flag("storyboard") ? 1 : scale;
    const page = await openScene(browser, base, name, density);
    if (framesArg) await renderFrames(page, name, framesArg.split(",").map(Number));
    else if (flag("storyboard")) await renderStoryboard(page, name);
    else await renderVideo(page, name, chromium, base);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
