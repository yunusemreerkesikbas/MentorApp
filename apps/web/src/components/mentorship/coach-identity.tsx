import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MentorshipCoachProfileDto } from "@mentor/types";
import { initialsOf } from "@/app/[locale]/(coach)/_components/student-avatar";

/** The disk plus a surface gap and a soft ink ring, so it reads as a person at every size. */
const AVATAR_SIZE = {
  sm: "size-10 text-sm shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--coach-accent-soft)]",
  md: "size-14 text-lg shadow-[0_0_0_3px_var(--color-surface),0_0_0_6px_var(--coach-accent-soft)]",
  xl: "size-18 text-2xl shadow-[0_0_0_4px_var(--color-surface),0_0_0_7px_var(--coach-accent-soft)]",
} as const;

/** A human coach's initials on the coach ink (DESIGN.md §2.5), same disk as the panel's card. */
export function CoachAvatar({ name, size }: { name: string; size: keyof typeof AVATAR_SIZE }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-[var(--coach-accent)] font-black text-[var(--color-bg)] ${AVATAR_SIZE[size]}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * What the coach claims about themselves, in two groups.
 *
 * THE TWO GROUPS ARE THE POINT (APP-089). Coaches register themselves, so most claims are nobody's
 * word but their own. Showing only the checked ones would make an unchecked coach look identical
 * to a checked one at the moment a student decides to share private data, so both groups render,
 * visibly apart, under headings that say which is which: checked claims on the coach ink with a
 * badge, the coach's own words dashed and quiet. The badge says "we verified this", never "this
 * coach is good": there is no score, and the value shown is the exact one that was checked.
 */
export function CoachClaims({ claims }: { claims: MentorshipCoachProfileDto["claims"] }) {
  const t = useTranslations("mentorship");
  const verified = claims.filter((claim) => claim.verified);
  const declared = claims.filter((claim) => !claim.verified);
  if (claims.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {verified.length > 0 && (
        <>
          <p className="text-caption font-extrabold text-[var(--color-secondary)]">
            {t("coach_profile_verified_label")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {verified.map(({ claim, value }) => (
              <li
                key={claim}
                className="inline-flex h-7.5 items-center gap-1.5 rounded-full bg-[var(--coach-accent-soft)] px-3 text-caption font-extrabold text-[var(--coach-accent-ink)]"
              >
                <BadgeCheck aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
                {t(`coach_profile_claim_${claim}`, { value })}
              </li>
            ))}
          </ul>
        </>
      )}
      {declared.length > 0 && (
        <>
          <p
            className={`text-caption font-extrabold text-[var(--color-secondary)] ${verified.length > 0 ? "mt-1" : ""}`}
          >
            {t("coach_profile_declared_label")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {declared.map(({ claim, value }) => (
              <li
                key={claim}
                className="inline-flex h-7.5 items-center rounded-full border-[1.5px] border-dashed border-[var(--color-secondary)]/40 px-3 text-caption font-bold text-[var(--color-secondary)]"
              >
                {t(`coach_profile_claim_${claim}`, { value })}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
