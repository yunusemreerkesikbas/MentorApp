"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CoachDirectnessPreference,
  CoachMemoryConsent,
  CoachSupportPreference,
} from "@mentor/types";
import { fetchCoachProfile, patchCoachProfile } from "@/lib/coach";

export function CoachCalibrationCard() {
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

  if (!visible) return null;

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
    <section className="mb-3 w-full max-w-lg rounded-[var(--radius-card)] bg-white/85 p-4 text-left shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-[var(--color-main)]">
        {t("intro")}
      </p>
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
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy || !support || !directness || !memory}
          onClick={() => void save()}
          className="min-h-10 rounded-full bg-[var(--color-main)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {t("save")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(true)}
          className="min-h-10 rounded-full border px-4 text-sm font-semibold text-[var(--color-main)] disabled:opacity-50"
          style={{ borderColor: "var(--color-border)" }}
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
    <fieldset className="mt-3">
      <legend className="text-sm font-medium text-[var(--color-body-text)]">
        {label}
      </legend>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--color-secondary)]">{hint}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className="min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              borderColor:
                value === option
                  ? "var(--color-progress)"
                  : "var(--color-border)",
              backgroundColor:
                value === option ? "var(--color-surface-container)" : "white",
              color: "var(--color-main)",
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
