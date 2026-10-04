"use client";

import type { RefObject } from "react";
import { Button } from "@mentor/ui";

export interface SceneText {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
}

/**
 * The words of the scene. They are in the DOM from the first frame (the dialog is named by the
 * title and described by the body) and the frame painter brings them in: the eyebrow, the title
 * word by word, the body, then the ledge rising from below.
 */
export function SceneCopy({
  text,
  titleId,
  bodyId,
  copyRef,
}: {
  text: SceneText;
  titleId: string;
  bodyId: string;
  copyRef: RefObject<HTMLDivElement | null>;
}) {
  const words = text.title.split(/\s+/).filter(Boolean);
  return (
    <div ref={copyRef} className="relative mt-9 w-full max-w-md text-center">
      <p data-scene="eyebrow" className="text-caption font-extrabold text-[var(--achievement-eyebrow)] opacity-0">
        {text.eyebrow}
      </p>
      <h2 id={titleId} className="mt-1.5 text-display font-extrabold tracking-[-0.01em] text-balance">
        {words.map((word, i) => (
          <span key={`${word}-${i}`}>
            {i > 0 ? " " : null}
            <span data-scene="word" className="inline-block origin-[50%_70%] opacity-0">
              {word}
            </span>
          </span>
        ))}
      </h2>
      <p
        id={bodyId}
        data-scene="body"
        className="mx-auto mt-3 max-w-sm text-body-sm font-semibold text-pretty text-[var(--color-body)] opacity-0"
      >
        {text.body}
      </p>
    </div>
  );
}

/**
 * "Devam edelim" on its ledge, plus the line that explains a close that did not go through. The
 * ledge stays `inert` until it has risen and settled; the scene focuses it by `data-scene="cta"`.
 */
export function SceneLedge({
  label,
  ready,
  error,
  onPress,
}: {
  label: string;
  ready: boolean;
  error: string | null;
  onPress: () => void;
}) {
  return (
    <div className="pointer-events-auto mt-auto w-full max-w-sm pt-6 sm:mt-8">
      <div data-scene="ledge" className="group opacity-0" inert={!ready}>
        <Button
          data-scene="cta"
          fullWidth
          onClick={onPress}
          className="group-data-[pressed=true]:translate-y-1 group-data-[pressed=true]:shadow-none"
        >
          {label}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-center text-sm text-[var(--color-body)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
