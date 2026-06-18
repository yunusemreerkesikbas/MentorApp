"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { MoodCheckinDto } from "@mentor/types";
import { coachingControllerUpsertMood } from "@mentor/api-client";
import { Card, MoodPicker, SectionHeading } from "@mentor/ui";
import { FormError } from "../../../../components/form";

/**
 * Mood check-in — client container for the gentle daily prompt (plan §3 Slice 5).
 *
 * Selection POSTs to `/v1/coaching/mood-checkins`; the encouraging reply is read
 * verbatim from the response (rule-based + backend-localized).
 */
export function MoodCheckin({ initial }: { initial: MoodCheckinDto | null }) {
  const reduceMotion = useReducedMotion();
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [message, setMessage] = useState<string | null>(initial?.message ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onMoodChange(value: number) {
    setMood(value);
    setError(null);
    setBusy(true);

    try {
      const result = (await coachingControllerUpsertMood({ mood: value })) as unknown as MoodCheckinDto;
      setMood(result.mood);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeading subtitle="Kısa bir check-in — yargılamıyoruz.">
        Bugün nasılsın?
      </SectionHeading>
      <div
        className={`mt-4 ${busy ? "pointer-events-none opacity-60" : ""}`}
        aria-busy={busy}
      >
        <MoodPicker value={mood} onChange={(v) => void onMoodChange(v)} />
      </div>
      <FormError message={error} />
      {message ? (
        <motion.p
          role="status"
          className="mt-4 text-sm"
          style={{ color: "var(--color-body)" }}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {message}
        </motion.p>
      ) : null}
    </Card>
  );
}
