"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import Brain from "lucide-react/dist/esm/icons/brain.mjs";
import Pencil from "lucide-react/dist/esm/icons/pencil.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
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
        className="flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm font-semibold transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
                className="relative z-[101] flex max-h-[80dvh] w-full max-w-lg flex-col rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]"
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
                    className="inline-flex size-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  >
                    <X className="size-5" aria-hidden />
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
                    {profile ? (
                      <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] p-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-body-text)]">
                            {t("remembering")}
                          </p>
                          <p className="text-xs text-[var(--color-secondary)]">
                            {t(
                              profile.memoryConsent === "GRANTED"
                                ? "on"
                                : "off",
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={mutating}
                          onClick={() => void toggleMemory()}
                          className="min-h-10 rounded-full border px-3 text-sm font-semibold text-[var(--color-main)] disabled:opacity-50"
                          style={{ borderColor: "var(--color-border)" }}
                        >
                          {t(
                            profile.memoryConsent === "GRANTED"
                              ? "pause"
                              : "resume",
                          )}
                        </button>
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
                            className="rounded-[var(--radius-card)] border p-3"
                            style={{ borderColor: "var(--color-border)" }}
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
                                    className="min-h-10 min-w-0 flex-1 rounded-[10px] border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
                                  className="min-h-10 rounded-full bg-[var(--color-main)] px-3 text-sm font-semibold text-white disabled:opacity-50"
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
                                  className="inline-flex size-9 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-50"
                                >
                                  <Pencil className="size-4" aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  disabled={mutating}
                                  aria-label={t("forget")}
                                  onClick={() => void forget(fact.id)}
                                  className="inline-flex size-9 items-center justify-center rounded-full text-[var(--color-danger)] hover:bg-black/5 disabled:opacity-50"
                                >
                                  <Trash2 className="size-4" aria-hidden />
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
                        className="mt-4 min-h-10 rounded-full border px-3 text-sm font-semibold text-[var(--color-danger)] disabled:opacity-50"
                        style={{ borderColor: "var(--color-border)" }}
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
