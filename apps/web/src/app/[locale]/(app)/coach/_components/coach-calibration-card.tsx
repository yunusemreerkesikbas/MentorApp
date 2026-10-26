"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CoachDirectnessPreference,
  CoachMemoryConsent,
  CoachSupportPreference,
} from "@mentor/types";
import type { ReactNode } from "react";
import { PuhuImage } from "@/components/puhu-image";
import { fetchCoachProfile, patchCoachProfile } from "@/lib/coach";

/** First-visit chat preferences. `children` (the landing's big Puhu) shows whenever the card does not. */
export function CoachCalibrationCard({ children }: { children?: ReactNode }) {
  const t = useTranslations("coach_chat.calibration");
  const [visible, setVisible] = useState(false);
  const [support, setSupport] = useState<CoachSupportPreference | null>(null);
  const [directness, setDirectness] =
    useState<CoachDirectnessPreference | null>(null);
  const [memory, setMemory] = useState<CoachMemoryConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCoachProfile()
      .then((profile) => {
        if (!active) return;
        setSupport(profile.supportPreference);
        setDirectness(profile.directnessPreference);
        setMemory(
          profile.memoryConsent === "PENDING" ? null : profile.memoryConsent,
        );
        setVisible(
          profile.calibrationStatus === "NOT_STARTED" ||
            profile.calibrationStatus === "IN_PROGRESS",
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return children ?? null;

  async function save(skip = false) {
    setBusy(true);
    setError(false);
    try {
      await patchCoachProfile(
        skip
          ? { calibrationStatus: "SKIPPED" }
          : {
              calibrationStatus: "COMPLETED",
              ...(support ? { supportPreference: support } : {}),
              ...(directness ? { directnessPreference: directness } : {}),
              ...(memory ? { memoryConsent: memory } : {}),
            },
      );
      setVisible(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-coach-calibration className="mb-3 w-full max-w-lg rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] p-4 text-left shadow-[var(--shadow-card)] backdrop-blur-md sm:p-5">
      {/* Puhu asks the question here; the big landing Puhu steps aside while the card is open. */}
      <div className="flex items-center gap-3">
        <PuhuImage variant="encouraging" size={44} className="shrink-0" />
        <div className="min-w-0">
          <h3
            className="text-[15px] font-bold leading-5 text-[var(--color-main)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("title")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-secondary)]">{t("intro")}</p>
        </div>
      </div>
      <div className="mt-2.5 divide-y divide-[color-mix(in_srgb,var(--color-main)_8%,transparent)]">
        <ChoiceRow
          label={t("support_question")}
          value={support}
          onChange={(value) => setSupport(value as CoachSupportPreference)}
          options={[
            ["EMOTIONAL", t("support_emotional")],
            ["BALANCED", t("support_balanced")],
            ["ACTION", t("support_action")],
          ]}
        />
        <ChoiceRow
          label={t("directness_question")}
          value={directness}
          onChange={(value) => setDirectness(value as CoachDirectnessPreference)}
          options={[
            ["GENTLE", t("directness_gentle")],
            ["BALANCED", t("directness_balanced")],
            ["DIRECT", t("directness_direct")],
          ]}
        />
        <ChoiceRow
          label={t("memory_question")}
          hint={t("memory_hint")}
          value={memory}
          onChange={(value) => setMemory(value as CoachMemoryConsent)}
          options={[
            ["GRANTED", t("memory_yes")],
            ["DECLINED", t("memory_no")],
          ]}
        />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !support || !directness || !memory}
          onClick={() => void save()}
          className="min-h-11 cursor-pointer rounded-full bg-[var(--color-progress)] px-5 text-sm font-bold text-white shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none motion-reduce:transition-none"
        >
          {t("save")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(true)}
          className="min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-[var(--color-secondary)] transition-colors hover:text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50 motion-reduce:transition-none"
        >
          {t("skip")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {t("error")}
        </p>
      ) : null}
    </section>
  );
}

function ChoiceRow({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="py-2.5 first:pt-0">
      <legend className="float-left w-full text-sm font-semibold text-[var(--color-main)]">
        {label}
      </legend>
      {hint ? (
        <p className="clear-left pt-1 text-xs leading-4 text-[var(--color-secondary)]">{hint}</p>
      ) : null}
      {/* Same pills as the starter chips below; the chosen one takes the page's blue action ink. */}
      <div className="clear-left flex flex-wrap gap-2 pt-2">
        {options.map(([option, text]) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-[12px] font-semibold shadow-[var(--shadow-card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none ${selected ? "bg-[var(--color-progress)] text-white" : "bg-[var(--color-surface)] text-[var(--color-main)]"}`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
