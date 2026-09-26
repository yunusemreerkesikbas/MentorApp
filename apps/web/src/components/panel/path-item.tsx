import type { ReactNode } from "react";

/**
 * The path's shared anatomy (DESIGN.md §6.1): the student's day on `/panel` and, with its own node
 * tones, the coach's round. The node sizes live here so both paths step the same way.
 */
export const PATH_NODE_BASE =
  "relative grid shrink-0 place-items-center rounded-full outline-none transition-transform duration-[120ms] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-0.5 motion-reduce:transition-none";

export const PATH_NODE_TONE = {
  done: "size-12 bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)] sm:size-14",
  current:
    "size-16 bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_5px_0_var(--play-cta-edge),0_0_0_8px_var(--play-selected)] sm:size-[72px]",
  upcoming:
    "size-12 bg-[var(--play-track)] text-[var(--color-secondary)] shadow-[0_4px_0_color-mix(in_srgb,var(--play-track),var(--color-main)_12%)] sm:size-14",
} as const;

/** One stop. The connector to the previous stop is drawn by the stop itself, so no measuring. */
export function PathItem({
  index,
  reached,
  node,
  title,
  meta,
  tone = "play",
  animateReach = false,
}: {
  index: number;
  reached: boolean;
  node: ReactNode;
  title: string;
  meta?: ReactNode;
  /** The reached connector's ink: the student's sky blue, or the coach's ink blue on the round. */
  tone?: "play" | "coach";
  /** The connector fills toward this stop when it becomes reached (the coach's round). */
  animateReach?: boolean;
}) {
  const reachedClass = tone === "coach" ? "bg-[var(--coach-accent)]" : "bg-[var(--play-cta)]";
  const connector = "absolute right-1/2 top-[30px] z-0 h-1 w-full rounded-full sm:top-[34px]";
  return (
    <li className="relative flex w-[76px] shrink-0 flex-col items-center gap-2 px-1 text-center sm:w-auto sm:min-w-0 sm:flex-1">
      {index > 0 && animateReach ? (
        <span aria-hidden className={`${connector} bg-[var(--play-track)]`}>
          <span
            className={`block size-full origin-left rounded-full transition-[scale] duration-300 ease-[var(--ease-smooth-out)] motion-reduce:transition-none ${reachedClass} ${reached ? "scale-x-100" : "scale-x-0"}`}
          />
        </span>
      ) : index > 0 ? (
        <span
          aria-hidden
          className={`${connector} ${reached ? reachedClass : "bg-[var(--play-track)]"}`}
        />
      ) : null}
      <div className="relative z-[1] flex h-16 items-center sm:h-[72px]">
        {node}
      </div>
      <span className="line-clamp-2 w-full text-caption font-extrabold leading-tight text-[var(--color-main)]">
        {title}
      </span>
      {meta ? (
        <span className="-mt-1 w-full truncate text-xs font-semibold text-[var(--color-secondary)]">
          {meta}
        </span>
      ) : null}
    </li>
  );
}
