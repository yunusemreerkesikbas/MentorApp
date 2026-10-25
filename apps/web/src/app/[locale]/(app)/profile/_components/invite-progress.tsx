"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface InviteProgressProps {
  /** Friends who joined with the code (the view lists at most 20 names, so it is a floor). */
  joined: number;
  /** Friends whose first payment stands. */
  converted: number;
  reduceMotion: boolean | null;
}

/**
 * One line of progress as the inviter: counts only. Names stay on the server side of the view and
 * the Premium count is a number, never a person (the card tells the friend this up front).
 */
export function InviteProgress({ joined, converted, reduceMotion }: InviteProgressProps) {
  const t = useTranslations("economy");
  // Past the 20 listed names the converted count can outgrow the joined one; never print less
  // joined friends than paying ones.
  const joinedCount = Math.max(joined, converted);

  return (
    <motion.p
      className="mt-1 text-center text-sm font-semibold text-white"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.34 }}
    >
      {joinedCount === 0
        ? t("invite_progress_empty")
        : t("invite_progress", { joined: joinedCount, converted })}
    </motion.p>
  );
}
