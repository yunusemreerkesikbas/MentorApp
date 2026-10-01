/**
 * The avatar takes the light: one pulse per badge that lands in it, the last one strongest. It runs
 * on the Web Animations API, so it finishes on its own after the scene has unmounted.
 */
import { CHOREO, type SceneLight } from "./scene-choreography";
import { rgba } from "./scene-engine";
import { KICK } from "./scene-poses";

const PULSE_SECONDS = 0.9;
const STEPS = 24;
/** Scale gained per unit of the pulse spring's kick. */
const PULSE_SCALE = 0.26;

function pulse(node: HTMLElement, glow: string, weight: number): void {
  const frames = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = (i / STEPS) * PULSE_SECONDS;
    const light = weight * Math.exp(-2.4 * t) * (1 - t / PULSE_SECONDS);
    return {
      transform: `scale(${1 + PULSE_SCALE * weight * KICK.pulse(t)})`,
      boxShadow: `0 0 ${18 * light}px ${6 * light}px ${rgba(glow, 0.55 * light)}`,
    };
  });
  node.animate(frames, { duration: PULSE_SECONDS * 1000, easing: "linear" });
}

/** Schedules the arrivals of a flight that starts now; returns the cancel. */
export function scheduleHomePulses(node: HTMLElement, lights: ReadonlyArray<SceneLight>): () => void {
  if (typeof node.animate !== "function" || lights.length === 0) return () => undefined;
  const { launch, flight, stagger } = CHOREO.exit;
  const timers = lights.map((light, i) =>
    window.setTimeout(
      () => pulse(node, light.glow, i === lights.length - 1 ? 1 : 0.5),
      (launch + flight + i * stagger) * 1000,
    ),
  );
  return () => timers.forEach((timer) => window.clearTimeout(timer));
}
