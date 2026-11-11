import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../brand";
import { COPY } from "../copy";
import { EndCard } from "../components/EndCard";
import { Frame } from "../components/Frame";
import { NotifChip, Puhu, TimerPill } from "../components/Series";
import { pop, shake, slam } from "../motion";
import { PIECES, type PieceProps } from "../pieces";

const T = COPY.IR1!;
const VIDEO = PIECES.find((p) => p.id === "IR1")!.video!;
// Beat grid (30 fps, one beat = 15): hook, Puhu slams in, the message, end card at 180.
const AT = { ring: 6, puhu: 45, stop: 51, message: 90, head1: 96, head2: 111, timer: 126 } as const;
const CHIPS = [
  { x: 96, y: 690, size: 150, rotate: -14, glyph: "chat", badge: "12", at: 9 },
  { x: 826, y: 650, size: 170, rotate: 10, glyph: "heart", badge: "99+", at: 15 },
  { x: 50, y: 1150, size: 170, rotate: 8, glyph: "bell", badge: "5", at: 21 },
  { x: 856, y: 1170, size: 150, rotate: -10, glyph: "play", badge: "3", at: 27 },
  { x: 450, y: 1330, size: 140, rotate: 6, glyph: "chat", badge: "8", at: 33 },
] as const;
const CENTRE = { x: 540, y: 1030 };
const PUHU_RATIO = 1400 / 1370; // the koruma PNG, height over width
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const HEAD = { margin: 0, fontWeight: 1000, lineHeight: 0.9, whiteSpace: "nowrap" } as const;

// "25:00" counting down one second per second from the moment the timer lands.
const clock = (frame: number): string => {
  const left = 25 * 60 - Math.max(0, Math.floor((frame - AT.timer) / 30));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
};

// Notifications swarm the timer, the bodyguard slams in and flings them out, then the headline stamps.
export function IR1({ safe }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fling = interpolate(frame, [AT.puhu, AT.puhu + 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const settle = interpolate(frame, [AT.message, AT.message + 12], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const jolt = (shake(frame, AT.puhu) + shake(frame, AT.stop)) * 1.6;
  const width = 1280 - 380 * settle;
  return (
    <Frame format="reel" background={C.blue} safe={safe}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 50% 56%, rgba(255, 255, 255, 0.09) 0deg 11deg, rgba(255, 255, 255, 0) 11deg 30deg)" }} />
      <div style={{ position: "absolute", inset: 0, transform: `translate(${jolt}px, ${-jolt / 2}px)` }}>
        {frame < AT.puhu ? (
          <p style={{ position: "absolute", left: 0, right: 0, top: 290, margin: 0, textAlign: "center", fontSize: 116, fontWeight: 1000, lineHeight: 0.95, letterSpacing: "-0.035em", transform: `scale(${pop(frame, fps, 0)})` }}>
            {T.hook1}
            <br />
            {T.hook2}
          </p>
        ) : null}

        {/* The timer everyone is crowding; it shrinks away when Puhu arrives. */}
        <div style={{ position: "absolute", left: 280, top: 770, width: 520, height: 520, transform: `scale(${pop(frame, fps, AT.ring) * (1 - fling)}) rotate(${CHIPS.reduce((r, c) => r + shake(frame, c.at), 0) / 3}deg)` }}>
          <svg aria-hidden="true" viewBox="0 0 262 262" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <circle cx="131" cy="131" r="114" fill="#FFFFFF" stroke={C.tint2} strokeWidth="20" />
            <circle cx="131" cy="131" r="114" fill="none" stroke={C.yellow} strokeWidth="20" strokeLinecap="round" strokeDasharray="716.3" strokeDashoffset="40" transform="rotate(-90 131 131)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.navy }}>
            <span style={{ fontSize: 150, fontWeight: 1000, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>25:00</span>
            <span style={{ fontSize: 39, fontWeight: 900, color: C.grey }}>{T.timerLabel}</span>
          </div>
        </div>

        {fling < 1
          ? CHIPS.map((c) => {
              const dx = c.x + c.size / 2 - CENTRE.x;
              const dy = c.y + c.size / 2 - CENTRE.y;
              const far = 1300 / Math.hypot(dx, dy);
              return (
                <NotifChip
                  key={c.at}
                  x={c.x}
                  y={c.y}
                  size={c.size}
                  glyph={c.glyph}
                  badge={c.badge}
                  rotate={c.rotate}
                  style={{ boxShadow: `0 10px 0 ${C.navy}`, transform: `translate(${dx * far * fling}px, ${dy * far * fling}px) rotate(${c.rotate + shake(frame, c.at) + 200 * fling}deg) scale(${pop(frame, fps, c.at)})` }}
                />
              );
            })
          : null}

        {frame >= AT.puhu ? (
          <Puhu
            art="koruma"
            alt={T.altPuhu}
            left={-60 + 180 * settle}
            top={610 + 270 * settle}
            width={width}
            height={width * PUHU_RATIO}
            style={{ transformOrigin: "30% 55%", transform: `scale(${slam(frame, fps, AT.puhu)})` }}
          />
        ) : null}

        {settle < 1 ? (
          <p style={{ ...HEAD, position: "absolute", left: 0, right: 0, top: 250, textAlign: "center", fontSize: 330, letterSpacing: "-0.04em", color: C.yellow, textShadow: `0 16px 0 ${C.navy}`, transform: `rotate(${-5 + shake(frame, AT.stop)}deg) scale(${slam(frame, fps, AT.stop) * (1 - settle)})` }}>
            {T.stop}
          </p>
        ) : null}

        <div style={{ position: "absolute", left: 0, right: 0, top: 290, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <p style={{ ...HEAD, fontSize: 124, letterSpacing: "-0.035em", transform: `scale(${slam(frame, fps, AT.head1)})` }}>{T.head1}</p>
          <p style={{ ...HEAD, marginTop: 14, fontSize: 150, letterSpacing: "-0.04em", color: C.yellow, transform: `rotate(${-3 + shake(frame, AT.head2)}deg) scale(${slam(frame, fps, AT.head2)})` }}>{T.head2}</p>
        </div>
        <TimerPill time={clock(frame)} label={T.timerLabel} style={{ left: 540, top: 650, transform: `translateX(-50%) scale(${1.35 * pop(frame, fps, AT.timer)})` }} />
      </div>
      <EndCard
        ground={C.blue}
        ink="#FFFFFF"
        puhu="koruma"
        enter={VIDEO.endCardFrom}
        tag={<span style={{ display: "inline-block", fontSize: 64, fontWeight: 1000, letterSpacing: "-0.02em", color: C.yellow, transform: "rotate(-2deg)" }}>{T.end}</span>}
      />
    </Frame>
  );
}
