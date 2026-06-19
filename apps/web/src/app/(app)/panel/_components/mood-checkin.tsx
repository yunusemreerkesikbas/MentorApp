"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { CoachAccessDto, MoodCheckinDto, MoodReflectionDto } from "@mentor/types";
import {
  aiChatControllerGetAccess,
  aiMoodControllerReflect,
  coachingControllerUpsertMood,
} from "@mentor/api-client";
import { Card, Chip, MoodPicker, SectionHeading } from "@mentor/ui";
import { FormError } from "../../../../components/form";

/**
 * Mood check-in — gentle daily prompt (plan §3 Slice 5 + W3 mood AI-adaptive layer).
 *
 * Free tier reads the rule-based, backend-localized encouragement verbatim (§4 #5). Premium users
 * additionally get an AI-adaptive reflection (`POST /v1/coach/mood-reflection`) and an optional
 * "zorlandığın konu" note that grounds it. The reflection is cached server-side per day, so a
 * re-fetch of an unchanged mood costs nothing.
 */
export function MoodCheckin({ initial }: { initial: MoodCheckinDto | null }) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [premium, setPremium] = useState<boolean | null>(null);
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [message, setMessage] = useState<string | null>(initial?.message ?? null);
  const [note, setNote] = useState<string>(initial?.struggleNote ?? "");
  const [reflection, setReflection] = useState<string | null>(initial?.aiReflection ?? null);
  const [reflecting, setReflecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generateReflection = useCallback(async () => {
    setReflecting(true);
    try {
      const res = (await aiMoodControllerReflect()) as unknown as
        | { data?: MoodReflectionDto }
        | MoodReflectionDto;
      const dto = (res as { data?: MoodReflectionDto }).data ?? (res as MoodReflectionDto);
      if (dto?.reflection) setReflection(dto.reflection);
    } catch {
      /* Fall back to the rule-based message; reflection is a premium enhancement, not critical. */
    } finally {
      setReflecting(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    aiChatControllerGetAccess()
      .then((res) => {
        if (!active) return;
        const access = (res as unknown as { data?: CoachAccessDto }).data ?? (res as unknown as CoachAccessDto);
        const isPremium = access?.mode === "PREMIUM";
        setPremium(isPremium);
        // Fetch cached reflection on load when premium + mood set but no reflection yet.
        if (isPremium && initial?.mood != null && initial.aiReflection == null) {
          void generateReflection();
        }
      })
      .catch(() => {
        if (active) setPremium(false);
      });
    return () => {
      active = false;
    };
  }, [generateReflection, initial?.aiReflection, initial?.mood]);

  async function saveMood(value: number, struggleNote: string) {
    setError(null);
    setBusy(true);
    try {
      const result = (await coachingControllerUpsertMood({
        mood: value,
        struggleNote: struggleNote.trim() || undefined,
      })) as unknown as MoodCheckinDto;
      setMood(result.mood);
      setMessage(result.message);
      setReflection(null); // mood/note changed → stale reflection cleared server-side too
      if (premium) await generateReflection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeading subtitle="Kısa bir check-in — yargılamıyoruz.">Bugün nasılsın?</SectionHeading>
      <div className={`mt-4 ${busy ? "pointer-events-none opacity-60" : ""}`} aria-busy={busy}>
        <MoodPicker value={mood} onChange={(v) => void saveMood(v, note)} />
      </div>

      {premium && mood != null ? (
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            Bugün seni en çok ne zorladı? (isteğe bağlı)
          </span>
          <textarea
            value={note}
            maxLength={280}
            rows={2}
            disabled={busy}
            placeholder="Örn. matematik problemleri, odaklanma…"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (mood != null && (note.trim() || initial?.struggleNote)) void saveMood(mood, note);
            }}
            className="resize-none rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border, #e2e2e2)", color: "var(--color-body)" }}
          />
        </label>
      ) : null}

      <FormError message={error} />

      {reflecting ? (
        <p className="mt-4 text-sm" role="status" style={{ color: "var(--color-secondary)" }}>
          Koçun düşünüyor…
        </p>
      ) : premium && reflection ? (
        <motion.div
          role="status"
          className="mt-4 flex flex-col gap-2"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Chip>Koçun</Chip>
          <p className="text-sm" style={{ color: "var(--color-body)" }}>
            {reflection}
          </p>
        </motion.div>
      ) : message ? (
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

      {premium === false && mood != null ? (
        <button
          type="button"
          onClick={() => router.push("/abonelik")}
          className="mt-3 text-left text-sm underline"
          style={{ color: "var(--color-secondary)" }}
        >
          Premium koç, ruh haline göre kişisel bir not bırakır →
        </button>
      ) : null}
    </Card>
  );
}
