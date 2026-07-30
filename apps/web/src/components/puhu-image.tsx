import Image from "next/image";

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

function resolvePuhuSize(size: PuhuSizeToken | number): number {
  return typeof size === "number" ? size : PUHU_SIZES[size];
}

export function PuhuImage({
  variant,
  size = "lg",
  className,
  priority = false,
}: {
  variant: PuhuVariant;
  /** Token (`sm`/`md`/`lg`) or raw px for special layouts (mood wheel, onboarding). */
  size?: PuhuSizeToken | number;
  className?: string;
  priority?: boolean;
}) {
  const px = resolvePuhuSize(size);
  const src = `/mascot/puhu/${FILE_BY_VARIANT[variant]}`;

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
