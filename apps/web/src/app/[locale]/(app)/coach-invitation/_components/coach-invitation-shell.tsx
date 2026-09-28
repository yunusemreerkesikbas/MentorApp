"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Info, KeyRound, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MentorshipInvitationPreviewDto, MyCoachDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { CoachAvatar } from "@/components/mentorship/coach-identity";
import { PANEL_CARD, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link, useRouter } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import { acceptInvitation, fetchMyCoach, previewInvitation } from "@/lib/mentorship";
import { dativeOf } from "@/lib/turkish-case";
import { InvitationCodeStep } from "./invitation-code-step";
import { InvitationCoachCard } from "./invitation-coach-card";
import { InvitationScopeCard } from "./invitation-scope-card";

/** A calm line in the decision card: a refusal, or what has to come first. Never alarm red. */
const CALM =
  "flex items-start gap-2.5 rounded-[var(--radius-card)] bg-[var(--play-selected)] px-3.5 py-3 text-body-sm font-bold text-[var(--color-main)]";

/** The way out beside the ledge: quiet ink at the ledge's own text size. */
const QUIET_BESIDE_LEDGE =
  "inline-flex min-h-11 cursor-pointer items-center text-body-sm font-extrabold text-[var(--color-secondary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/** "MENTOR-KOC-4652CF9D6679" → "MENTOR-KOC-4652…6679": enough to recognise, short enough for a phone. */
function shortCode(code: string): string {
  return code.length > 20 ? `${code.slice(0, 15)}…${code.slice(-4)}` : code;
}

/**
 * Redeeming a coach invite, as one page that unfolds (decided 2026-09-28): the code, then WHO, then
 * WHAT, then the decision. One filled ledge at any moment: "Kodu getir" until the preview arrives,
 * then the code folds into a chip and "Onaylıyorum, bağlan" takes over. KVKK consent has to be
 * informed, so the scope sits between the coach and the button.
 *
 * A `?code=` in the URL only prefills the field. It is never looked up or accepted on load:
 * clicking a link someone sent you is not consent, and it should not fire a request either.
 */
export function CoachInvitationShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [preview, setPreview] = useState<MentorshipInvitationPreviewDto | null>(null);
  const [busy, setBusy] = useState(false);
  /** A live coach already: a second one would be refused, so the student hears it up front. */
  const [current, setCurrent] = useState<MyCoachDto | null>(null);
  /** The API's own words for a refused code, under the field it came from. */
  const [codeError, setCodeError] = useState<string | null>(null);
  /** The API's own words for a refused accept (seats full…), beside the button that got it. */
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyCoach()
      .then((coach) => {
        if (active) setCurrent(coach);
      })
      // Best-effort: without it the accept still refuses, just later.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // A refusal is the answer to what the student did, so it stays on the screen; only an
  // unexpected failure is a passing toast.
  const keepOrToast = useCallback(
    (err: unknown, keep: (message: string) => void) => {
      if (err instanceof ApiClientError) {
        keep(err.message);
        return;
      }
      toast.error({ title: common("error_title"), message: common("error_unknown") });
    },
    [toast, common],
  );

  async function lookUp() {
    const normalized = code.trim().toUpperCase();
    if (normalized === "") return;
    setCodeError(null);
    setBusy(true);
    try {
      setPreview(await previewInvitation(normalized));
      setCode(normalized);
    } catch (err) {
      keepOrToast(err, setCodeError);
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setRefusal(null);
    setBusy(true);
    try {
      await acceptInvitation(code.trim().toUpperCase());
      // Koçum greets them once (Puhu + the coach's disk rising in); no toast on top of that.
      router.replace({ pathname: "/my-coach", query: { hosgeldin: "1" } });
    } catch (err) {
      keepOrToast(err, setRefusal);
      setBusy(false);
    }
  }

  /** Back to the field with the code kept: "Değiştir" and "Vazgeç" both mean "not this one yet". */
  function editCode() {
    setPreview(null);
    setRefusal(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-4 sm:px-8 lg:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-display font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)]">
          {t("invitation_title")}
        </h1>
        {preview ? (
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">
            {t("invitation_subtitle")}
          </p>
        ) : null}
      </header>

      {current ? (
        <section
          aria-label={t("invitation_current_label")}
          className={`${PANEL_CARD} flex flex-wrap items-center gap-3.5`}
        >
          <CoachAvatar name={current.coachDisplayName} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-body-sm font-extrabold text-[var(--color-main)]">
              {t("invitation_already_linked_title", { name: current.coachDisplayName })}
            </p>
            <p className="text-caption font-semibold text-[var(--color-secondary)]">
              {t("invitation_already_linked_body")}
            </p>
          </div>
          <Link href="/my-coach" className={PANEL_TEXT_LINK}>
            {t("invitation_already_linked_cta")}
            <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
          </Link>
        </section>
      ) : null}

      {preview === null ? (
        <InvitationCodeStep
          code={code}
          error={codeError}
          busy={busy}
          onChange={(value) => {
            setCode(value);
            setCodeError(null);
          }}
          onSubmit={() => void lookUp()}
        />
      ) : (
        <>
          <div className="inline-flex min-h-11 max-w-full items-center gap-2.5 self-start rounded-full bg-[var(--color-surface-container)] pl-3.5 pr-1 text-sm font-bold text-[var(--color-main)]">
            <KeyRound aria-hidden className="size-4 shrink-0 text-[var(--color-secondary)]" strokeWidth={1.75} />
            <span className="min-w-0 truncate">
              {t("invitation_code_chip")} <code className="font-mono text-caption tracking-wide">{shortCode(code)}</code>
            </span>
            <button type="button" onClick={editCode} className={`${PANEL_TEXT_LINK} shrink-0 cursor-pointer px-3`}>
              {t("invitation_change_code")}
            </button>
          </div>

          <InvitationCoachCard preview={preview} />
          <InvitationScopeCard scope={preview.dataScope} />

          <section
            aria-label={t("invitation_decision_label")}
            className={`${PANEL_CARD} flex flex-col gap-3.5`}
          >
            <p className="flex items-center gap-2 text-sm font-bold text-[var(--color-body)]">
              <Undo2 aria-hidden className="size-4.5 shrink-0 text-[var(--color-success)]" strokeWidth={1.75} />
              {t("invitation_assure")}
            </p>
            {refusal ? (
              <p role="alert" className={CALM}>
                <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--play-selected-ink)]" strokeWidth={1.75} />
                {refusal}
              </p>
            ) : null}
            {current ? (
              // A consent they cannot give is not offered; the card says what has to come first.
              <p className={CALM}>
                <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--play-selected-ink)]" strokeWidth={1.75} />
                {t("invitation_blocked", {
                  coach: preview.coachDisplayName,
                  dative: dativeOf(preview.coachDisplayName),
                  current: current.coachDisplayName,
                })}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4.5 gap-y-3">
                <Button busy={busy} onClick={accept}>
                  {t("invitation_accept")}
                </Button>
                <button type="button" onClick={editCode} className={QUIET_BESIDE_LEDGE}>
                  {t("confirm_cancel")}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
