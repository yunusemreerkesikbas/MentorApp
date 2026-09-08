"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipCoachOverviewDto, MentorshipRosterRowDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { SectionHeading, SkeletonGroup } from "@mentor/ui";
import { CommunityCard } from "@/components/community-card";
import { EmptyState } from "@/components/empty-state";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  fetchCoachRegistrationState,
  fetchOverview,
  fetchRoster,
  rotateInviteCode,
  setAttention,
} from "@/lib/mentorship";
import { inviteLockOf, type InviteLock } from "./invite-lock";
import { useAuth } from "@/lib/auth-context";
import { CoachCapacityCard } from "./coach-capacity-card";
import { CoachCountdownCard } from "./coach-countdown-card";
import { CoachScopeCard } from "./coach-scope-card";
import { CohortBriefCard } from "./cohort-brief-card";
import { compareByAttention, summarizeCohort } from "./cohort-summary";
import { CohortSummaryCard } from "./cohort-summary-card";
import { RosterContentSkeleton } from "./roster-content-skeleton";
import { StudentCard } from "./student-card";

type Tab = "ACTIVE" | "ENDED";

/**
 * The coach's landing screen. It orchestrates two fetches and hands the rendering to the cards
 * below it; the summary band, the seat counter and the scope mirror are all read off data this
 * screen already has, so "who needs me / how is the group / can I take another student" is one
 * page load rather than three.
 */
