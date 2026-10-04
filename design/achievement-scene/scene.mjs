/**
 * "Işık Yandı": the achievement scene, as a seekable prototype.
 *
 *   dusk falls → the task's ✓ becomes a spark → it lands as an orb and gathers light →
 *   tap (or 1.5 s) → windup → burst → the badge is born, flips out of its Puhu-marked back →
 *   copy and ledge → "Devam edelim" → the badge flies home to the avatar.
 *
 * `window.scene.seek(T)` paints video time T from scratch. Nothing here keeps state between
 * frames, so frames can be rendered in any order.
 */
import {
  clamp,
  ease,
  keys,
  kick,
  lerp,
  progress,
  quadPoint,
  quadTangent,
  rgba,
  rng,
  spring,
} from "./engine.mjs";
import { CHOREO, COPY, FPS, LIGHT, SCENARIOS, SPRINGS, beatsFor, cuesFor } from "./timeline.mjs";
import { ASSET, buildPanel, centerOf, placeMenu, renderPanel } from "./panel.mjs";

const params = new URLSearchParams(location.search);
const NAME = SCENARIOS[params.get("scenario")] ? params.get("scenario") : "single";
const SCN = SCENARIOS[NAME];
const { ignite: IG, burst: B, copyBase: R, exit: EX } = beatsFor(SCN);
const S0 = SCN.sceneStart;
const REDUCED = Boolean(SCN.reduced);
const DECK = SCN.achievements.length > 1;

const W = 390;
const H = 844;
const C = { x: 195, y: DECK ? 292 : 318 };
const SIZE = DECK ? 132 : 236;
const LIGHTS = SCN.achievements.map((id) => LIGHT[id]);
const GLOW = LIGHTS[0].glow;
const ALT = LIGHTS[0].alt;
const WHITE = "#FFFFFF";
const WARM_WHITE = "#FFF6E3";
const AVATAR_SIZE = 44;

const $ = (id) => document.getElementById(id);
const screenEl = $("screen");
const appEl = $("app");
const duskEl = $("dusk");
const duskSheet = $("duskSheet");
const duskGlow = $("duskGlow");
const starsCv = $("stars");
const camEl = $("cam");
const haloEl = $("halo");
const backCv = $("fxBack");
const frontCv = $("fxFront");
const badgesEl = $("badges");
const copyEl = $("copy");
const ctaLayer = $("cta");
const flashEl = $("flash");
const statusEl = $("statusbar");
const touchEl = $("touch");
const homebar = $("homebar");

const SP = Object.fromEntries(Object.entries(SPRINGS).map(([k, v]) => [k, spring(v)]));
const KICK = {
  punch: kick(SPRINGS.punch),
  pulse: kick(SPRINGS.pulse),
  land: kick(SPRINGS.land),
};

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
for (const cv of [starsCv, backCv, frontCv]) {
  cv.width = W * DPR;
  cv.height = H * DPR;
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
}
const gStars = starsCv.getContext("2d");
const gBack = backCv.getContext("2d");
const gFront = frontCv.getContext("2d");

function begin(g) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
}

// ── Drawing primitives ─────────────────────────────────────────────────────

function glow(g, x, y, r, hex, a) {
  if (a <= 0.002 || r <= 0.2) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, rgba(hex, a));
  grad.addColorStop(0.32, rgba(hex, a * 0.5));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** Four-point sparkle, the reference's twinkle, drawn with concave sides. */
function sparkle(g, x, y, r, rot, hex, a) {
  if (a <= 0.002 || r <= 0.2) return;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = rgba(hex, a);
  g.beginPath();
  const inner = r * 0.14;
  for (let i = 0; i < 4; i += 1) {
    const a0 = (i / 4) * Math.PI * 2;
    const a1 = ((i + 0.5) / 4) * Math.PI * 2;
    const a2 = ((i + 1) / 4) * Math.PI * 2;
    if (i === 0) g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
    g.quadraticCurveTo(Math.cos(a1) * inner, Math.sin(a1) * inner, Math.cos(a2) * r, Math.sin(a2) * r);
  }
  g.closePath();
  g.fill();
  g.restore();
}

/** A diamond stretched along its velocity: fast light reads as a streak. */
function streak(g, x, y, vx, vy, len, width, hex, a) {
  if (a <= 0.002) return;
  const sp = Math.hypot(vx, vy) || 1;
  const ux = vx / sp;
  const uy = vy / sp;
  g.fillStyle = rgba(hex, a);
  g.beginPath();
  g.moveTo(x + ux * len * 0.5, y + uy * len * 0.5);
  g.lineTo(x - uy * width * 0.5, y + ux * width * 0.5);
  g.lineTo(x - ux * len * 0.5, y - uy * len * 0.5);
  g.lineTo(x + uy * width * 0.5, y - ux * width * 0.5);
  g.closePath();
  g.fill();
}

function ring(g, x, y, r, width, hex, a) {
  if (a <= 0.002 || r <= 0.2) return;
  g.strokeStyle = rgba(hex, a * 0.35);
  g.lineWidth = width * 2.6;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = rgba(hex, a);
  g.lineWidth = width;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
}

function drawRay(g, cx, cy, th, len, w, hex, a) {
  if (a <= 0.002) return;
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const px = -uy;
  const py = ux;
  const grad = g.createLinearGradient(cx, cy, cx + ux * len, cy + uy * len);
  grad.addColorStop(0, rgba(hex, a));
  grad.addColorStop(0.4, rgba(hex, a * 0.32));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx + px * 2, cy + py * 2);
  g.lineTo(cx + ux * len + (px * w) / 2, cy + uy * len + (py * w) / 2);
  g.lineTo(cx + ux * len - (px * w) / 2, cy + uy * len - (py * w) / 2);
  g.lineTo(cx - px * 2, cy - py * 2);
  g.closePath();
  g.fill();
}

function ellipsePoint(cx, cy, rx, ry, tilt, a) {
  const ex = Math.cos(a) * rx;
  const ey = Math.sin(a) * ry;
  return {
    x: cx + ex * Math.cos(tilt) - ey * Math.sin(tilt),
    y: cy + ex * Math.sin(tilt) + ey * Math.cos(tilt),
  };
}

/**
 * The reference's swoosh: a comet ribbon on a tilted ring around the badge, thick at the head,
 * hairline at the tail. The half nearer the viewer is drawn in front of the badge, the far half
 * behind it, which is what makes it read as wrapping around.
 */
function swoosh(cx, cy, rx, ry, tilt, head, length, width, hex, alpha) {
  if (alpha <= 0.002 || length <= 0.01) return;
  const N = 56;
  for (let k = 0; k < N; k += 1) {
    const f0 = k / N;
    const f1 = (k + 1) / N;
    const a0 = head + length * f0;
    const a1 = head + length * f1;
    const p0 = ellipsePoint(cx, cy, rx, ry, tilt, a0);
    const p1 = ellipsePoint(cx, cy, rx, ry, tilt, a1);
    const g = Math.sin((a0 + a1) / 2) > 0 ? gFront : gBack;
    const fade = (1 - f0) ** 1.5;
    const w = 0.5 + width * (1 - f0) ** 0.85;
    g.lineCap = "round";
    g.strokeStyle = rgba(hex, alpha * fade * 0.42);
    g.lineWidth = w * 2.6;
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.stroke();
    g.strokeStyle = rgba(WHITE, alpha * fade);
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.stroke();
  }
}

