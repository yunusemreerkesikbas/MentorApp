// Feature ads wave 2 "Kendi dünyası": four reels (8 s; DRH and DRY 12 s) built from the approved canvas strips (D2-Reels board).
// Every coordinate is in the 1080x1920 reel frame, copied from the strips. Hook 0–1.5 s, build, then a 2 s end card (6–8 s; 10–12 s in the 12 s reels).
// Effects and one track per reel (src/dr-sfx.ts); the same file runs organic and as a launch ad.
import type { CSSProperties, FC, ReactNode } from "react";
import { Audio } from "@remotion/media";
import { Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ART, SOUND, type ArtKey } from "../art";
import { C } from "../brand";
import { COPY } from "../copy";
import { EndCard } from "../components/EndCard";
import { Frame } from "../components/Frame";
import { caveat } from "../fonts";
import { DR_CUES, DR_MUSIC, type DrId } from "../dr-sfx";
import { pop, shake, slam } from "../motion";
import { levelGain, MUSIC_VOLUME, SFX } from "../t1/sfx";
import { PIECES, type PieceId, type PieceProps } from "../pieces";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const endAt = (id: PieceId) => PIECES.find((p) => p.id === id)!.video!.endCardFrom;
const HEAD: CSSProperties = { position: "absolute", left: 0, right: 0, margin: 0, textAlign: "center", fontWeight: 1000, lineHeight: 0.95, letterSpacing: "-0.035em", color: C.navy, whiteSpace: "nowrap" };
const art = (key: ArtKey) => staticFile(ART[key]);
// The end card stays as on the strip: logo and puhukoc.com only.
// On top of everything, DRH's progress bars and text layers included. The reel's effects ride along.
const End = ({ id, ground, ink }: { id: DrId; ground: string; ink: string }) => (
  <>
    <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
      <EndCard ground={ground} ink={ink} enter={endAt(id)} tag={null} />
    </div>
    <Sequence name="Efektler" layout="none">
      {DR_CUES[id].map((c) => (
        // ponytail: every trimmed effect fits in 2 s, as in T1
        <Sequence key={`${c.sound}-${c.at}`} from={c.at - SFX[c.sound].hit} durationInFrames={60} layout="none">
          <Audio src={staticFile(SOUND[c.sound])} volume={c.mix * levelGain(c.sound)} trimBefore={SFX[c.sound].trim} />
        </Sequence>
      ))}
    </Sequence>
  </>
);

// ---------- DRP · Hedef panosu ----------
const WALL = "#F6E4CC";
const WALL_BG = `radial-gradient(circle at 88% 8%, rgba(255,255,255,0.6), rgba(255,255,255,0) 42%), repeating-linear-gradient(90deg, ${WALL} 0px, ${WALL} 54px, rgba(120,80,40,0.05) 54px, rgba(120,80,40,0.05) 108px), ${WALL}`;
const CORK = "radial-gradient(#B07D48 1.6px, rgba(0,0,0,0) 1.9px) 0 0 / 22px 22px, #C8955E";
const PIN = "radial-gradient(circle at 35% 35%, #FF8A8E, #E5484D 60%, #B4282D)";
const P = COPY.DRP!;
const PHOTOS = [
  { art: "t1Board1", label: P.photo1 },
  { art: "t1Board2", label: P.photo2 },
  { art: "t1Board3", label: P.photo3 },
  { art: "t1Board4", label: P.photo4 },
] as const;
// Big board polaroids (strip frame 3) and the same four on the lock screen (post phone, 292x620 units).
const BIG = [
  { left: 140, top: 620, rotate: -5 },
  { left: 560, top: 610, rotate: 4 },
  { left: 150, top: 1020, rotate: 3 },
  { left: 570, top: 1010, rotate: -4 },
] as const;
const SMALL = [
  { left: 10, top: 196, rotate: -6 },
  { left: 152, top: 188, rotate: 5 },
  { left: 14, top: 352, rotate: 4 },
  { left: 150, top: 346, rotate: -4 },
] as const;
const DRP_AT = { head: 3, photos: [30, 42, 54, 66], goal: 90, push: 120, clock: 144 } as const;

