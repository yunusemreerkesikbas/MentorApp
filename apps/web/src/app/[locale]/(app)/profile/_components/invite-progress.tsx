"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface InviteProgressProps {
  /** Everyone who joined with the code: the view's `joinedCount`, not the length of its 20-name list. */
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

  return (
    <motion.p
      className="mt-1 text-center text-sm font-semibold text-white"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.34 }}
    >
      {joined === 0 ? t("invite_progress_empty") : t("invite_progress", { joined, converted })}
    </motion.p>
  );
}