/** The badge's own silhouette (BADGE_EFFECT_CLIP_PATH in the app). */
const PENTAGON = [
  [0.5, 0.02],
  [0.96, 0.36],
  [0.82, 0.94],
  [0.18, 0.94],
  [0.04, 0.36],
];

function pentagonOutline(g, cx, cy, size, drawn, hex, alpha, width) {
  if (alpha <= 0.002 || drawn <= 0) return null;
  const pts = PENTAGON.map(([u, v]) => ({ x: cx + (u - 0.5) * size, y: cy + (v - 0.5) * size }));
  const segs = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  const lens = segs.map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
  let remaining = lens.reduce((s, l) => s + l, 0) * drawn;
  g.strokeStyle = rgba(hex, alpha);
  g.lineWidth = width;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  let head = pts[0];
  for (let i = 0; i < segs.length && remaining > 0; i += 1) {
    const [a, b] = segs[i];
    const f = Math.min(1, remaining / lens[i]);
    head = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    g.lineTo(head.x, head.y);
    remaining -= lens[i];
  }
  g.stroke();
  return head;
}

// ── Seeded casts ───────────────────────────────────────────────────────────

const STARS = (() => {
  const r = rng(7);
  return Array.from({ length: 120 }, (_, i) => {
    const layer = i < 76 ? 0 : i < 108 ? 1 : 2;
    return {
      x: r() * W,
      y: 40 + r() * (H - 120),
      size: [0.7, 1.1, 1.6][layer] * (0.75 + r() * 0.5),
      a: [0.42, 0.62, 0.85][layer] * (0.6 + r() * 0.4),
      f: 0.3 + r() * 0.9,
      ph: r(),
      layer,
    };
  });
})();

const MOTES = (() => {
  const r = rng(11);
  return Array.from({ length: 26 }, (_, i) => ({
    th0: r() * Math.PI * 2,
    rStart: 240 + r() * 150,
    rOrbit: 70 + r() * 62,
    w: 1.5 + r() * 1.3,
    size: 1.1 + r() * 1.7,
    a: 0.55 + r() * 0.45,
    delay: i * 0.02,
    tone: r(),
  }));
})();

const BURST = (() => {
  const r = rng(23);
  return Array.from({ length: 46 }, (_, i) => {
    const type = i % 3 === 0 ? "streak" : i % 3 === 1 ? "sparkle" : "dot";
    const fast = type === "streak";
    return {
      type,
      ang: r() * Math.PI * 2,
      sp: (fast ? 420 : 170) + r() * (fast ? 360 : 300),
      k: 2.1 + r() * 1.7,
      g: type === "dot" ? 80 : 26,
      life: fast ? 0.5 + r() * 0.35 : 0.95 + r() * 0.8,
      size: type === "sparkle" ? 5 + r() * 9 : fast ? 12 + r() * 16 : 1.6 + r() * 2.4,
      front: i % 2 === 0,
      light: i % LIGHTS.length,
      warm: r() < 0.6,
      rot: r() * Math.PI,
      spin: (r() - 0.5) * 7,
      delay: r() * 0.05,
      ph: r() * 6,
    };
  });
})();

const RAYS = (() => {
  const r = rng(31);
  return Array.from({ length: 12 }, (_, i) => ({
    th: (i / 12) * Math.PI * 2 + (r() - 0.5) * 0.3,
    len: 380 + r() * 230,
    w: 30 + r() * 64,
    a: 0.32 + r() * 0.42,
  }));
})();

const TRAIL = (() => {
  const r = rng(41);
  return Array.from({ length: 22 }, (_, j) => ({
    at: j / 22,
    dx: (r() - 0.5) * 22,
    dy: (r() - 0.5) * 22,
    size: 2.5 + r() * 4.5,
    rot: r() * Math.PI,
    sparkle: r() < 0.55,
  }));
})();

const ARRIVAL = (() => {
  const r = rng(53);
  return Array.from({ length: 9 }, (_, i) => ({
    ang: (i / 9) * Math.PI * 2 + r() * 0.4,
    sp: 110 + r() * 110,
    size: 3 + r() * 4,
    rot: r() * Math.PI,
  }));
})();

// ── DOM build ─────────────────────────────────────────────────────────────

const panel = buildPanel(appEl, SCN);
const appDim = document.createElement("div");
appDim.id = "appDim";
appEl.appendChild(appDim);
$("caption").textContent = SCN.label;

function maskStyle(url, size = "100% 100%", position = "center") {
  return `-webkit-mask-image:url(${url});mask-image:url(${url});-webkit-mask-size:${size};mask-size:${size};-webkit-mask-position:${position};mask-position:${position}`;
}

/**
 * Puhu's mark, engraved into the gold silhouette on the card back: the round glasses, the eyes
 * and the chest heart, measured from motion/rest.png (256-unit space) so they sit exactly on the
 * silhouette the mask draws (50 % wide, anchored at 50 % / 60 %).
 */
const MARK_INK = "#22337C";
const PUHU_MARK = `
  <svg viewBox="0 0 256 256" aria-hidden="true" style="position:absolute;left:25%;top:30%;width:50%;height:50%;overflow:visible">
    <g fill="${rgba(MARK_INK, 0.16)}" stroke="${MARK_INK}" stroke-width="7">
      <circle cx="93.5" cy="107" r="27" />
      <circle cx="161.5" cy="107.5" r="27" />
    </g>
    <path d="M120.5 103.5 Q128 97 135 103.5" fill="none" stroke="${MARK_INK}" stroke-width="6" stroke-linecap="round" />
    <circle cx="98" cy="110" r="8.5" fill="${MARK_INK}" />
    <circle cx="157" cy="110.5" r="8.5" fill="${MARK_INK}" />
    <path d="M127.5 121 l-5.5 7.5 h11 z" fill="${rgba(MARK_INK, 0.55)}" />
    <path d="M145.5 171 c-9.5 -6 -13 -10.5 -13 -15 a6.4 6.4 0 0 1 13 -2 a6.4 6.4 0 0 1 13 2 c0 4.5 -3.5 9 -13 15z" fill="${MARK_INK}" />
  </svg>`;

function makeBadge(id, size) {
  const art = `${ASSET}/achievements/puhu/${id}.webp`;
  const puhu = `${ASSET}/mascot/puhu/motion/rest.png`;
  const root = document.createElement("div");
  root.className = "badge";
  root.style.width = `${size}px`;
  root.style.height = `${size}px`;
  root.innerHTML = `
    <div class="badge-tf">
      <div class="badge-persp">
        <div class="badge-rot">
          <div class="face back">
            <div class="masked back-rim" style="${maskStyle(art)}"></div>
            <div class="masked back-border" style="${maskStyle(art, "90% 90%")}"></div>
            <div class="masked back-inner" style="${maskStyle(art, "86% 86%")}"></div>
            <div class="masked back-pattern" style="${maskStyle(art, "86% 86%")}"></div>
            <div class="back-puhu-glow">
              <div class="masked back-puhu" style="${maskStyle(puhu, "50% auto", "50% 60%")}"></div>
              ${PUHU_MARK}
            </div>
            <div class="masked" style="${maskStyle(art)}"><div class="sheen"></div></div>
          </div>
          <div class="face front">
            <img src="${art}" alt="" />
            <div class="masked" style="${maskStyle(art)};overflow:hidden"><div class="glint-band"></div><div class="glint-band"></div><div class="glint-band"></div></div>
            <div class="masked" style="${maskStyle(art)}"><div class="sheen"></div></div>
          </div>
          <div class="edge"></div>
        </div>
      </div>
    </div>`;
  badgesEl.appendChild(root);
  const q = (sel) => root.querySelectorAll(sel);
  return {
    id,
    size,
    root,
    tf: root.querySelector(".badge-tf"),
    rot: root.querySelector(".badge-rot"),
    faces: q(".face"),
    back: root.querySelector(".face.back"),
    front: root.querySelector(".face.front"),
    sheens: q(".sheen"),
    glints: q(".glint-band"),
    puhuGlow: root.querySelector(".back-puhu-glow"),
    edge: root.querySelector(".edge"),
  };
}

