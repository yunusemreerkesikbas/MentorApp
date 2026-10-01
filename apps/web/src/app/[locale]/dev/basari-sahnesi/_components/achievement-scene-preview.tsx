"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AchievementCelebrationDto, AchievementId, AchievementView } from "@mentor/types";
import { Button } from "@mentor/ui";

import { AchievementCelebration } from "@/components/achievements/achievement-celebration";
import { UserAvatar } from "@/components/user-avatar";
import { installLastPointer } from "@/lib/last-pointer";

/** Sample data: the titles the API's catalog gives these achievements (tr). */
const SAMPLE_TITLES: Record<AchievementId, string> = {
  first_step: "İlk Adım",
  route_drawn: "Rotanı Çizdin",
  dream_space_created: "Hayaline Yer Açtın",
  rhythm_found: "Ritmi Yakaladın",
  rhythm_kept: "Ritmi Korudun",
  returned_to_path: "Kaldığın Yerden",
  route_renewed: "Rotayı Yeniledin",
  starting_point_set: "Başlangıç Noktan",
  mistake_revisited: "Bir Daha Baktın",
  week_reflected: "Haftana Kulak Verdin",
  first_hello: "İlk Merhaba",
  helped_someone: "Birine İyi Geldin",
};
const SAMPLE_IDS = Object.keys(SAMPLE_TITLES) as AchievementId[];
/** What the acknowledge request would take on a good connection. */
const FAKE_REQUEST_MS = 350;

type Mode = "single" | "deck-3" | "deck-7";

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: "single", label: "Tek başarı" },
  { value: "deck-3", label: "Deste (3)" },
  { value: "deck-7", label: "Deste (7)" },
];

function sample(id: AchievementId): AchievementView {
  return {
    id,
    title: SAMPLE_TITLES[id],
    description: "Örnek veri",
    unlockHint: "Örnek veri",
    artKey: id,
    status: "EARNED",
    earnedAt: new Date(0).toISOString(),
    progress: null,
  };
}

function celebrationFor(mode: Mode, id: AchievementId): AchievementCelebrationDto {
  if (mode === "single") return { kind: "ACHIEVEMENT", items: [sample(id)] };
  const count = mode === "deck-3" ? 3 : 7;
  return { kind: "BACKFILL_SUMMARY", items: SAMPLE_IDS.slice(0, count).map(sample) };
}

const FIELD = "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-bold";

/**
 * A stand-in for the panel: the avatar the badge flies home to, a task to mark done and the
 * preview's own settings. The close request is faked; "Kapanış bir kez hata versin" shows the
 * failed-close path.
 */
export function AchievementScenePreview() {
  const t = useTranslations("achievements");
  const [mode, setMode] = useState<Mode>("single");
  const [id, setId] = useState<AchievementId>("rhythm_found");
  const [failOnce, setFailOnce] = useState(false);
  const [run, setRun] = useState<{ key: number; celebration: AchievementCelebrationDto } | null>(null);
  const [runs, setRuns] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The spark leaves from the "Bitti olarak işaretle" press, as it does on the panel.
  useEffect(() => installLastPointer(), []);

  function start() {
    setError(null);
    setRuns((count) => count + 1);
    setRun({ key: runs + 1, celebration: celebrationFor(mode, id) });
  }

  function close() {
    if (busy) return;
    setBusy(true);
    setError(null);
    window.setTimeout(() => {
      setBusy(false);
      if (failOnce) {
        setFailOnce(false);
        setError(t("celebration_close_error"));
        return;
      }
      setRun(null);
    }, FAKE_REQUEST_MS);
  }

  const done = run !== null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <span data-achievement-home="" className="shrink-0 rounded-full">
          <UserAvatar name="Selin Kaya" size={44} />
        </span>
        <div className="min-w-0">
          <p className="text-base font-extrabold text-[var(--color-main)]">Günaydın, Selin</p>
          <p className="text-caption font-semibold text-[var(--color-secondary)]">Başarı sahnesi önizlemesi</p>
        </div>
      </header>

      <section className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <p className="text-caption font-extrabold text-[var(--color-secondary)]">Bugün</p>
        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`grid size-10 shrink-0 place-items-center rounded-full ${done ? "bg-[var(--play-cta)] text-[var(--play-cta-ink)]" : "bg-[var(--play-track)] text-[var(--color-secondary)]"}`}
          >
            <Check size={20} strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[var(--color-main)]">Paragraf: 20 soru</p>
            <p className="text-caption font-semibold text-[var(--color-secondary)]">{done ? "Bitti" : "Sıradaki"}</p>
          </div>
        </div>
        <Button className="mt-4" fullWidth onClick={start} disabled={done}>
          Bitti olarak işaretle
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-4">
        <p className="text-caption font-extrabold text-[var(--color-secondary)]">Önizleme ayarları</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kutlama türü">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
              className={`${FIELD} ${mode === option.value ? "border-[var(--play-cta)] text-[var(--color-main)]" : "text-[var(--color-secondary)]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-caption font-bold text-[var(--color-secondary)]">
          Başarı
          <select
            id="achievement-preview-id"
            value={id}
            disabled={mode !== "single"}
            onChange={(event) => setId(event.target.value as AchievementId)}
            className={`${FIELD} text-[var(--color-main)] disabled:opacity-50`}
          >
            {SAMPLE_IDS.map((value) => (
              <option key={value} value={value}>
                {SAMPLE_TITLES[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-main)]">
          <input
            id="achievement-preview-fail"
            type="checkbox"
            checked={failOnce}
            onChange={(event) => setFailOnce(event.target.checked)}
            className="size-4 accent-[var(--play-cta)]"
          />
          Kapanış bir kez hata versin
        </label>
        <p className="text-caption font-semibold text-[var(--color-secondary)]">
          Hareketi azaltma işletim sisteminin ayarını izler. Ses, ilk dokunuştan sonra açılır.
        </p>
      </section>

      <AnimatePresence initial={false} mode="wait">
        {run ? (
          <AchievementCelebration
            key={`preview-${run.key}`}
            celebration={run.celebration}
            busy={busy}
            error={error}
            onClose={close}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}
