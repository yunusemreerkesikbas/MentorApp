"use client";
import { Brain } from "lucide-react";
import { CloseIcon } from "@solar-icons/react/linear/close";
import { Pen2Icon } from "@solar-icons/react/linear/pen-2";
import { TrashBinMinimalisticIcon } from "@solar-icons/react/linear/trash-bin-minimalistic";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup, Toggle } from "@mentor/ui";
import type { CoachMemoryFactDto, CoachProfileDto } from "@mentor/types";
import { useIsMounted } from "@/lib/use-is-mounted";
import {
  clearCoachMemories,
  fetchCoachProfile,
  forgetCoachMemory,
  listCoachMemories,
  patchCoachProfile,
  updateCoachMemory,
} from "@/lib/coach";
import { trackCoachEvent } from "@/lib/analytics";

const MEMORY_OPTIONS: Partial<
  Record<CoachMemoryFactDto["key"], readonly string[]>
> = {
  STUDY_TIME: ["MORNING", "AFTERNOON", "EVENING", "LATE_NIGHT"],
  RESPONSE_PREFERENCE: ["SHORT", "BALANCED", "DETAILED"],
  CHALLENGE_CATEGORY: [
    "FOCUS",
    "PROCRASTINATION",
    "ANXIETY",
    "CONSISTENCY",
    "PLANNING",
  ],
};

