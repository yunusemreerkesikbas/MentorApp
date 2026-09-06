"use client";

import { useTranslations } from "next-intl";
import type { MentorshipCoachProfileDto } from "@mentor/types";
import { Card, Chip } from "@mentor/ui";

/**
 * Who this coach is, on the two screens where a student needs to know: before consenting, and
 * afterwards on `/kocum`.
 *
 * Shared rather than written twice for the same reason `DataScopeCard` is — these two screens
 * describe one relationship, and a second copy is a second place for them to disagree about it.
 *
 * `null` is a real state, not an absence to paper over: every coach granted the role by hand
 * before the application queue existed has no vetted profile, and saying so is more honest than
 * an empty card. The caller decides where that sentence goes; this component just declines.
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

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <p className="font-semibold" style={{ color: "var(--color-main)" }}>
          {profile.headline}
        </p>
        <p className="text-sm whitespace-pre-line" style={{ color: "var(--color-body)" }}>
          {profile.bio}
        </p>

        {/* Only claims somebody checked, and each carries the value that was checked. The badge
            says "we verified this", never "this coach is good" — there is no score here. */}
        {profile.verifiedClaims.length > 0 && (
          <ul
            className="flex flex-wrap items-center gap-1.5"
            aria-label={t("coach_profile_verified_label")}
          >
            {profile.verifiedClaims.map(({ claim, value }) => (
              <li key={claim}>
                <Chip size="sm" className="normal-case">
                  {t(`coach_profile_claim_${claim}`, { value })}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