const BADGES = SCN.achievements.map((id) => makeBadge(id, SIZE));
const LABELS = DECK
  ? SCN.achievements.map((id) => {
      const label = document.createElement("div");
      label.className = "badge-label";
      label.style.top = "0px";
      label.style.left = "0px";
      label.style.marginTop = "0px";
      label.style.marginLeft = "0px";
      label.textContent = COPY.items[id].title;
      badgesEl.appendChild(label);
      return label;
    })
  : [];

const item = DECK ? null : COPY.items[SCN.achievements[0]];
const TEXT = {
  eyebrow: DECK ? COPY.history.eyebrow : COPY.eyebrow,
  title: DECK ? COPY.history.title : item.title,
  body: DECK ? COPY.history.body(SCN.achievements.length) : item.body,
};
const LAYOUT = DECK
  ? { hint: 410, eyebrow: 444, title: 466, body: 546, cta: 732 }
  : { hint: 446, eyebrow: 476, title: 498, body: 542, cta: 732 };
copyEl.innerHTML = `
  <div class="hint" id="cHint" style="top:${LAYOUT.hint}px">${COPY.hint}</div>
  <div class="eyebrow" id="cEyebrow" style="top:${LAYOUT.eyebrow}px">${TEXT.eyebrow}</div>
  <div class="title" id="cTitle" style="top:${LAYOUT.title}px">${TEXT.title
    .split(" ")
    .map((w) => `<span class="w">${w}</span>`)
    .join(" ")}</div>
  <div class="body" id="cBody" style="top:${LAYOUT.body}px">${TEXT.body}</div>`;
ctaLayer.innerHTML = `<div class="cta-ledge" id="cCta" style="top:${LAYOUT.cta}px">${COPY.cta}</div>`;
const hintEl = $("cHint");
const eyebrowEl = $("cEyebrow");
const titleWords = [...$("cTitle").querySelectorAll(".w")];
const bodyEl = $("cBody");
const ctaEl = $("cCta");

camEl.style.transformOrigin = `${C.x}px ${C.y}px`;
haloEl.style.left = `${C.x - 280}px`;
haloEl.style.top = `${C.y - 280}px`;
const haloA = LIGHTS[0].glow;
const haloB = LIGHTS[LIGHTS.length - 1].alt;
haloEl.style.background = `radial-gradient(circle, ${rgba(haloA, 0.6)} 0%, ${rgba(haloA, 0.24)} 26%, ${rgba(
  haloB,
  0.1,
)} 48%, ${rgba(haloB, 0)} 68%)`;
flashEl.style.background = `radial-gradient(circle at ${C.x}px ${C.y}px, rgba(255,252,242,1) 0%, ${rgba(
  WARM_WHITE,
  0.92,
)} 14%, ${rgba(GLOW, 0.62)} 34%, ${rgba(GLOW, 0.22)} 58%, ${rgba(GLOW, 0)} 82%)`;

// Measured once layout and fonts are final (see init()).
const GEO = { origin: { x: 195, y: 790 }, avatar: { x: 42, y: 76 }, menuItem: null, cta: null };

// ── Frame ──────────────────────────────────────────────────────────────────

/** How much of screen row `y` the night curtain covers (matches #duskSheet's gradient). */
function coverage(y, sheetTop) {
  const solid = sheetTop + H;
  if (y <= solid) return 1;
  const fade = (y - solid) / (0.6 * H);
  return clamp(1 - fade ** 0.8);
}

function render(T) {
  const s = T - S0;
  // The panel only changes under the curtain when the film showed the task being done.
  const afterAt = SCN.context ? S0 + (REDUCED ? 0.25 : 0.7) : Infinity;
  renderPanel(T, panel, SCN, afterAt);
  begin(gStars);
  begin(gBack);
  begin(gFront);
  if (REDUCED) renderReduced(s);
  else renderFull(s);
  renderTouches(T, s);
}

function renderFull(s) {
  // Dusk: the curtain wipes down; on exit it lifts the same way it came.
  const duskP = ease.inOutCubic(progress(s, CHOREO.dusk.start, CHOREO.dusk.duration));
  const liftP = ease.inOutCubic(progress(s, EX + CHOREO.exit.curtainLift, CHOREO.exit.curtainDuration));
  const sheetShift = -(1 - duskP) - liftP; // in sheet heights (sheet = 1.6 H)
  duskSheet.style.transform = `translateY(${sheetShift * 100}%)`;
  const sheetTop = sheetShift * 1.6 * H;
  const night = clamp(duskP - liftP);
  duskGlow.style.opacity = String(night);

  // The page steps back while the night is up.
  const appBack = duskP * (1 - ease.outQuint(progress(s, EX + 0.3, 0.6)));
  appEl.style.transform = `scale(${1 - 0.06 * appBack})`;
  appEl.style.borderRadius = `${40 * appBack}px`;
  appDim.style.opacity = String(0.18 * appBack);

  // Status bar and home indicator follow what is under them.
  const lightPanel = SCN.theme === "light";
  const topCover = coverage(22, sheetTop);
  const ink = lightPanel ? mixInk(topCover) : "#F4F4F5";
  statusEl.innerHTML = statusMarkup(ink);
  homebar.style.background = lightPanel ? mixInk(coverage(830, sheetTop)) : "#F4F4F5";

  // Camera: a slow push while the light gathers, a punch on the burst.
  const push = 0.04 * ease.inOutSine(progress(s, CHOREO.orbReady, IG - CHOREO.orbReady)) * (1 - ease.outCubic(progress(s, B, 0.5)));
  const punch = 0.035 * KICK.punch(s - B);
  const camScale = 1 + push + punch;
  camEl.style.transform = `scale(${camScale})`;

  drawStars(s, sheetTop, night, camScale);

  // Halo: the light that stays on after the burst.
  const haloOpacity =
    (s < B ? 0.2 * duskP : keys(s, [[B, 0.2], [B + 0.25, 0.95, ease.outQuad], [B + 1.6, 0.6, ease.inOutSine]])) *
    (1 - liftP);
  haloEl.style.opacity = String(haloOpacity);
  haloEl.style.transform = `scale(${0.85 + 0.15 * ease.outCubic(progress(s, B, 0.6))})`;

  drawSpark(s);
  drawOrbAndMotes(s);
  drawIgnite(s, liftP);
  drawBadges(s);
  drawCopy(s);
  drawExit(s);

  // Flash: the light comes on across the whole screen, then settles back into the halo.
  const flash = keys(s, [
    [B, 0],
    [B + 0.05, 0.92, ease.outQuad],
    [B + 0.3, 0.3, ease.outQuad],
    [B + 1.05, 0, ease.outQuad],
  ]);
  flashEl.style.opacity = String(s >= B ? flash : 0);
}

const mixInk = (cover) => {
  const v = Math.round(lerp(17, 255, clamp(cover)));
  return `rgb(${v}, ${v}, ${v})`;
};