export function RosterShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const toast = useMentorToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("ACTIVE");
  // The loaded tab travels with its rows, so switching tabs shows the skeleton without a
  // synchronous setState in the effect (which would cascade a render).
  const [loaded, setLoaded] = useState<{
    tab: Tab;
    items: MentorshipRosterRowDto[];
  } | null>(null);
  const [overview, setOverview] = useState<MentorshipCoachOverviewDto | null>(null);
  /**
   * Why the invite code is withheld, if it is (APP-089). The overview nulls the code but cannot
   * say why, so without this the card would offer a Create button that 403s.
   */
  const [inviteLock, setInviteLock] = useState<InviteLock>(null);
  const [busy, setBusy] = useState(false);
  /** The student whose mark is in flight, so one card disables without freezing the roster. */
  const [marking, setMarking] = useState<string | null>(null);

  const showError = useCallback(
    (err: unknown) => {
      toast.error({
        title: common("error_title"),
        // The API already localizes its messages; the client does not re-translate them.
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    },
    [toast, common],
  );

  useEffect(() => {
    let active = true;
    fetchRoster(tab)
      .then((page) => {
        if (active) setLoaded({ tab, items: page.items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoaded({ tab, items: [] });
        showError(err);
      });
    return () => {
      active = false;
    };
  }, [tab, showError]);

  const rows = loaded?.tab === tab ? loaded.items : null;

  // Handled rows sink below the ones still waiting, inside the severity order the API already
  // applied. Safe on the client because the page holds the whole cohort (pageSize=100 against a
  // seat cap in the dozens), so this re-orders every row the server ranked, not just a slice.
  const ordered = useMemo(
    () => (rows === null ? null : [...rows].sort(compareByAttention)),
    [rows],
  );

  /**
   * Optimistic: the click is the coach's own act, and a spinner between deciding and seeing it is
   * the friction the whole slice exists to remove. On failure the row snaps back and says why.
   */
  const toggleAttention = useCallback(
    async (studentId: string, attended: boolean) => {
      setMarking(studentId);
      const patch = (next: boolean) =>
        setLoaded((prev) =>
          prev === null
            ? prev
            : {
                ...prev,
                items: prev.items.map((row) =>
                  row.studentId === studentId
                    ? {
                        ...row,
                        attendedAt: next ? new Date().toISOString() : null,
                        // The server re-derives this from flags the coach cannot see change
                        // mid-click; marking always clears the wait, unmarking always restores it.
                        needsAttention: !next && row.riskFlags.length > 0,
                      }
                    : row,
                ),
              },
        );
      patch(attended);
      try {
        await setAttention(studentId, attended);
      } catch (err) {
        patch(!attended);
        showError(err);
      } finally {
        setMarking(null);
      }
    },
    [showError],
  );

  useEffect(() => {
    let active = true;
    // Two calls rather than one fatter DTO: the overview is the coach panel's own data, the
    // registration state belongs to the registry and is read by the profile screen too.
    fetchCoachRegistrationState()
      .then((state) => {
        if (active) setInviteLock(inviteLockOf(state));
      })
      .catch(() => {
        // Unknown reason: the card falls back to the plain "no code yet" copy rather than
        // guessing at a blocker that may not exist.
      });
    fetchOverview()
      .then((next) => {
        if (active) setOverview(next);
      })
      .catch(() => {
        /* The roster is the screen; a missing header must not blank it. */
      });
    return () => {
      active = false;
    };
  }, []);

  // Only the ACTIVE tab describes a live cohort. Summing the history tab would report on students
  // whose window is closed, and their `metrics` are null by design.
  const summary = useMemo(
    () => summarizeCohort(tab === "ACTIVE" && rows ? rows : []),
    [tab, rows],
  );

  async function rotate() {
    setBusy(true);
    try {
      const inviteCode = await rotateInviteCode();
      setOverview((prev) => (prev ? { ...prev, inviteCode } : prev));
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  /*
   * Two columns since APP-090, because this stopped being a page a coach visits and became the
   * page they land on. The split is by how often a thing changes: the left column is today's work
   * (who is waiting, and why), the right is the standing facts a coach glances at (how long until
   * the exam, how many seats are left, what students agreed to share).
   *
   * One column below `xl`, in this order, so a phone still opens on the work.
   */
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.85fr)] xl:items-start">
      <section className="flex min-w-0 flex-col gap-6">
        <SectionHeading subtitle={t("roster_subtitle")}>{t("roster_title")}</SectionHeading>

        {/* Above the counts on purpose: the summary says how many are waiting, the brief says who
            and why. Both are ACTIVE-only — the history tab describes closed windows. */}
        {tab === "ACTIVE" && <CohortBriefCard />}

        {tab === "ACTIVE" && <CohortSummaryCard summary={summary} />}

        <SegmentPillControl
        items={[
          { id: "ACTIVE", label: t("tab_active") },
          { id: "ENDED", label: t("tab_ended") },
        ]}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
        ariaLabel={t("roster_title")}
        layoutId="mentorship-roster-tabs"
      />

      <SkeletonGroup
        label={t("loading")}
        loading={ordered === null}
        revealed={
          ordered === null ? (
            <div className="flex flex-col gap-3" aria-hidden>
              <div className="h-28" />
              <div className="h-28" />
              <div className="h-28" />
            </div>
          ) : ordered.length === 0 ? (
            <EmptyState
              title={tab === "ACTIVE" ? t("roster_empty_title") : t("roster_ended_empty_title")}
              description={
                tab === "ACTIVE" ? t("roster_empty_body") : t("roster_ended_empty_body")
              }
              puhuVariant="encouraging"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {ordered.map((row) => (
                <li key={row.linkId}>
                  <StudentCard
                    row={row}
                    locale={locale}
                    clickable={tab === "ACTIVE"}
                    busy={marking === row.studentId}
                    onAttention={
                      tab === "ACTIVE"
                        ? (attended) => void toggleAttention(row.studentId, attended)
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )
        }
          className="flex flex-col gap-3"
        >
          <RosterContentSkeleton />
        </SkeletonGroup>
      </section>

      <aside className="flex min-w-0 flex-col gap-5">
        {/* The exam the coach coaches, not one they are sitting (APP-089 reframed `examType`).
            Its own endpoint rather than `/v1/coaching/today`, which would hand a coach a student's
            plan payload to read one date off. */}
        <CoachCountdownCard examType={user?.examType ?? null} />

        <CoachCapacityCard
          loaded={overview !== null}
          inviteCode={overview?.inviteCode ?? null}
          inviteLock={inviteLock}
          activeStudents={overview?.activeStudents ?? 0}
          maxActiveStudents={overview?.maxActiveStudents ?? 0}
          freeSeats={overview?.freeSeats ?? 0}
          paidSeats={overview?.paidSeats ?? 0}
          usedSeats={overview?.usedSeats ?? 0}
          sponsorshipEnabled={overview?.sponsorshipEnabled ?? false}
          busy={busy}
          onRotate={rotate}
        />

        {overview !== null && (
          // Open on the empty roster: that screen is the coach's first, and it is the one moment
          // they have nothing else to read.
          <CoachScopeCard scope={overview.dataScope} defaultOpen={summary.total === 0} />
        )}

        {/* Roadmap §5 makes the forum the coach's showcase and the raw material of their trust
            score, so this is not the student's promo strip wearing a coach hat. */}
        <CommunityCard />
      </aside>
    </div>
  );
}