export function CoachMemoryDialog() {
  const t = useTranslations("coach_chat.memory");
  const mounted = useIsMounted();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<CoachProfileDto | null>(null);
  const [facts, setFacts] = useState<CoachMemoryFactDto[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState(false);
  const [mutating, setMutating] = useState(false);

  async function show() {
    setOpen(true);
    setLoading(true);
    setError(false);
    try {
      const [nextProfile, memories] = await Promise.all([
        fetchCoachProfile(),
        listCoachMemories(),
      ]);
      setProfile(nextProfile);
      setFacts(memories.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggleMemory() {
    if (!profile) return;
    setMutating(true);
    setError(false);
    try {
      const next = await patchCoachProfile({
        memoryConsent:
          profile.memoryConsent === "GRANTED" ? "DECLINED" : "GRANTED",
      });
      setProfile(next);
      trackCoachEvent("coach_v2_memory_management", {
        operation: next.memoryConsent === "GRANTED" ? "ENABLE" : "PAUSE",
      });
    } catch {
      setError(true);
    } finally {
      setMutating(false);
    }
  }

  async function saveFact(fact: CoachMemoryFactDto) {
    setMutating(true);
    setError(false);
    try {
      const updated = await updateCoachMemory(fact.id, { value: editValue });
      setFacts((current) =>
        current.map((item) => (item.id === fact.id ? updated : item)),
      );
      setEditingId(null);
      trackCoachEvent("coach_v2_memory_management", { operation: "EDIT" });
    } catch {
      setError(true);
    } finally {
      setMutating(false);
    }
  }

  async function forget(id: string) {
    setMutating(true);
    setError(false);
    try {
      await forgetCoachMemory(id);
      setFacts((current) => current.filter((item) => item.id !== id));
      trackCoachEvent("coach_v2_memory_management", { operation: "FORGET" });
    } catch {
      setError(true);
    } finally {
      setMutating(false);
    }
  }

  async function clearAll() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setMutating(true);
    setError(false);
    try {
      await clearCoachMemories();
      setFacts([]);
      setConfirmClear(false);
      trackCoachEvent("coach_v2_memory_management", {
        operation: "CLEAR_ALL",
      });
    } catch {
      setError(true);
    } finally {
      setMutating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void show()}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        <Brain className="size-[18px] shrink-0" aria-hidden />
        {t("trigger")}
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/40 backdrop-blur-[4px]"
                aria-label={t("close")}
                onClick={() => setOpen(false)}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="coach-memory-title"
                className="relative z-[101] flex max-h-[80dvh] w-full max-w-lg flex-col rounded-[var(--radius-card)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2
                      id="coach-memory-title"
                      className="text-lg font-bold text-[var(--color-main)]"
                    >
                      {t("title")}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-secondary)]">
                      {t("description")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("close")}
                    className="-mr-1.5 -mt-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] hover:text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                  >
                    <CloseIcon size={20} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>

                {loading ? (
                  <div className="mt-5 grid gap-2">
                    <SkeletonGroup label={t("loading")}>
                      <Skeleton className="h-16 rounded-[var(--radius-card)]" />
                      <Skeleton className="h-16 rounded-[var(--radius-card)]" />
                    </SkeletonGroup>
                  </div>
                ) : (
                  <div className="mt-5 min-h-0 overflow-y-auto mentor-scrollarea">
                    {/* Consent is an on/off setting, so it reads as the settings page's switch row
                        rather than a grey slab with an outlined button. */}
                    {profile ? (
                      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--color-main)_8%,transparent)] pb-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-main)]">
                            {t("remembering")}
                          </p>
                          <p className="mt-0.5 text-xs leading-4 text-[var(--color-secondary)]">
                            {t(
                              profile.memoryConsent === "GRANTED"
                                ? "on"
                                : "off",
                            )}
                          </p>
                        </div>
                        <Toggle
                          className="shrink-0 [--toggle-on-bg:var(--play-cta)]"
                          checked={profile.memoryConsent === "GRANTED"}
                          disabled={mutating}
                          onChange={() => void toggleMemory()}
                          aria-label={t("remembering")}
                        />
                      </div>
                    ) : null}

                    {facts.length === 0 ? (
                      <p className="py-5 text-center text-sm text-[var(--color-secondary)]">
                        {t("empty")}
                      </p>
                    ) : (
                      <ul className="grid gap-2">
                        {facts.map((fact) => (
                          <li
                            key={fact.id}
                            className="rounded-[var(--radius-card)] bg-[var(--color-surface)] py-2.5 pl-3.5 pr-1.5 shadow-[var(--shadow-card)]"
                          >
                            <p className="text-xs font-semibold text-[var(--color-secondary)]">
                              {t(`keys.${fact.key}`)}
                            </p>
                            {editingId === fact.id ? (
                              <div className="mt-2 flex gap-2">
                                {MEMORY_OPTIONS[fact.key] ? (
                                  <select
                                    value={editValue}
                                    onChange={(event) =>
                                      setEditValue(event.target.value)
                                    }
                                    className="min-h-10 min-w-0 flex-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                                    style={{
                                      borderColor: "var(--color-border)",
                                    }}
                                  >
                                    {MEMORY_OPTIONS[fact.key]?.map((value) => (
                                      <option key={value} value={value}>
                                        {t(`values.${fact.key}.${value}`)}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={editValue}
                                    onChange={(event) =>
                                      setEditValue(event.target.value)
                                    }
                                    className="min-h-10 min-w-0 flex-1 rounded-[10px] border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                                    style={{
                                      borderColor: "var(--color-border)",
                                    }}
                                  />
                                )}
                                <button
                                  type="button"
                                  disabled={mutating || !editValue.trim()}
                                  onClick={() => void saveFact(fact)}
                                  className="min-h-10 cursor-pointer rounded-full bg-[var(--color-progress)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                                >
                                  {t("save")}
                                </button>
                              </div>
                            ) : (
                              <div className="mt-1 flex items-center gap-2">
                                <p className="min-w-0 flex-1 text-sm text-[var(--color-body-text)]">
                                  {MEMORY_OPTIONS[fact.key]
                                    ? t(`values.${fact.key}.${fact.value}`)
                                    : fact.value}
                                </p>
                                <button
                                  type="button"
                                  disabled={mutating}
                                  aria-label={t("edit")}
                                  onClick={() => {
                                    setEditingId(fact.id);
                                    setEditValue(fact.value);
                                  }}
                                  className="inline-flex size-10 items-center justify-center rounded-full text-[var(--color-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] hover:text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50 motion-reduce:transition-none"
                                >
                                  <Pen2Icon size={18} strokeWidth={1.75} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  disabled={mutating}
                                  aria-label={t("forget")}
                                  onClick={() => void forget(fact.id)}
                                  className="inline-flex size-10 items-center justify-center rounded-full text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50 motion-reduce:transition-none"
                                >
                                  <TrashBinMinimalisticIcon size={18} strokeWidth={1.75} aria-hidden />
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {facts.length > 0 ? (
                      <button
                        type="button"
                        disabled={mutating}
                        className="mt-3 min-h-11 cursor-pointer rounded-full px-3 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50 motion-reduce:transition-none"
                        onClick={() => void clearAll()}
                      >
                        {t(confirmClear ? "clear_confirm" : "clear_all")}
                      </button>
                    ) : null}
                    {error ? (
                      <p
                        role="alert"
                        className="mt-3 text-sm text-[var(--color-danger)]"
                      >
                        {t("error")}
                      </p>
                    ) : null}
                  </div>
                )}
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