let lastStatusInk = "";
let lastStatusHtml = "";
function statusMarkup(ink) {
  if (ink === lastStatusInk) return lastStatusHtml;
  lastStatusInk = ink;
  lastStatusHtml = STATUS(ink);
  return lastStatusHtml;
}
const STATUS = (ink) => `
  <span style="color:${ink}">9:41</span>
  <span class="icons" style="color:${ink}">
    <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.5 10.5 0 0 0 8 .3 10.5 10.5 0 0 0 .5 3.4l1.3 1.3A8.7 8.7 0 0 1 8 2.2zm0 3.6c1.4 0 2.7.5 3.7 1.5L13 6a7.2 7.2 0 0 0-10 0l1.3 1.3c1-1 2.3-1.5 3.7-1.5zm0 3.5c-.6 0-1.1.2-1.5.6L8 11.4l1.5-1.5c-.4-.4-.9-.6-1.5-.6z"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="currentColor" opacity="0.4"/></svg>
  </span>`;

function drawStars(s, sheetTop, night, camScale) {
  if (night <= 0.002) return;
  for (const st of STARS) {
    const depth = [0.25, 0.55, 1][st.layer];
    const k = 1 + (camScale - 1) * depth * 1.6;
    const x = C.x + (st.x - C.x) * k;
    const y = C.y + (st.y - C.y) * k + s * 2.5 * depth;
    const twinkle = 0.62 + 0.38 * Math.sin(Math.PI * 2 * (st.f * s + st.ph));
    const a = st.a * twinkle * coverage(st.y, sheetTop) * night;
    if (a <= 0.01) continue;
    if (st.layer === 2) {
      glow(gStars, x, y, st.size * 5, "#CFE0FF", a * 0.35);
      sparkle(gStars, x, y, st.size * 2.6, 0, WHITE, a);
    } else {
      gStars.fillStyle = rgba(st.layer ? "#EAF1FF" : "#C9D6FF", a);
      gStars.beginPath();
      gStars.arc(x, y, st.size * 0.6, 0, Math.PI * 2);
      gStars.fill();
    }
  }
}

// ── Spark → orb → motes ───────────────────────────────────────────────────

function sparkPath() {
  const o = GEO.origin;
  const control = {
    x: (o.x + C.x) / 2 + (o.x <= C.x ? -70 : 70),
    y: Math.min(o.y, C.y) - 150,
  };
  return [o, control, C];
}

function drawSpark(s) {
  const { launch, land } = CHOREO.spark;
  const o = GEO.origin;
  // The ✓ gathers a glow before it lets go.
  if (s >= 0 && s < launch + 0.12) {
    const charge = ease.outCubic(progress(s, 0, launch));
    glow(gFront, o.x, o.y, 8 + 26 * charge, GLOW, 0.75 * charge * (1 - progress(s, launch, 0.12)));
  }
  if (s >= launch && s < launch + 0.4) {
    const p = ease.outCubic(progress(s, launch, 0.38));
    ring(gFront, o.x, o.y, 8 + 30 * p, 2 * (1 - p) + 0.4, WARM_WHITE, 0.8 * (1 - p));
  }
  if (s < launch || s >= land) return;
  const [p0, p1, p2] = sparkPath();
  const dur = land - launch;
  const at = (time) => ease.launch(progress(time, launch, dur));
  const p = at(s);
  const pos = quadPoint(p0, p1, p2, p);
  const dp = (at(s + 0.004) - at(s - 0.004)) / 0.008;
  const tan = quadTangent(p0, p1, p2, p);
  const vx = tan.x * dp;
  const vy = tan.y * dp;
  const speed = Math.hypot(vx, vy);

  gFront.globalCompositeOperation = "lighter";
  for (let k = 14; k >= 1; k -= 1) {
    const tt = s - k * 0.011;
    if (tt < launch) continue;
    const q = quadPoint(p0, p1, p2, at(tt));
    const f = 1 - k / 15;
    glow(gFront, q.x, q.y, 3 + 9 * f, GLOW, 0.5 * f);
  }
  glow(gFront, pos.x, pos.y, 30, GLOW, 0.75);
  const stretch = clamp(speed / 1500, 0, 1.1);
  gFront.save();
  gFront.translate(pos.x, pos.y);
  gFront.rotate(Math.atan2(vy, vx));
  gFront.scale(1 + stretch * 1.6, 1 / (1 + stretch * 0.45));
  glow(gFront, 0, 0, 9, WHITE, 1);
  gFront.fillStyle = WHITE;
  gFront.beginPath();
  gFront.arc(0, 0, 3.2, 0, Math.PI * 2);
  gFront.fill();
  gFront.restore();
  gFront.globalCompositeOperation = "source-over";
}

