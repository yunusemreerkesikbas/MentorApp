"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { LAMP_ART } from "./desk-lamp";

/**
 * Aims the desk at a notebook: the lamp turns its head to it, the pool of light slides under it,
 * the cone between them reshapes, and Puhu looks over.
 *
 * All of it is written straight onto the scene as CSS custom properties (and one data attribute on
 * Puhu) instead of React state. It follows the pointer from book to book, and every change of it
 * would otherwise re-render a desk of twelve 3D notebooks to move one gradient.
 */

interface Point {
  x: number;
  y: number;
}

export interface DeskLightTargets {
  /** The notebook the light rests on: the one under the hand, else the one Puhu put there. */
  litId: string | null;
  /** The notebook under the hand or keyboard focus, which is what Puhu's eyes follow. */
  activeId: string | null;
}

/** Book frames by notebook id, filled by callback refs as the desk renders. */
export function useDeskFrames() {
  const frames = useRef(new Map<string, HTMLElement>());
  const setters = useRef(new Map<string, (element: HTMLElement | null) => void>());
  const register = useCallback((id: string) => {
    let setter = setters.current.get(id);
    if (!setter) {
      setter = (element: HTMLElement | null) => {
        if (element) frames.current.set(id, element);
        else frames.current.delete(id);
      };
      setters.current.set(id, setter);
    }
    return setter;
  }, []);
  return { frames, register };
}

function polygon(points: Point[]): string {
  return `polygon(${points.map((point) => `${point.x.toFixed(1)}px ${point.y.toFixed(1)}px`).join(", ")})`;
}

const EMPTY_CONE = "polygon(0px 0px, 0px 0px, 0px 0px)";

export function useDeskLight({
  sceneRef,
  lampRef,
  puhuRef,
  frames,
  targets,
  layoutKey,
}: {
  sceneRef: RefObject<HTMLElement | null>;
  lampRef: RefObject<SVGSVGElement | null>;
  puhuRef: RefObject<HTMLElement | null>;
  frames: RefObject<Map<string, HTMLElement>>;
  targets: DeskLightTargets;
  /** Anything that moves the books around (the list itself): re-aims when it changes. */
  layoutKey: string;
}) {
  const { litId, activeId } = targets;

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const aim = () => {
      const sceneBox = scene.getBoundingClientRect();
      const local = (box: DOMRect): Point => ({
        x: box.left - sceneBox.left + box.width / 2,
        y: box.top - sceneBox.top + box.height / 2,
      });

      const lit = litId ? frames.current.get(litId) : undefined;
      if (!lit) {
        scene.style.setProperty("--desk-cone", EMPTY_CONE);
        return;
      }
      const litBox = lit.getBoundingClientRect();
      const target = local(litBox);
      scene.style.setProperty("--desk-light-x", `${target.x.toFixed(1)}px`);
      scene.style.setProperty("--desk-light-y", `${target.y.toFixed(1)}px`);
      // The pool is sized to the book it lights, so a phone's small books get a small lamp's pool.
      scene.style.setProperty("--desk-pool-w", `${(litBox.width * 3.1).toFixed(0)}px`);
      scene.style.setProperty("--desk-pool-h", `${(litBox.width * 2.3).toFixed(0)}px`);

      const lamp = lampRef.current;
      const lampBox = lamp?.getBoundingClientRect();
      if (lamp && lampBox && lampBox.width > 0) {
        const scale = lampBox.width / LAMP_ART.size;
        const toScene = (point: Point): Point => ({
          x: lampBox.left - sceneBox.left + point.x * scale,
          y: lampBox.top - sceneBox.top + point.y * scale,
        });
        const pivot = toScene(LAMP_ART.pivot);
        const wanted =
          (Math.atan2(target.y - pivot.y, target.x - pivot.x) * 180) / Math.PI;
        const turn = Math.max(
          -LAMP_ART.maxTurn,
          Math.min(LAMP_ART.maxTurn, wanted - LAMP_ART.restAngle),
        );
        scene.style.setProperty("--desk-lamp-turn", `${turn.toFixed(2)}deg`);

        // The shade's mouth after the turn, in scene pixels.
        const radians = (turn * Math.PI) / 180;
        const turned = LAMP_ART.mouth.map((point) => {
          const dx = point.x - LAMP_ART.pivot.x;
          const dy = point.y - LAMP_ART.pivot.y;
          return toScene({
            x: LAMP_ART.pivot.x + dx * Math.cos(radians) - dy * Math.sin(radians),
            y: LAMP_ART.pivot.y + dx * Math.sin(radians) + dy * Math.cos(radians),
          });
        });
        const [edgeA, edgeB] = turned as [Point, Point];
        const mouth = { x: (edgeA.x + edgeB.x) / 2, y: (edgeA.y + edgeB.y) / 2 };
        const length = Math.hypot(target.x - mouth.x, target.y - mouth.y) || 1;
        const along = { x: (target.x - mouth.x) / length, y: (target.y - mouth.y) / length };
        const across = { x: -along.y, y: along.x };
        // The cone lands around the book and a little past it, the way a pool spills over an edge.
        const spread = litBox.width * 0.62;
        const far = (side: 1 | -1): Point => ({
          x: target.x + across.x * spread * side + along.x * spread * 0.55,
          y: target.y + across.y * spread * side + along.y * spread * 0.55,
        });
        // Keep the polygon from crossing itself: each mouth edge goes to the far side it faces.
        const edgeBFacesPlus =
          (edgeB.x - edgeA.x) * across.x + (edgeB.y - edgeA.y) * across.y > 0;
        const cone = edgeBFacesPlus
          ? [edgeA, edgeB, far(1), far(-1)]
          : [edgeA, edgeB, far(-1), far(1)];
        scene.style.setProperty("--desk-cone", polygon(cone));
      } else {
        scene.style.setProperty("--desk-cone", EMPTY_CONE);
      }

      const puhu = puhuRef.current;
      if (puhu) {
        const active = activeId ? frames.current.get(activeId) : undefined;
        if (!active) {
          puhu.dataset.gaze = "ahead";
        } else {
          const eyes = local(puhu.getBoundingClientRect());
          const looked = local(active.getBoundingClientRect());
          puhu.dataset.gaze = looked.x < eyes.x - 24 ? "left" : "right";
        }
      }
    };

    aim();
    const observer = new ResizeObserver(aim);
    observer.observe(scene);
    return () => observer.disconnect();
  }, [sceneRef, lampRef, puhuRef, frames, litId, activeId, layoutKey]);
}
