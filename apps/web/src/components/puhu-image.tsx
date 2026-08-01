import Image from "next/image";
import type { CareerGroup } from "@mentor/types";

export type PuhuVariant =
  | "default"
  | "encouraging"
  | "happy"
  | "host"
  | "premium"
  | "proud"
  | "surprised"
  | "winking";

/** DESIGN.md §8.2 — companion size scale. */
export const PUHU_SIZES = {
  sm: 40,
  md: 72,
  lg: 120,
} as const;

export type PuhuSizeToken = keyof typeof PUHU_SIZES;

const FILE_BY_VARIANT: Record<PuhuVariant, string> = {
  default: "puhu-default.png",
  encouraging: "puhu-encouraging.png",
  happy: "puhu-happy.png",
  host: "puhu-host.png",
  premium: "puhu-premium.png",
  proud: "puhu-proud.png",
  surprised: "puhu-surprised.png",
  winking: "puhu-happy.png",
};

/**
 * Flip to `true` once the ten career illustrations land in `public/mascot/puhu/career/`
 * (one per CareerGroup, lower-cased slug + `.png`). Until then the career prop is accepted and
 * stored but falls back to the variant artwork — next/image hard-errors on a missing file, so
 * without this gate picking a career would render a broken image instead of just not changing.
 */
const CAREER_ART_AVAILABLE = false;

function resolvePuhuSize(size: PuhuSizeToken | number): number {
  return typeof size === "number" ? size : PUHU_SIZES[size];
}

export function PuhuImage({
  variant,
  career = null,
  size = "lg",
  className,
  priority = false,
}: {
  variant: PuhuVariant;
  /**
   * Career field the user is aiming for. When set, it REPLACES the variant artwork with a
   * dedicated illustration — the career art is drawn from the `default` pose, so it carries no
   * expression of its own. Ten finished files rather than an accessory overlay: an overlay
   * anchored for one pose drifts on the other seven, and this way the illustrator owns the result.
   */
  career?: CareerGroup | null;
  /** Token (`sm`/`md`/`lg`) or raw px for special layouts (mood wheel, onboarding). */
  size?: PuhuSizeToken | number;
  className?: string;
  priority?: boolean;
}) {
  const px = resolvePuhuSize(size);
  const src =
    career && CAREER_ART_AVAILABLE
      ? `/mascot/puhu/career/${career.toLowerCase()}.png`
      : `/mascot/puhu/${FILE_BY_VARIANT[variant]}`;

  return (
    <Image
      src={src}
      alt=""
      width={px}
      height={px}
      aria-hidden
      priority={priority}
      className={className}
      style={{ width: px, height: "auto", maxWidth: "100%" }}
    />
  );
}