function Polaroid({ src, label, left, top, rotate, size, style }: { src: string; label: string; left: number; top: number; rotate: number; size: number; style?: CSSProperties }) {
  const k = size / 330; // the big polaroid: 330 px photo, 12 px border, 75 px caption strip
  return (
    <div style={{ position: "absolute", left, top, width: size + 24 * k, boxSizing: "border-box", padding: `${12 * k}px ${12 * k}px 0`, background: "#FFFFFF", boxShadow: `0 ${8 * k}px ${14 * k}px rgba(50, 30, 10, 0.28)`, transform: `rotate(${rotate}deg)`, ...style }}>
      <Img src={src} alt="" style={{ display: "block", width: size, height: size, objectFit: "cover" }} />
      <p style={{ margin: 0, height: 75 * k, fontFamily: caveat, fontSize: 52 * k, fontWeight: 700, lineHeight: `${75 * k}px`, textAlign: "center", color: C.navy }}>{label}</p>
      <span aria-hidden="true" style={{ position: "absolute", left: `calc(50% - ${11 * Math.max(k, 0.6)}px)`, top: -9 * Math.max(k, 0.6), width: 22 * Math.max(k, 0.6), height: 22 * Math.max(k, 0.6), borderRadius: "50%", background: PIN }} />
    </div>
  );
}

function GoalCard({ scale, style }: { scale: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", boxSizing: "border-box", borderRadius: 22 * scale, background: "#FFFFFF", boxShadow: `0 ${8 * scale}px 0 ${C.navy}`, textAlign: "center", padding: `${20 * scale}px ${24 * scale}px ${22 * scale}px`, ...style }}>
      <p style={{ margin: 0, fontSize: 20 * scale, fontWeight: 1000, letterSpacing: "0.12em", color: C.blue }}>{P.goalLabel}</p>
      <p style={{ margin: `${6 * scale}px 0 0`, fontSize: 38 * scale, fontWeight: 1000, lineHeight: 1.05, color: C.navy }}>{P.goal}</p>
      <p style={{ margin: `${8 * scale}px 0 0`, fontSize: 24 * scale, fontWeight: 800, color: C.grey }}>{P.city}</p>
    </div>
  );
}

const ICON_DOT: CSSProperties = { position: "absolute", bottom: 30, width: 46, height: 46, borderRadius: "50%", background: "rgba(15, 20, 30, 0.55)", display: "flex", alignItems: "center", justifyContent: "center" };

// The post's lock screen (D2-Pano-Post phone), in its own 292x620 units.
function LockScreen({ time, timeScale }: { time: string; timeScale: number }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 292, height: 620, background: "radial-gradient(#B07D48 1.2px, rgba(0,0,0,0) 1.5px) 0 0 / 15px 15px, #C8955E" }}>
      {PHOTOS.map((p, i) => (
        <Polaroid key={p.art} src={art(p.art)} label={p.label} size={114} {...SMALL[i]} />
      ))}
      <GoalCard scale={0.43} style={{ left: 64, top: 304, width: 164, transform: "rotate(-2deg)" }} />
      <Img src={art("d2Yazilim")} alt={P.altPuhu} style={{ position: "absolute", left: 106, top: 470, width: 84, height: 84, transform: "rotate(8deg)", filter: "drop-shadow(0 4px 4px rgba(50, 30, 10, 0.3))" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 200, background: "linear-gradient(rgba(15, 20, 30, 0.55), rgba(15, 20, 30, 0))" }} />
      <span aria-hidden="true" style={{ position: "absolute", left: 100, top: 12, width: 92, height: 26, borderRadius: 999, background: "#05070D" }} />
      <p style={{ position: "absolute", left: 0, right: 0, top: 56, margin: 0, textAlign: "center", fontSize: 19, fontWeight: 800, color: "#FFFFFF" }}>{P.date}</p>
      <p style={{ position: "absolute", left: 0, right: 0, top: 80, margin: 0, textAlign: "center", fontSize: 86, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", color: "#FFFFFF", fontVariantNumeric: "tabular-nums", transform: `scale(${timeScale})` }}>{time}</p>
      <span aria-hidden="true" style={{ ...ICON_DOT, left: 22 }}>
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 3h8l-1.5 6v12h-5V9z" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="13" r="1.4" fill="#FFFFFF" /></svg>
      </span>
      <span aria-hidden="true" style={{ ...ICON_DOT, left: 224 }}>
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.2" fill="none" stroke="#FFFFFF" strokeWidth="2" /></svg>
      </span>
      <span aria-hidden="true" style={{ position: "absolute", left: 96, bottom: 10, width: 100, height: 5, borderRadius: 999, background: "#FFFFFF", opacity: 0.85 }} />
    </div>
  );
}