function drawOrbAndMotes(s) {
  const { land } = CHOREO.spark;
  if (s < land || s >= B + 0.02) {
    hintEl.style.opacity = "0";
    return;
  }
  const t = s - land;
  // Landing squash, then the wobble settles into a round orb.
  const squash = SP.orbLand.x(t);
  let sx = 1 + 0.55 * squash;
  let sy = 1 - 0.42 * squash;
  const grow = SP.badge.value(t);
  const breathe =
    s > CHOREO.hintAt ? 1 + 0.09 * Math.sin(((s - CHOREO.hintAt) / 0.82) * Math.PI * 2) : 1;
  const wind = ease.inCubic(progress(s, IG, CHOREO.windup));
  sx *= 1 + 0.3 * wind;
  sy *= 1 - 0.34 * wind;
  const waitHeat = progress(s, CHOREO.orbReady, IG - CHOREO.orbReady);
  const core = (4 + 12 * grow) * breathe;
  const halo = (20 + 64 * ease.outCubic(clamp(t / 0.5))) * breathe * (1 - 0.22 * wind);

  // The badge-to-be: its outline draws itself around the gathering light.
  const outline = ease.outQuint(progress(s, 0.85, 0.95));
  const head = pentagonOutline(gBack, C.x, C.y, SIZE, outline, "#FFE2AA", 0.5 * (1 - wind * 0.4), 1.6);
  if (head && outline < 1) glow(gBack, head.x, head.y, 10, GLOW, 0.9);

  // Motes spiral in on a tilted ring: the far half behind the orb, the near half in front.
  for (const m of MOTES) {
    const pos = motePosition(m, s);
    if (!pos) continue;
    const g = pos.z > 0 ? gFront : gBack;
    const depth = (pos.z + 1) / 2;
    const tone = m.tone < 0.55 ? GLOW : m.tone < 0.85 ? ALT : WHITE;
    g.globalCompositeOperation = "lighter";
    for (let k = 1; k <= 3; k += 1) {
      const prev = motePosition(m, s - k * 0.018);
      if (prev) glow(g, prev.x, prev.y, m.size * 2.2, tone, pos.alpha * 0.22 * (1 - k / 4));
    }
    glow(g, pos.x, pos.y, m.size * (4 + 2 * depth), tone, pos.alpha * (0.4 + 0.35 * depth));
    g.fillStyle = rgba(WHITE, pos.alpha * (0.6 + 0.4 * depth));
    g.beginPath();
    g.arc(pos.x, pos.y, m.size * (0.7 + 0.4 * depth), 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  }

  // Tap affordance: soft rings breathe out of the orb while it waits.
  if (s > CHOREO.hintAt && s < IG) {
    for (let k = 0; k < 3; k += 1) {
      const start = CHOREO.hintAt + 0.1 + k * 0.82;
      const p = progress(s, start, 0.82);
      if (p <= 0 || p >= 1 || start > IG) continue;
      ring(gFront, C.x, C.y, 30 + 46 * ease.outCubic(p), 1.4, WARM_WHITE, 0.42 * (1 - p));
    }
  }

  // The orb itself.
  gFront.save();
  gFront.translate(C.x, C.y);
  gFront.scale(sx, sy);
  gFront.globalCompositeOperation = "lighter";
  glow(gFront, 0, 0, halo, GLOW, 0.45 + 0.35 * waitHeat + 0.2 * wind);
  glow(gFront, 0, 0, core * 2.6, WARM_WHITE, 0.85);
  gFront.globalCompositeOperation = "source-over";
  gFront.fillStyle = WHITE;
  gFront.beginPath();
  gFront.arc(0, 0, core * 0.62, 0, Math.PI * 2);
  gFront.fill();
  gFront.restore();

  // "Dokun, ışığı yak"
  const hintIn = SP.hint.value(s - CHOREO.hintAt);
  const hintOut = ease.inQuad(progress(s, IG, 0.12));
  hintEl.style.opacity = String(s < CHOREO.hintAt ? 0 : clamp(progress(s, CHOREO.hintAt, 0.16) - hintOut));
  hintEl.style.transform = `translateY(${(1 - hintIn) * 10}px) scale(${(0.6 + 0.4 * hintIn) * (1 - 0.08 * hintOut)})`;
}

function motePosition(m, s) {
  const t = s - (CHOREO.orbReady + m.delay);
  if (t < 0 || s >= B) return null;
  const arrive = ease.outCubic(clamp(t / 0.62));
  const tighten = ease.inOutSine(progress(s, CHOREO.orbReady, Math.max(0.01, IG - CHOREO.orbReady)));
  const wind = ease.inCubic(progress(s, IG, CHOREO.windup));
  let r = lerp(m.rStart, m.rOrbit * (1 - 0.3 * tighten), arrive);
  r = lerp(r, 4, wind);
  const th = m.th0 + m.w * t + wind * 2.4;
  const flatten = lerp(0.9, 0.38, arrive);
  const ex = Math.cos(th) * r;
  const ey = Math.sin(th) * r * flatten;
  const tilt = -0.2;
  return {
    x: C.x + ex * Math.cos(tilt) - ey * Math.sin(tilt),
    y: C.y + ex * Math.sin(tilt) + ey * Math.cos(tilt),
    z: Math.sin(th),
    alpha: m.a * clamp(t / 0.22),
  };
}

// ── Burst ──────────────────────────────────────────────────────────────────

function drawIgnite(s, liftP) {
  if (s < B) return;
  const age = s - B;

  // The outline the light drew is thrown outward with the shockwave.
  if (age < 0.45) {
    const p = ease.outCubic(age / 0.45);
    pentagonOutline(gBack, C.x, C.y, SIZE * (1 + 0.45 * p), 1, "#FFE2AA", 0.5 * (1 - p), 1.6 + 2 * (1 - p));
  }

  gBack.globalCompositeOperation = "lighter";
  const rays = keys(s, [
    [B, 0],
    [B + 0.22, 1, ease.outQuad],
    [B + 1.5, 0.58, ease.inOutSine],
    [B + 3.3, 0, ease.inQuad],
  ]) * (1 - liftP);
  for (const ray of RAYS) {
    drawRay(gBack, C.x, C.y, ray.th + 0.15 * age, ray.len, ray.w, GLOW, ray.a * rays * 0.7);
  }
  gBack.globalCompositeOperation = "source-over";

  const w1 = ease.outExpo(clamp(age / 0.7));
  ring(gBack, C.x, C.y, 26 + 320 * w1, 10 * (1 - w1) + 0.6, WARM_WHITE, 0.9 * (1 - w1) ** 1.2);
  const w2 = ease.outExpo(clamp((age - 0.08) / 0.8));
  if (age > 0.08) ring(gBack, C.x, C.y, 14 + 230 * w2, 6 * (1 - w2) + 0.5, GLOW, 0.65 * (1 - w2));

  for (const pt of BURST) {
    const a = age - pt.delay;
    if (a <= 0 || a >= pt.life) continue;
    const decay = Math.exp(-pt.k * a);
    const travel = (1 - decay) / pt.k;
    const x = C.x + Math.cos(pt.ang) * pt.sp * travel;
    const y = C.y + Math.sin(pt.ang) * pt.sp * travel + 0.5 * pt.g * a * a;
    const vx = Math.cos(pt.ang) * pt.sp * decay;
    const vy = Math.sin(pt.ang) * pt.sp * decay + pt.g * a;
    const lifeLeft = 1 - a / pt.life;
    const g = pt.front ? gFront : gBack;
    const light = LIGHTS[pt.light];
    const hue = pt.warm ? light.glow : light.alt;
    g.globalCompositeOperation = "lighter";
    if (pt.type === "streak") {
      const len = pt.size * (0.6 + Math.hypot(vx, vy) / 500);
      streak(g, x, y, vx, vy, len, 2.6, WHITE, lifeLeft ** 1.3);
      glow(g, x, y, 10, hue, 0.35 * lifeLeft);
    } else if (pt.type === "sparkle") {
      const flicker = 0.72 + 0.28 * Math.sin(a * 28 + pt.ph);
      glow(g, x, y, pt.size * 2.2, hue, 0.35 * lifeLeft * flicker);
      sparkle(g, x, y, pt.size * (0.55 + 0.45 * lifeLeft), pt.rot + pt.spin * a, WHITE, lifeLeft ** 1.2 * flicker);
    } else {
      glow(g, x, y, pt.size * 4, hue, 0.8 * lifeLeft ** 1.5);
    }
    g.globalCompositeOperation = "source-over";
  }
}

// ── Badges ────────────────────────────────────────────────────────────────

/** Rotation (deg) of a flip that winds up at `start`. */
function flipAngle(s, start) {
  if (s < start) return 0;
  if (s < start + CHOREO.flipWindup) return -14 * ease.outQuad(progress(s, start, CHOREO.flipWindup));
  return -14 + 194 * SP.flip.value(s - start - CHOREO.flipWindup);
}

function faceLight(badge, theta, glowBoost) {
  const rad = (theta * Math.PI) / 180;
  const edgeOn = clamp((Math.abs(Math.sin(rad)) - 0.3) / 0.7);
  const shade = 0.7 + 0.3 * Math.abs(Math.cos(rad));
  for (const face of badge.faces) face.style.filter = `brightness(${shade + edgeOn * 0.35})`;
  // The rim plane is a hairline when seen face-on; it only exists while the card is turned.
  badge.edge.style.opacity = String(clamp((Math.abs(Math.sin(rad)) - 0.12) / 0.25));
  // A specular band that travels with the turn.
  const sweep = ((((theta % 360) + 360) % 360) / 180) * 140 - 70;
  for (const sheen of badge.sheens) {
    sheen.style.opacity = String(edgeOn * 0.8);
    sheen.style.transform = `translateX(${sweep}%)`;
  }
  badge.puhuGlow.style.filter = `drop-shadow(0 0 ${6 + 12 * glowBoost}px ${rgba(LIGHT[badge.id].glow, 0.55 + 0.4 * glowBoost)})`;
}

function glints(badge, s, start) {
  const sweeps = [
    { delay: 0.5, duration: 0.82, peak: 0.85 },
    { delay: 1.14, duration: 0.58, peak: 0.42 },
    // A last, softer pass while the student reads: the badge stays alive without looping.
    { delay: 2.5, duration: 0.95, peak: 0.3 },
  ];
  sweeps.forEach((sw, i) => {
    const p = progress(s, start + sw.delay, sw.duration);
    const band = badge.glints[i];
    band.style.left = `${-40 + 175 * ease.outExpo(p)}%`;
    band.style.opacity = String(p <= 0 || p >= 1 ? 0 : sw.peak * Math.sin(Math.PI * p));
  });
}

function edgeFlash(cx, cy, theta, size) {
  const a = clamp(1 - Math.abs(theta - 90) / 24);
  if (a <= 0.01) return;
  gFront.globalCompositeOperation = "lighter";
  gFront.save();
  gFront.translate(cx, cy);
  gFront.scale(0.16, 1);
  glow(gFront, 0, 0, size * 0.62, WARM_WHITE, 0.95 * a);
  gFront.restore();
  sparkle(gFront, cx, cy - size * 0.36, 10 * a, 0, WHITE, a);
  gFront.globalCompositeOperation = "source-over";
}

/** One badge's transform for the single film (birth → flip → land). */
function singlePose(s) {
  const birth = B + CHOREO.birth;
  const t = s - birth;
  const flipStart = B + CHOREO.flip;
  const theta = flipAngle(s, flipStart);
  const landT = s - (flipStart + CHOREO.flipWindup + 0.16);
  const land = KICK.land(landT);
  return {
    x: C.x,
    y: C.y + 60 * (1 - SP.badgeRise.value(t)),
    sx: (0.15 + 0.85 * SP.badge.value(t)) * (1 + 0.08 * land),
    sy: (0.15 + 0.85 * SP.badgeLag.value(t - 0.035)) * (1 - 0.1 * land),
    rz: -18 * (1 - SP.badgeTilt.value(t)),
    theta,
    opacity: progress(s, birth, 0.1),
    flipStart,
  };
}

const FAN = [
  { dx: -116, dy: 18, rz: -11, scale: 0.92 },
  { dx: 116, dy: 18, rz: 11, scale: 0.92 },
  { dx: 0, dy: -10, rz: 0, scale: 1.1 },
];
const STACK = [
  { dx: 0, dy: 0, rz: 0 },
  { dx: 6, dy: 7, rz: 5 },
  { dx: -6, dy: 12, rz: -6 },
];

/** Card i of the backfill deck: born stacked, flipped in turn, tossed into a fan. */
function deckPose(s, i) {
  const birth = B + CHOREO.birth + i * 0.04;
  const t = s - birth;
  const stack = STACK[i];
  const fan = FAN[i];
  const flipStart = B + CHOREO.deck.flip + i * CHOREO.deck.step;
  const toss = flipStart + CHOREO.deck.toss;
  const theta = flipAngle(s, flipStart);
  const land = KICK.land(s - (flipStart + CHOREO.flipWindup + 0.16));
  const p = SP.toss.value(s - toss);
  const arc = ease.outCubic(progress(s, toss, 0.5));
  const flick = Math.sin(Math.PI * arc) * (i === 2 ? 0 : 1);
  const born = 0.15 + 0.85 * SP.badge.value(t);
  return {
    x: C.x + lerp(stack.dx, fan.dx, p),
    y: C.y + lerp(stack.dy, fan.dy, p) + 60 * (1 - SP.badgeRise.value(t)) - 40 * flick,
    sx: born * lerp(1, fan.scale, p) * (1 + 0.08 * land),
    sy: (0.15 + 0.85 * SP.badgeLag.value(t - 0.035)) * lerp(1, fan.scale, p) * (1 - 0.1 * land),
    rz: lerp(stack.rz - 18 * (1 - SP.badgeTilt.value(t)), fan.rz, p) + (i === 0 ? -26 : 26) * flick,
    theta,
    opacity: progress(s, birth, 0.1),
    flipStart,
    tossed: s >= toss,
    settle: progress(s, toss + 0.25, 0.3),
  };
}

function exitPose(pose, s, i) {
  const start = EX + CHOREO.exit.launch + i * CHOREO.exit.deckStagger;
  const windStart = EX + CHOREO.exit.windup + i * CHOREO.exit.deckStagger;
  const wind = ease.outQuad(progress(s, windStart, 0.12));
  if (s < windStart) return pose;
  const out = { ...pose, sx: pose.sx * (1 + 0.1 * wind), sy: pose.sy * (1 - 0.14 * wind), rz: pose.rz + 6 * wind };
  if (s < start) return out;
  const flight = CHOREO.exit.flight;
  const at = (time) => ease.dive(progress(time, start, flight));
  const p = at(s);
  const from = { x: pose.x, y: pose.y };
  const to = GEO.avatar;
  const control = { x: from.x + 70, y: Math.min(from.y, to.y) - 40 };
  const pos = quadPoint(from, control, to, p);
  const dp = (at(s + 0.004) - at(s - 0.004)) / 0.008;
  const tan = quadTangent(from, control, to, p);
  const speed = Math.hypot(tan.x * dp, tan.y * dp);
  const baseScale = (pose.sx + pose.sy) / 2;
  const endScale = AVATAR_SIZE / pose.size;
  const scale = lerp(baseScale, endScale, ease.inOutCubic(p));
  return {
    ...out,
    x: pos.x,
    y: pos.y,
    sx: scale,
    sy: scale,
    rz: lerp(out.rz, -12, ease.outCubic(p)) * (1 - ease.inQuad(p)),
    stretch: clamp(speed / 2400, 0, 0.42),
    dir: Math.atan2(tan.y, tan.x),
    opacity: pose.opacity * (1 - progress(s, start + flight - 0.05, 0.07)),
    flight: p,
  };
}

function applyPose(badge, pose) {
  const half = badge.size / 2;
  const stretch = pose.stretch
    ? `rotate(${pose.dir}rad) scale(${1 + pose.stretch}, ${1 / (1 + pose.stretch)}) rotate(${-pose.dir}rad) `
    : "";
  badge.root.style.transform = `translate(${pose.x - half}px, ${pose.y - half}px)`;
  badge.tf.style.transform = `${stretch}rotate(${pose.rz}deg) scale(${pose.sx}, ${pose.sy})`;
  badge.rot.style.transform = `rotateY(${pose.theta}deg)`;
  badge.root.style.opacity = String(clamp(pose.opacity));
}

function drawBadges(s) {
  const flipTimes = [];
  BADGES.forEach((badge, i) => {
    let pose = DECK ? deckPose(s, i) : singlePose(s);
    pose.size = badge.size;
    flipTimes.push({ start: pose.flipStart, x: pose.x, y: pose.y, scale: (pose.sx + pose.sy) / 2, theta: pose.theta });
    if (s >= EX) pose = exitPose(pose, s, i);
    if (s < B) pose.opacity = 0;
    applyPose(badge, pose);
    const glowBoost = progress(s, B + 0.3, pose.flipStart - B - 0.3);
    faceLight(badge, pose.theta, glowBoost);
    glints(badge, s, pose.flipStart + CHOREO.flipWindup);
    badge.root.style.zIndex = DECK ? String(pose.tossed ? (i === 2 ? 12 : 5) : 10 - i) : "10";

    if (DECK) {
      const label = LABELS[i];
      const scale = (pose.sx + pose.sy) / 2;
      label.style.transform = `translate(${pose.x - 65}px, ${pose.y + (badge.size * scale) / 2 + 4}px)`;
      label.style.opacity = String(clamp(pose.settle ?? 0) * (1 - progress(s, EX + 0.1, 0.18)));
    }
  });

  // Swoosh + edge flash for every flip.
  for (const f of flipTimes) {
    const start = f.start + CHOREO.flipWindup - 0.06;
    const p = progress(s, start, 0.5);
    if (p > 0 && p < 1) {
      const env = Math.sin(Math.PI * clamp(p * 1.15));
      const head = Math.PI * 1.15 - Math.PI * 2 * 1.25 * ease.outCubic(p);
      const r = (SIZE / 236) * f.scale;
      swoosh(f.x, f.y + 8 * r, 168 * r, 36 * r, -0.17, head, 3.3 * env, 7 * r, GLOW, env);
    }
    edgeFlash(f.x, f.y, f.theta, SIZE * f.scale);
    if (!DECK) cornerSparkles(s, f.start);
  }
}

function cornerSparkles(s, flipStart) {
  const spots = [
    { dx: 84, dy: -76, at: 0.42, r: 15 },
    { dx: -92, dy: 44, at: 0.66, r: 9 },
  ];
  gFront.globalCompositeOperation = "lighter";
  for (const spot of spots) {
    const t = s - (flipStart + spot.at);
    if (t <= 0 || t > 1.6 || s > EX) continue;
    const grow = SP.badge.value(t);
    const fade = 1 - progress(t, 1.0, 0.6);
    const x = C.x + spot.dx;
    const y = C.y + spot.dy;
    glow(gFront, x, y, spot.r * 2.2 * grow, GLOW, 0.5 * fade);
    sparkle(gFront, x, y, spot.r * grow, (Math.PI / 4) * ease.outCubic(clamp(t / 0.5)), WHITE, fade);
  }
  gFront.globalCompositeOperation = "source-over";
}

// ── Copy & ledge ──────────────────────────────────────────────────────────

function drawCopy(s) {
  const base = DECK ? R : B + CHOREO.eyebrow;
  const titleAt = base + (CHOREO.title - CHOREO.eyebrow);
  const bodyAt = base + (CHOREO.body - CHOREO.eyebrow);
  const ledgeAt = base + (CHOREO.ledge - CHOREO.eyebrow);
  const out = ease.inQuad(progress(s, EX + CHOREO.exit.copyOut, 0.18));

  const eb = ease.outQuint(progress(s, base, 0.36));
  eyebrowEl.style.opacity = String(eb * (1 - out));
  eyebrowEl.style.transform = `translateY(${10 * (1 - eb) + 8 * out}px)`;

  titleWords.forEach((word, i) => {
    const t = s - (titleAt + i * CHOREO.titleStagger);
    const v = SP.title.value(t);
    word.style.opacity = String(progress(t, 0, 0.12) * (1 - out));
    word.style.transform = `translateY(${18 * (1 - v) + 8 * out}px) scale(${0.4 + 0.6 * v})`;
  });

  const bd = ease.outQuint(progress(s, bodyAt, 0.42));
  bodyEl.style.opacity = String(bd * (1 - out));
  bodyEl.style.transform = `translateY(${10 * (1 - bd) + 8 * out}px)`;

  const t = s - ledgeAt;
  const v = SP.ledge.value(t);
  const pressed = s >= EX && s < EX + CHOREO.exit.press;
  const ctaOut = ease.inQuad(progress(s, EX + 0.1, 0.2));
  ctaEl.style.opacity = String(progress(t, 0, 0.15) * (1 - ctaOut));
  ctaEl.style.transform = `translateY(${70 * (1 - v) + (pressed ? 4 : 0) + 20 * ctaOut}px)`;
  ctaEl.style.boxShadow = pressed ? "0 0 0 #3b8fd0" : "0 4px 0 #3b8fd0";
}

// ── Exit: home to the avatar ──────────────────────────────────────────────

function drawExit(s) {
  const avatar = panel.avatar;
  if (s < EX) {
    avatar.style.transform = "";
    avatar.style.boxShadow = "";
    return;
  }
  BADGES.forEach((badge, i) => {
    const start = EX + CHOREO.exit.launch + i * CHOREO.exit.deckStagger;
    const flight = CHOREO.exit.flight;
    const from = DECK ? deckRest(i) : { x: C.x, y: C.y };
    const to = GEO.avatar;
    const control = { x: from.x + 70, y: Math.min(from.y, to.y) - 40 };
    const light = LIGHT[badge.id];
    gFront.globalCompositeOperation = "lighter";
    for (const tr of TRAIL) {
      const emitAt = start + tr.at * flight * 0.92;
      const age = s - emitAt;
      if (age <= 0 || age > 0.5) continue;
      const pos = quadPoint(from, control, to, ease.dive(tr.at * 0.92));
      const life = 1 - age / 0.5;
      const x = pos.x + tr.dx * (age / 0.5);
      const y = pos.y + tr.dy * (age / 0.5) + 20 * age;
      if (tr.sparkle) sparkle(gFront, x, y, tr.size * life, tr.rot, WHITE, life);
      glow(gFront, x, y, tr.size * 2.4, light.glow, 0.55 * life);
    }
    // Arrival: a ring and a few sparkles leave the avatar.
    const arrive = s - (start + flight);
    if (arrive > 0 && arrive < 0.7) {
      const p = ease.outCubic(arrive / 0.6);
      ring(gFront, to.x, to.y, 24 + 46 * p, 3 * (1 - p) + 0.5, light.glow, 0.95 * (1 - p));
      const p2 = ease.outCubic(clamp((arrive - 0.08) / 0.6));
      if (arrive > 0.08) ring(gFront, to.x, to.y, 22 + 30 * p2, 1.6 * (1 - p2) + 0.4, WHITE, 0.7 * (1 - p2));
      glow(gFront, to.x, to.y, 54, light.glow, 0.5 * (1 - p));
      for (const sp of ARRIVAL) {
        const d = (1 - Math.exp(-4 * arrive)) / 4;
        const x = to.x + Math.cos(sp.ang) * sp.sp * d;
        const y = to.y + Math.sin(sp.ang) * sp.sp * d;
        sparkle(gFront, x, y, sp.size * (1 - arrive / 0.7), sp.rot + arrive * 4, WHITE, 1 - arrive / 0.7);
      }
    }
    gFront.globalCompositeOperation = "source-over";
  });

  // The avatar takes the light: a pulse per arrival, the last one strongest.
  let pulse = 0;
  let glowA = 0;
  BADGES.forEach((badge, i) => {
    const arrive = s - (EX + CHOREO.exit.launch + CHOREO.exit.flight + i * CHOREO.exit.deckStagger);
    const weight = i === BADGES.length - 1 ? 1 : 0.5;
    pulse += 0.26 * weight * KICK.pulse(arrive);
    glowA = Math.max(glowA, arrive > 0 ? weight * Math.exp(-2.4 * arrive) : 0);
  });
  avatar.style.transform = `scale(${1 + pulse})`;
  avatar.style.boxShadow = glowA > 0.01
    ? `0 0 0 2px var(--surface), 0 0 ${18 * glowA}px ${6 * glowA}px ${rgba(GLOW, 0.55 * glowA)}`
    : "";
}

function deckRest(i) {
  const fan = FAN[i];
  return { x: C.x + fan.dx, y: C.y + fan.dy };
}

// ── Reduced motion: keep the reward, drop the movement ────────────────────

function renderReduced(s) {
  const fadeIn = progress(s, 0, 0.2);
  const fadeOut = progress(s, EX + 0.1, 0.15);
  const v = clamp(fadeIn - fadeOut);
  duskSheet.style.transform = "translateY(0%)";
  duskEl.style.opacity = String(v);
  duskGlow.style.opacity = "1";
  starsCv.style.opacity = String(v);
  camEl.style.opacity = String(v);
  camEl.style.transform = "";
  ctaLayer.style.opacity = String(v);
  appEl.style.transform = "";
  appDim.style.opacity = "0";
  const ink = mixInk(v);
  statusEl.innerHTML = statusMarkup(ink);
  homebar.style.background = ink;

  for (const st of STARS) {
    const a = st.a * 0.8;
    gStars.fillStyle = rgba(st.layer ? "#EAF1FF" : "#C9D6FF", a);
    gStars.beginPath();
    gStars.arc(st.x, st.y, st.size * 0.6, 0, Math.PI * 2);
    gStars.fill();
  }
  haloEl.style.opacity = "0.6";
  haloEl.style.transform = "scale(1)";
  flashEl.style.opacity = "0";
  hintEl.style.opacity = "0";
  const badge = BADGES[0];
  applyPose(badge, { x: C.x, y: C.y, sx: 1, sy: 1, rz: 0, theta: 180, opacity: 1, size: badge.size });
  faceLight(badge, 180, 0);
  for (const band of badge.glints) band.style.opacity = "0";
  for (const node of [eyebrowEl, bodyEl, ...titleWords]) {
    node.style.opacity = "1";
    node.style.transform = "";
  }
  const pressed = s >= EX && s < EX + CHOREO.exit.press;
  ctaEl.style.opacity = "1";
  ctaEl.style.transform = `translateY(${pressed ? 4 : 0}px)`;
  ctaEl.style.boxShadow = pressed ? "0 0 0 #3b8fd0" : "0 4px 0 #3b8fd0";
  panel.avatar.style.transform = "";
}

// ── Touches (screen-recording style) ──────────────────────────────────────

const TOUCHES = [];
function addTouch(t, getPos, onDark) {
  const dot = document.createElement("div");
  dot.className = "touch";
  const rippleEl = document.createElement("div");
  rippleEl.className = "touch-ring";
  touchEl.append(dot, rippleEl);
  TOUCHES.push({ t, getPos, onDark, dot, ripple: rippleEl });
}

function renderTouches(T) {
  for (const tc of TOUCHES) {
    const pos = tc.getPos();
    const appear = ease.outQuad(progress(T, tc.t - 0.16, 0.14));
    const leave = progress(T, tc.t + 0.1, 0.22);
    const pressed = T >= tc.t && T < tc.t + 0.1;
    const a = clamp(appear - leave);
    const fill = tc.onDark ? "rgba(255,255,255,0.32)" : "rgba(17,17,17,0.16)";
    const edge = tc.onDark ? "rgba(255,255,255,0.7)" : "rgba(17,17,17,0.3)";
    tc.dot.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${(0.7 + 0.3 * appear) * (pressed ? 0.84 : 1)})`;
    tc.dot.style.opacity = String(a);
    tc.dot.style.background = fill;
    tc.dot.style.boxShadow = `inset 0 0 0 2px ${edge}`;
    const rp = progress(T, tc.t, 0.42);
    tc.ripple.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${1 + 1.3 * ease.outCubic(rp)})`;
    tc.ripple.style.opacity = String(rp > 0 && rp < 1 ? 0.55 * (1 - rp) : 0);
    tc.ripple.style.boxShadow = `inset 0 0 0 2px ${edge}`;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────

async function init() {
  await document.fonts.ready;
  // Both subsets: latin for the Latin letters, latin-ext for ı ş ğ İ.
  await Promise.all(
    ["800 28px Nunito", "900 16px Nunito", "700 13px Nunito", "600 15px Nunito"].map((f) =>
      document.fonts.load(f, "Aa ışğİŞĞçöü").catch(() => null),
    ),
  );
  await document.fonts.ready;
  const urls = new Set([
    ...SCN.achievements.map((id) => `${ASSET}/achievements/puhu/${id}.webp`),
    `${ASSET}/mascot/puhu/motion/rest.png`,
  ]);
  await Promise.all(
    [...urls].map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().catch(() => null);
    }),
  );
  await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));

  placeMenu(panel, screenEl);
  const node = centerOf(panel.node1, screenEl);
  // With no task on screen the spark enters from beyond the bottom-left corner, so its path never
  // crosses the tab bar (the Koç button sits at the bottom centre and would seem to fire it).
  GEO.origin = SCN.origin === "node" ? { x: node.x, y: node.y } : { x: -20, y: 900 };
  const av = centerOf(panel.avatar, screenEl);
  GEO.avatar = { x: av.x, y: av.y };
  const menuItem = centerOf(panel.menuDone, screenEl);
  const cta = centerOf(ctaEl, screenEl);

  if (SCN.context) {
    addTouch(SCN.context.nodeTap, () => node, SCN.theme === "dark");
    addTouch(SCN.context.itemTap, () => menuItem, SCN.theme === "dark");
  }
  if (SCN.igniteTap != null) addTouch(S0 + SCN.igniteTap, () => C, true);
  addTouch(S0 + EX, () => cta, true);

  // Paint once with every layer visible so masks and images are composited before capture.
  render(S0 + B + 1.2);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 250));
  render(0);

  window.scene.ready = true;
  if (params.get("play") === "1") play();
  else if (params.has("t")) render(Number(params.get("t")));
}

