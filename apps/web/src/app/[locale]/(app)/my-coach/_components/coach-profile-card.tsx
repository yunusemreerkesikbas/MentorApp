"use client";

import { useTranslations } from "next-intl";
import { BadgeCheck } from "lucide-react";
import type { MentorshipCoachProfileDto } from "@mentor/types";
import { Card, Chip } from "@mentor/ui";

/**
 * Who this coach is, on the two screens where a student needs to know: before consenting, and
 * afterwards on `/kocum`.
 *
 * Shared rather than written twice for the same reason `DataScopeCard` is — these two screens
 * describe one relationship, and a second copy is a second place for them to disagree about it.
 *
 * `null` is a real state, not an absence to paper over: a coach who holds the role without a
 * registry row has no profile, and so does one an admin has stopped. Saying so is more honest than
 * an empty card. The caller decides where that sentence goes; this component just declines.
 *
 * THE TWO CLAIM GROUPS ARE THE POINT (APP-089). Coaches register themselves now, so most claims are
 * nobody's word but their own. Showing only the checked ones would make an unchecked coach look
 * identical to a checked one at the exact moment a student decides to share private data, so both
 * groups render — visibly apart, under headings that say which is which. Merging them, or dropping
 * the unverified group to tidy the card, turns this screen into an endorsement we have not earned.
 */
export function CoachProfileCard({ profile }: { profile: MentorshipCoachProfileDto | null }) {
  const t = useTranslations("mentorship");

  if (profile === null) {
    return (
      <Card>
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("coach_profile_unknown")}
        </p>
      </Card>
    );
  }

  const verified = profile.claims.filter((claim) => claim.verified);
  const declared = profile.claims.filter((claim) => !claim.verified);

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <p className="font-semibold" style={{ color: "var(--color-main)" }}>
          {profile.headline}
        </p>
        <p className="text-sm whitespace-pre-line" style={{ color: "var(--color-body)" }}>
          {profile.bio}
        </p>

        {/* Checked by us. The badge says "we verified this", never "this coach is good" — there is
            no score here, and the value shown is the exact one that was checked. */}
        {verified.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {t("coach_profile_verified_label")}
            </p>
            <ul className="flex flex-wrap items-center gap-1.5">
              {verified.map(({ claim, value }) => (
                <li key={claim}>
                  <Chip size="sm" className="normal-case">
                    <BadgeCheck size={14} aria-hidden className="mr-1 inline-block align-[-2px]" />
                    {t(`coach_profile_claim_${claim}`, { value })}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The coach's own account of themselves, and labelled as exactly that. Quieter styling
            than the group above, because the difference has to survive a glance. */}
        {declared.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {t("coach_profile_declared_label")}
            </p>
            <ul className="flex flex-wrap items-center gap-1.5">
              {declared.map(({ claim, value }) => (
                <li
                  key={claim}
                  className="rounded-full border px-2.5 py-1 text-xs"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-secondary)",
                  }}
                >
                  {t(`coach_profile_claim_${claim}`, { value })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