// Empty cork board → four photos pin in on the beat → the goal card drops → the camera pushes into the
// phone and the board is the lock screen, the clock ticks to 07:30.
function DRPReel({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const A = DRP_AT;
  const board = interpolate(frame, [A.push, A.push + 5], [1, 0], clamp);
  const zoom = interpolate(frame, [A.push, A.push + 18], [1.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const phoneIn = interpolate(frame, [A.push, A.push + 6], [0, 1], clamp);
  const jolt = A.photos.reduce((j, at) => j + shake(frame, at), 0) + shake(frame, A.goal) * 1.5;
  return (
    <Frame format="reel" background={WALL_BG} color={C.navy} safe={safe}>
      {board > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: board, transform: `scale(${1 + (1 - board) * 0.6})`, transformOrigin: "540px 1010px" }}>
          <div style={{ ...HEAD, top: 300, fontSize: 130, opacity: frame < A.push ? 1 : 0, transform: `scale(${slam(frame, fps, A.head)})` }}>
            {P.head1}
            <br />
            {P.head2}
          </div>
          <div style={{ position: "absolute", left: 60, top: 560, width: 960, height: 900, boxSizing: "border-box", borderRadius: 20, border: "26px solid #8A5A33", background: CORK, transform: `rotate(${jolt / 6}deg)` }} />
          {PHOTOS.map((p, i) => (
            <Polaroid key={p.art} src={art(p.art)} label={p.label} size={330} {...BIG[i]} rotate={BIG[i].rotate + shake(frame, A.photos[i]!)} style={{ transform: `rotate(${BIG[i].rotate + shake(frame, A.photos[i]!)}deg) scale(${slam(frame, fps, A.photos[i]!)})` }} />
          ))}
          <GoalCard scale={1.4} style={{ left: 330, top: 870, width: 420, transform: `rotate(${-2 + shake(frame, A.goal)}deg) translateY(${interpolate(frame, [A.goal, A.goal + 8], [-700, 0], { ...clamp, easing: Easing.in(Easing.quad) })}px)`, opacity: frame >= A.goal ? 1 : 0 }} />
        </div>
      ) : null}
      {frame >= A.push ? (
        <div style={{ position: "absolute", left: 190, top: 260, width: 700, height: 1420, boxSizing: "border-box", padding: 26, borderRadius: 110, background: C.navy, boxShadow: "0 40px 60px rgba(40, 25, 10, 0.35)", opacity: phoneIn, transform: `scale(${zoom})`, transformOrigin: "50% 52%" }}>
          <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: 90 }}>
            {/* 648 px screen / 292 post units */}
            <div style={{ position: "absolute", left: 0, top: 0, transform: "scale(2.2192)", transformOrigin: "0 0" }}>
              <LockScreen time={frame >= A.clock ? "07:30" : "07:29"} timeScale={frame >= A.clock ? 0.7 + 0.3 * pop(frame, fps, A.clock) : 1} />
            </div>
          </div>
        </div>
      ) : null}
      <End id="DRP" ground={WALL} ink={C.navy} />
    </Frame>
  );
}

// ---------- DRK · Kariyer Puhu'ları ----------
const K = COPY.DRK!;
const ALBUM = `radial-gradient(rgba(15,34,51,0.10) 2.5px, rgba(0,0,0,0) 3px) 0 0 / 38px 38px, #FFD54A`;
// All ten fields in the app's order, one per beat.
const FIELDS = ["d2Saglik", "d2Muhendislik", "d2Yazilim", "d2Hukuk", "d2Egitim", "d2Isletme", "d2Sosyal", "d2Sanat", "d2Fen", "d2Mimarlik"] as const;
const FIELD_NAMES = ["Sağlık", "Mühendislik", "Yazılım", "Hukuk", "Eğitim", "İşletme", "İletişim", "Sanat", "Fen", "Mimarlık"] as const;
const DRK_AT = { head: 0, swap: 15, slot: 165 } as const;

