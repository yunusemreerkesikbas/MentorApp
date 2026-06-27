import Image from "next/image";

export type PuhuVariant =
  | "default"
  | "encouraging"
  | "happy"
  | "proud"
  | "surprised"
  | "winking";

const FILE_BY_VARIANT: Record<PuhuVariant, string> = {
  default: "puhu-default.png",
  encouraging: "puhu-encouraging.png",
  happy: "puhu-happy.png",
  proud: "puhu-proud.png",
  surprised: "puhu-surprised.png",
  winking: "puhu-happy.png",
};

export function PuhuImage({
  variant,
  size = 120,
  className,
}: {
  variant: PuhuVariant;
  size?: number;
  className?: string;
}) {
  const src = `/mascot/puhu/${FILE_BY_VARIANT[variant]}`;

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      aria-hidden
      priority
      className={`h-auto max-w-full ${className ?? ""}`}
      style={{ width: size, height: "auto" }}
    />
  );
}
