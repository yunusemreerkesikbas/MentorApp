"use client";

import { useEffect, useState, type RefObject } from "react";

import type { HomeTarget } from "./scene-frame";
import type { StageGeometry } from "./scene-poses";

export interface SceneGeometry extends StageGeometry {
  /** The avatar the badge flies home to; `null` where none is on screen. */
  home: HomeTarget | null;
}

/** Marks the avatar a celebration flies into (mobile header and desktop sidebar). */
export const ACHIEVEMENT_HOME_SELECTOR = "[data-achievement-home]";

/** The avatar on screen right now (the header one on phones, the sidebar one on desktop). */
export function findHomeNode(frame: DOMRect): { node: HTMLElement; target: HomeTarget } | null {
  for (const node of document.querySelectorAll<HTMLElement>(ACHIEVEMENT_HOME_SELECTOR)) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const center = { x: rect.left + rect.width / 2 - frame.left, y: rect.top + rect.height / 2 - frame.top };
    if (center.x < 0 || center.y < 0 || center.x > frame.width || center.y > frame.height) continue;
    return { node, target: { center, size: Math.min(rect.width, rect.height) } };
  }
  return null;
}

function measure(root: HTMLElement, slot: HTMLElement): SceneGeometry | null {
  const frame = root.getBoundingClientRect();
  const box = slot.getBoundingClientRect();
  if (frame.width === 0 || frame.height === 0 || box.width === 0) return null;
  return {
    viewport: { width: frame.width, height: frame.height },
    center: { x: box.left + box.width / 2 - frame.left, y: box.top + box.height / 2 - frame.top },
    size: box.width,
    home: findHomeNode(frame)?.target ?? null,
  };
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;

function same(a: SceneGeometry | null, b: SceneGeometry): boolean {
  if (!a) return false;
  const home = a.home === b.home || (!!a.home && !!b.home && near(a.home.center.x, b.home.center.x) && near(a.home.center.y, b.home.center.y) && near(a.home.size, b.home.size));
  return (
    home &&
    near(a.viewport.width, b.viewport.width) &&
    near(a.viewport.height, b.viewport.height) &&
    near(a.center.x, b.center.x) &&
    near(a.center.y, b.center.y) &&
    near(a.size, b.size)
  );
}

/**
 * Where the badge lives on this screen: the centre and edge of its slot in the layout, the
 * viewport, and the avatar it flies home to. Measured by ResizeObserver (which also delivers the
 * first measurement), so a rotation or a resize re-aims every light in the scene.
 */
export function useSceneGeometry(
  rootRef: RefObject<HTMLElement | null>,
  slotRef: RefObject<HTMLElement | null>,
  copyRef: RefObject<HTMLElement | null>,
): SceneGeometry | null {
  const [geometry, setGeometry] = useState<SceneGeometry | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const slot = slotRef.current;
    if (!root || !slot) return;
    const update = () => {
      const next = measure(root, slot);
      if (next) setGeometry((previous) => (same(previous, next) ? previous : next));
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(slot);
    // The copy's height moves the slot on wide screens, where the group is centred.
    if (copyRef.current) observer.observe(copyRef.current);
    return () => observer.disconnect();
  }, [rootRef, slotRef, copyRef]);

  return geometry;
}
