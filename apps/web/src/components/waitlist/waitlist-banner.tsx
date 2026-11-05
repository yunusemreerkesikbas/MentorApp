"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

/** Art + status badge above the title. W1 while waiting for the address, W2 once it is in. */
export function WaitlistBanner({ success, badge }: { success: boolean; badge: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-4 lg:gap-4.5">
      <div className="lw-art relative overflow-hidden rounded-[var(--play-radius)] bg-[var(--landing-night-top)]">
        <Image
          key={success ? "w2" : "w1"}
          src={success ? "/visuals/waitlist/w2.webp" : "/visuals/waitlist/w1.webp"}
          alt=""
          fill
          sizes="(min-width: 1024px) 392px, 100vw"
          className={`object-cover ${success ? "object-[50%_40%]" : "object-[50%_30%]"}`}
        />
        {/* The room's lamp coming on. A still card under reduced motion: no glow at all. */}
        {success && !reduceMotion ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_10px_var(--lw-glow)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null}
      </div>
      <span
        className={`self-start rounded-full border px-3 py-1 text-caption ${
          success
            ? "border-transparent bg-[var(--landing-lamp)] font-black text-[var(--lw-field-ink)]"
            : "border-[var(--landing-lamp-line)] font-extrabold text-[var(--landing-lamp)]"
        }`}
      >
        {badge}
      </span>
    </div>
  );
}
