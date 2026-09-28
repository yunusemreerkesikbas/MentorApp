import {
  ClipboardList,
  EyeOff,
  GraduationCap,
  ListChecks,
  Smile,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipDataScopeKey } from "@mentor/types";

/** One glyph per consent line; drawn in the coach ink because it is what the coach receives. */
export const SCOPE_ICON: Record<MentorshipDataScopeKey, LucideIcon> = {
  ACTIVITY: Timer,
  MOCK_EXAMS: ClipboardList,
  PLAN_TASK_TITLES: ListChecks,
  MOOD_LEVEL: Smile,
  EXAM_TRACK: GraduationCap,
  AI_BRIEF: Sparkles,
};

/**
 * One line of the consent contract: a bare ink glyph, a short name and the plain words for it (or,
 * on Koçum, the figure actually travelling, which may carry a drawing). Wrap them in a `<ul>`; the
 * rule between lines is the row's own top border.
 */
export function ScopeRow({
  scopeKey,
  title,
  children,
}: {
  scopeKey: MentorshipDataScopeKey;
  title: string;
  children: ReactNode;
}) {
  const Icon = SCOPE_ICON[scopeKey];
  return (
    <li className="flex items-start gap-3 border-t border-[var(--play-line)] py-3 first:border-t-0 first:pt-1">
      <Icon aria-hidden className="mt-px size-5.5 shrink-0 text-[var(--coach-accent)]" strokeWidth={1.75} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-sm font-extrabold leading-snug text-[var(--color-main)]">{title}</p>
        <div className="text-caption font-semibold text-[var(--color-secondary)]">{children}</div>
      </div>
    </li>
  );
}

/** What a coach never receives, by construction (guardrail §4 #5): the free text stays home. */
const NEVER_KEYS = ["AI_CHAT", "NOTES", "NOTEBOOK", "EMAIL"] as const;

export function ScopeNeverList() {
  const t = useTranslations("mentorship");
  return (
    <ul className="flex flex-col">
      {NEVER_KEYS.map((key) => (
        <li
          key={key}
          className="flex min-h-10 items-center gap-2.5 border-t border-[var(--play-line)] text-body-sm font-bold text-[var(--color-body)] first:border-t-0"
        >
          <EyeOff aria-hidden className="size-5.5 shrink-0 text-[var(--color-secondary)]" strokeWidth={1.75} />
          {t(`scope_never_${key}`)}
        </li>
      ))}
    </ul>
  );
}
