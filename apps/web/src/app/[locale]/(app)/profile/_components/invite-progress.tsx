"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

/** How many joined friends are named; the rest is a "+N" so the hero stays compact. */
const NAMED_FRIENDS = 3;

interface InviteProgressProps {
  /** Everyone who joined with the code: the view's `joinedCount`, not the length of its 20-name list. */
  joined: number;
  /** Friends whose first payment stands. */
  converted: number;
  /** Display names of joined friends, newest first (the view's `joined`, live accounts only). */
  names: string[];
  reduceMotion: boolean | null;
}

/**
 * Progress as the inviter: one count line, then the newest friends by name with "+N" for the rest.
 * Friends may be named (they typed the code knowing it); who paid is never marked, it stays a count
 * (the card tells the friend this up front).
 */
export function InviteProgress({ joined, converted, names, reduceMotion }: InviteProgressProps) {
  const t = useTranslations("economy");
  const shown = names.slice(0, NAMED_FRIENDS);
  // The count is the truth: erased friends and anyone past the 20-name window are only in `joined`.
  const more = Math.max(0, joined - shown.length);

  return (
    <motion.div
      className="mt-1 flex flex-col items-center gap-2"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.34 }}
    >
      <p className="text-center text-sm font-semibold text-white">
        {joined === 0 ? t("invite_progress_empty") : t("invite_progress", { joined, converted })}
      </p>
      {shown.length > 0 ? (
        <ul aria-label={t("invite_joined_label")} className="flex flex-wrap justify-center gap-1.5">
          {shown.map((name, index) => (
            <li
              // Display names are not unique; the list order is the API's and never reorders in place.
              key={`${index}-${name}`}
              className="max-w-40 truncate rounded-full bg-white/15 px-2.5 py-1 text-caption font-bold text-white"
            >
              {name}
            </li>
          ))}
          {more > 0 ? (
            <li className="rounded-full bg-white/10 px-2.5 py-1 text-caption font-bold text-white/90">
              <span aria-hidden>{t("invite_joined_more", { count: more })}</span>
              <span className="sr-only">{t("invite_joined_more_label", { count: more })}</span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </motion.div>
  );
}
