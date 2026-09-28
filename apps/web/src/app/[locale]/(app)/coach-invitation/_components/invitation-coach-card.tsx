"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipInvitationPreviewDto } from "@mentor/types";
import { CoachAvatar, CoachClaims } from "@/components/mentorship/coach-identity";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";

/**
 * WHO before WHAT: the inviting coach, in the coach ink, above the scope list. A coach with no
 * registry row (granted by hand, or stopped by an admin) has no profile, and the card says so
 * rather than drawing an empty frame.
 */
export function InvitationCoachCard({ preview }: { preview: MentorshipInvitationPreviewDto }) {
  const t = useTranslations("mentorship");
  const titleId = useId();
  const profile = preview.coachProfile;

  return (
    <section aria-labelledby={titleId} className={`${PANEL_CARD} flex flex-col gap-4.5 sm:p-6`}>
      <div className="flex items-center gap-4">
        <CoachAvatar name={preview.coachDisplayName} size="xl" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-caption font-extrabold text-[var(--coach-accent)]">
            {t("invitation_from_eyebrow")}
          </span>
          <h2 id={titleId} className="text-xl font-extrabold leading-snug text-[var(--color-main)]">
            {preview.coachDisplayName}
          </h2>
          {preview.coachUsername ? (
            <span className="text-caption font-semibold text-[var(--color-secondary)]">
              @{preview.coachUsername}
            </span>
          ) : null}
        </div>
      </div>

      {profile === null ? (
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">
          {t("coach_profile_unknown")}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <p className={PANEL_CARD_TITLE}>{profile.headline}</p>
            <p className="whitespace-pre-line text-body-sm font-semibold text-[var(--color-body)]">
              {profile.bio}
            </p>
          </div>
          <CoachClaims claims={profile.claims} />
        </>
      )}
    </section>
  );
}
