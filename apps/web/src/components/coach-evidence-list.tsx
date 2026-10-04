import { BadgeCheck } from "lucide-react";
import type { CoachUsedEvidenceDto } from "@mentor/types";

/** The verified lines the coach read, drawn the same wherever the coach shows its work. */
export function CoachEvidenceList({
  evidence,
}: {
  evidence: readonly CoachUsedEvidenceDto[];
}) {
  return (
    <ul className="grid gap-2">
      {evidence.map((item) => (
        <li
          key={`${item.type}:${item.observedAt}`}
          className="flex items-start gap-2"
        >
          <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{item.summary}</span>
        </li>
      ))}
    </ul>
  );
}