function play() {
  const t0 = performance.now();
  const loop = (now) => {
    const T = ((now - t0) / 1000) % SCN.duration;
    render(T);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/** Key moments for the storyboard, in video seconds. */
function keyFrames() {
  if (REDUCED) {
    return [
      { t: 1.05, label: "Görev ✓" },
      { t: S0 + 0.1, label: "Yumuşak geçiş" },
      { t: S0 + 1.2, label: "Ödül aynı, hareket yok" },
      { t: SCN.duration - 0.6, label: "Panel" },
    ];
  }
  const flip = B + (DECK ? CHOREO.deck.flip : CHOREO.flip) + CHOREO.flipWindup + 0.07;
  const frames = [
    { t: S0 + 0.32, label: "Kıvılcım yükselir" },
    { t: S0 + 1.55, label: "Işık toplanır" },
    { t: S0 + IG + 0.08, label: SCN.igniteTap != null ? "Dokun: anticipation" : "Kendiliğinden yanar" },
    { t: S0 + B + 0.1, label: "Işık yandı" },
    { t: S0 + flip, label: "Swoosh + çevirme" },
    { t: S0 + (DECK ? R + 1.2 : B + 2.4), label: DECK ? "Yelpaze" : "Rozet + metin" },
    { t: S0 + EX + 0.55, label: "Eve uçuş" },
  ];
  // After the streak digit has finished rolling to 7, before the spark takes over.
  if (SCN.context) frames.unshift({ t: SCN.context.flame + 0.37, label: "Görev ✓" });
  else frames.unshift({ t: S0 + 0.05, label: "Alacakaranlık" });
  return frames;
}

window.scene = {
  ready: false,
  name: NAME,
  fps: FPS,
  duration: SCN.duration,
  cues: cuesFor(SCN),
  keyFrames,
  seek: render,
  setLabel(text, sub) {
    const el = $("sbLabel");
    el.style.display = text ? "block" : "none";
    el.innerHTML = text ? `${text}<small>${sub ?? ""}</small>` : "";
  },
};

init();