// The sticker swaps costume on every beat with a squash, then the empty slot asks for yours.
function DRKReel({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const index = Math.min(FIELDS.length - 1, Math.floor(frame / DRK_AT.swap));
  const at = index * DRK_AT.swap;
  const s = pop(frame, fps, at);
  // Squash on each swap: wide and flat first, then tall, then round.
  const sx = index === 0 ? s : 1 + 0.18 * (1 - s) * (frame - at < 4 ? 1 : -0.6);
  const sy = index === 0 ? s : 1 - 0.18 * (1 - s) * (frame - at < 4 ? 1 : -0.6);
  const tilt = [-4, 4, -3, 3, -5, 4, -3, 5, -4, 3][index]!;
  return (
    <Frame format="reel" background={ALBUM} color={C.navy} safe={safe}>
      <div style={{ ...HEAD, top: 260, fontSize: 150, transform: `scale(${slam(frame, fps, DRK_AT.head)})` }}>
        {K.head1}
        <br />
        {K.head2}
      </div>
      {frame < DRK_AT.slot ? (
        <Img
          src={art(FIELDS[index])}
          alt={`${FIELD_NAMES[index]} kıyafetli Puhu`}
          style={{ position: "absolute", left: 190, top: 760, width: 700, height: 700, objectFit: "contain", transformOrigin: "50% 90%", transform: `rotate(${tilt}deg) scale(${sx}, ${sy})`, filter: "drop-shadow(0 8px 8px rgba(15, 34, 51, 0.25))" }}
        />
      ) : (
        <div style={{ position: "absolute", left: 240, top: 800, width: 600, height: 600, boxSizing: "border-box", borderRadius: 60, border: `14px dashed ${C.navy}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: `scale(${slam(frame, fps, DRK_AT.slot)}) rotate(${shake(frame, DRK_AT.slot)}deg)` }}>
          <span style={{ fontSize: 90, fontWeight: 1000 }}>{K.slot}</span>
          <span style={{ marginTop: 16, fontFamily: caveat, fontSize: 64, fontWeight: 700, color: C.blue, transform: `rotate(-4deg) scale(${pop(frame, fps, DRK_AT.slot + 6)})` }}>{K.slotNote}</span>
        </div>
      )}
      <End id="DRK" ground="#FFD54A" ink={C.navy} />
    </Frame>
  );
}

// ---------- DRH · Haftalık hikâye ----------
const H = COPY.DRH!;
const R = { coral: "#FF5B49", lavender: "#AFB1FF", mint: "#16D0A6" } as const;
// Decor as in the app's weekly-recap-story (2.5x), per slide: [art, position, width, height, rotate, opacity].
type Decor = { art: ArtKey; pos: CSSProperties; w: number; h?: number; rotate?: number; opacity?: number };
type Slide = { ground: string; bar: number; from: number; decor: Decor[]; body: (frame: number, fps: number, at: number) => ReactNode; padTop?: number; top?: boolean };
const BAR_COUNT = 7; // the app's story has seven slides; the reel shows five of them (their bar index below)

const BIG_NUM: CSSProperties = { margin: 0, fontSize: 240, fontWeight: 1000, lineHeight: 1, letterSpacing: "-0.06em" };
const H2: CSSProperties = { margin: 0, maxWidth: 960, fontSize: 90, fontWeight: 1000, lineHeight: 0.98, letterSpacing: "-0.04em" };
const LABEL: CSSProperties = { margin: 0, fontSize: 35, fontWeight: 1000, letterSpacing: "0.18em" };

const SLIDES: Slide[] = [
  {
    ground: R.coral, bar: 0, from: 0,
    decor: [
      { art: "d2Floral", pos: { left: -238, top: -154 }, w: 799 },
      { art: "d2LavenderShape", pos: { right: -194, top: -38 }, w: 626, rotate: 90 },
      { art: "d2SilverWiggle", pos: { left: -454, bottom: -461 }, w: 994, h: 1382, rotate: 30 },
      { art: "d2RedPixel", pos: { right: -130, bottom: -96 }, w: 626 },
    ],
    body: (f, fps, at) => (
      <>
        <Img src={staticFile(ART.host)} alt="Sunucu Puhu" style={{ width: 650, height: 650, objectFit: "contain", filter: "drop-shadow(0 25px 25px rgba(0,0,0,0.25))", transform: `scale(${pop(f, fps, at)})` }} />
        <h1 style={{ ...H2, marginTop: 70, transform: `scale(${slam(f, fps, at + 6)})` }}>{H.welcome}</h1>
        <p style={{ margin: "40px 0 0", fontSize: 35, fontWeight: 700, color: "rgba(0,0,0,0.7)" }}>{H.range}</p>
      </>
    ),
  },
  {
    ground: R.coral, bar: 2, from: 45, top: true,
    decor: [
      { art: "d2GreenShape", pos: { left: -259, bottom: -230 }, w: 670 },
      { art: "d2GreenWiggle", pos: { right: -162, bottom: -346 }, w: 562, h: 1037, rotate: 180 },
      { art: "d2Floral", pos: { right: -216, bottom: -154 }, w: 562 },
      { art: "d2WorldMap", pos: { left: 194, bottom: 134 }, w: 691, opacity: 0.85 },
    ],
    body: (f, fps, at) => (
      <>
        <h2 style={{ ...H2, transform: `scale(${slam(f, fps, at)})` }}>{H.focusHead}</h2>
        {/* counts up to the app's sample 312 */}
        <p style={{ ...BIG_NUM, marginTop: 70, fontVariantNumeric: "tabular-nums" }}>{Math.round(interpolate(f, [at + 4, at + 22], [0, 312], { ...clamp, easing: Easing.out(Easing.cubic) }))}</p>
        <p style={{ margin: "20px 0 0", fontSize: 60, fontWeight: 1000 }}>{H.focusUnit}</p>
      </>
    ),
  },
  {
    ground: R.lavender, bar: 3, from: 105,
    decor: [
      { art: "d2LavenderShape", pos: { left: -97, top: -134 }, w: 518 },
      { art: "d2Floral", pos: { right: -194, top: -154 }, w: 626 },
      { art: "d2SilverWiggle", pos: { left: -518, bottom: -653 }, w: 1058, h: 1382, rotate: 52 },
      { art: "d2LavenderPixel", pos: { right: -259, bottom: -38 }, w: 778, h: 614, rotate: -12 },
    ],
    body: (f, fps, at) => (
      <>
        <p style={{ ...BIG_NUM, transform: `scale(${slam(f, fps, at)})` }}>5</p>
        <h2 style={{ ...H2, marginTop: 50, transform: `scale(${pop(f, fps, at + 6)})` }}>{H.runHead}</h2>
      </>
    ),
  },
  {
    ground: R.lavender, bar: 4, from: 165,
    decor: [
      { art: "d2GreenShape", pos: { left: -151, top: -154 }, w: 626 },
      { art: "d2SilverWiggle", pos: { right: -540, top: -614 }, w: 1134, h: 1459, rotate: 145 },
      { art: "d2Graphics", pos: { left: -216, bottom: -96 }, w: 583 },
      { art: "d2LavenderShape", pos: { right: -130, bottom: -230 }, w: 475, rotate: 180 },
    ],
    body: (f, fps, at) => (
      <>
        <p style={{ ...LABEL, color: "rgba(0,0,0,0.55)" }}>{H.starLabel}</p>
        <div style={{ marginTop: 70, width: 640, height: 640, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 50px", border: "20px solid #000000", background: R.coral, boxShadow: `30px 30px 0 ${R.mint}`, transform: `rotate(${shake(f, at + 2)}deg) scale(${slam(f, fps, at + 2)})` }}>
          <span style={{ fontSize: 90, fontWeight: 1000, lineHeight: 0.95, letterSpacing: "-0.05em" }}>{H.star}</span>
        </div>
      </>
    ),
  },
  {
    ground: "#000000", bar: 5, from: 225,
    decor: [],
    body: (f, fps, at) => (
      <div style={{ transform: "translateY(-500px)" }}>
        <p style={{ ...LABEL, color: "rgba(255,255,255,0.65)", transform: `scale(${pop(f, fps, at + 4)})` }}>{H.nickLabel}</p>
        <h2 style={{ ...H2, marginTop: 30, color: "#FFFFFF", transform: `scale(${slam(f, fps, at + 8)})` }}>{H.nick}</h2>
      </div>
    ),
  },
];
const ENDS = [...SLIDES.slice(1).map((s) => s.from), endAt("DRH")];

// Tap-through like the app's weekly story: progress bars, hard cuts, then the nickname reveal.
function DRHReel({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const i = SLIDES.filter((s) => frame >= s.from).length - 1;
  const slide = SLIDES[i]!;
  const end = ENDS[i]!;
  const progress = interpolate(frame, [slide.from, end], [0, 1], clamp);
  const drift = (frame - slide.from) * 0.25; // decor breathes slowly, as on the canvas strip it sits still
  return (
    <Frame format="reel" background={slide.ground} color="#000000" safe={safe}>
      {slide.decor.map((d, k) => (
        <Img key={d.art + k} src={art(d.art)} alt="" style={{ position: "absolute", ...d.pos, width: d.w, height: d.h ?? d.w, objectFit: "contain", opacity: d.opacity ?? 1, transform: `rotate(${(d.rotate ?? 0) + (k % 2 ? drift : -drift)}deg) scale(${0.85 + 0.15 * pop(frame, fps, slide.from + k * 2)})` }} />
      ))}
      {i === SLIDES.length - 1 ? (
        <Img src={staticFile(ART.t1CharFocus)} alt="Kozmik girdapta dalgıç kıyafetli Puhu" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 60%", transform: `scale(${interpolate(frame, [slide.from, end], [1.12, 1], { ...clamp, easing: Easing.out(Easing.cubic) })})` }} />
      ) : null}
      <div aria-hidden="true" style={{ position: "absolute", left: 30, right: 30, top: 20, zIndex: 5, display: "flex", gap: 10 }}>
        {Array.from({ length: BAR_COUNT }, (_, b) => (
          <span key={b} style={{ flex: 1, height: 10, borderRadius: 9, overflow: "hidden", background: "rgba(255,255,255,0.35)" }}>
            <span style={{ display: "block", height: "100%", width: `${b < slide.bar ? 100 : b === slide.bar ? progress * 100 : 0}%`, background: "#FFFFFF" }} />
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, zIndex: 2, boxSizing: "border-box", padding: `${slide.top ? 400 : 280}px 80px 360px`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: slide.top ? "flex-start" : "center", textAlign: "center" }}>
        {slide.body(frame, fps, slide.from)}
      </div>
      <End id="DRH" ground="#000000" ink="#FFFFFF" />
    </Frame>
  );
}

// ---------- DRY · Yanlış Defterim ----------
const Y = COPY.DRY!;
const DOTS = `radial-gradient(${C.dot} 2.5px, rgba(230, 222, 200, 0) 2.5px) 0 0 / 36px 36px, ${C.cream}`;
const RED = "#D93F4C";
const DRY_AT = { head: 0, tape: 8, pen: 60, review: 135, stamp: 210 } as const;
const RINGS = Array.from({ length: 15 }, (_, i) => 60 + i * 68);

// A question is taped in, the red pen marks the mistake, the review day flips in, ÇÖZDÜM slams.
function DRYReel({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const A = DRY_AT;
  const stage = frame >= A.stamp ? 2 : frame >= A.review ? 1 : 0;
  const heads = [[Y.head1a, Y.head1b], [Y.head2a, Y.head2b], [Y.head3a, Y.head3b]] as const;
  const headAt = [A.head, A.review, A.stamp][stage]!;
  const tapeY = interpolate(frame, [A.tape, A.tape + 10], [-900, 0], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const write = interpolate(frame, [A.pen, A.pen + 18], [0, 100], clamp);
  const arrow = interpolate(frame, [A.pen + 16, A.pen + 26], [1, 0], clamp);
  const flip = interpolate(frame, [A.review + 4, A.review + 16], [90, 0], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const bump = shake(frame, A.stamp) * 0.6 + shake(frame, A.review) * 0.4;
  return (
    <Frame format="reel" background={DOTS} color={C.navy} safe={safe}>
      <div style={{ position: "absolute", left: 110, top: 560, width: 860, height: 1100, transform: `rotate(${bump}deg)`, transformOrigin: "50% 60%" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "10px 26px 26px 10px", background: C.paper, boxShadow: "0 30px 60px -20px rgba(30, 20, 8, 0.55), inset 0 0 0 3px rgba(120, 96, 60, 0.12)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 150, bottom: 40, backgroundImage: "repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0 54px, #CFE0F5 54px 57px)" }} />
          <div style={{ position: "absolute", left: 92, top: 0, bottom: 0, width: 3, background: "#F2A7AE" }} />
          {RINGS.map((top) => (
            <div key={top} style={{ position: "absolute", left: -18, top, width: 52, height: 20, borderRadius: 10, border: "6px solid #8A93A6", boxSizing: "border-box" }} />
          ))}
          <div style={{ position: "absolute", left: 110, top: 44, padding: "6px 28px", background: "#8FBEF0", transform: "rotate(-4deg)", fontFamily: caveat, fontWeight: 700, fontSize: 48, color: "#1D2433" }}>{Y.subject}</div>
          <div style={{ position: "absolute", right: 70, top: 52, fontSize: 44, fontWeight: 1000, color: C.grey }}>{Y.count}</div>
          <div style={{ position: "absolute", left: 120, top: 175, width: 640, padding: "44px 38px 34px", boxSizing: "border-box", background: "#FFFFFF", boxShadow: "0 8px 18px rgba(30, 20, 8, 0.18)", transform: `translateY(${tapeY}px) rotate(-1deg)`, fontSize: 54, fontWeight: 900, lineHeight: 1.15, color: C.mask }}>
            <div aria-hidden="true" style={{ position: "absolute", left: 240, top: -18, width: 160, height: 40, background: C.yellow, opacity: 0.9, transform: `rotate(-3deg) scaleX(${pop(frame, fps, A.tape + 8)})` }} />
            {Y.question}
          </div>
          {frame >= A.pen ? (
            <>
              <svg aria-hidden="true" viewBox="0 0 120 120" style={{ position: "absolute", left: 600, top: 440, width: 120, height: 120 }}>
                <path d="M14 104 C60 100 96 70 100 18 M84 34 L100 16 L112 38" fill="none" stroke={RED} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={arrow} />
              </svg>
              <div style={{ position: "absolute", left: 150, top: 500, fontFamily: caveat, fontWeight: 700, fontSize: 80, lineHeight: 1, color: RED, transform: "rotate(-4deg)", clipPath: `inset(-20px ${100 - write}% -20px -20px)` }}>{Y.note}</div>
            </>
          ) : null}
          {stage === 1 ? (
            <div style={{ position: "absolute", left: 470, top: 880, padding: "10px 26px", borderRadius: 16, background: C.blue, color: "#FFFFFF", fontSize: 40, fontWeight: 1000, transform: `perspective(600px) rotateX(${flip}deg) rotate(3deg)`, transformOrigin: "50% 0" }}>{Y.review}</div>
          ) : null}
          {stage === 2 ? (
            <div style={{ position: "absolute", left: 250, top: 690, padding: "6px 34px", border: "10px solid #1F9D55", borderRadius: 22, color: "#1F9D55", fontSize: 104, fontWeight: 1000, letterSpacing: "0.04em", lineHeight: 1.1, transform: `rotate(${-9 + shake(frame, A.stamp)}deg) scale(${slam(frame, fps, A.stamp)})` }}>{Y.stamp}</div>
          ) : null}
        </div>
      </div>
      <p key={stage} style={{ ...HEAD, top: 220, fontSize: 120, color: stage === 0 ? C.navy : C.blue, transform: `scale(${slam(frame, fps, headAt)})` }}>
        {heads[stage][0]}
        <br />
        {heads[stage][1]}
      </p>
      <End id="DRY" ground={C.cream} ink={C.navy} />
    </Frame>
  );
}

// ---------- Music ----------
// The reel's own track under the picture and effects; it fades out over the last half second.
const withMusic = (id: DrId, Reel: FC<PieceProps>): FC<PieceProps> =>
  function WithMusic(props: PieceProps) {
    const { durationInFrames } = useVideoConfig();
    return (
      <>
        <Reel {...props} />
        <Audio name="Müzik" src={staticFile(SOUND[DR_MUSIC[id].sound])} trimBefore={DR_MUSIC[id].from} volume={(f) => MUSIC_VOLUME * DR_MUSIC[id].gain * interpolate(f, [durationInFrames - 15, durationInFrames], [1, 0], clamp)} />
      </>
    );
  };
export const DRP = withMusic("DRP", DRPReel);
export const DRK = withMusic("DRK", DRKReel);
export const DRH = withMusic("DRH", DRHReel);
export const DRY = withMusic("DRY", DRYReel);
