import { UserAvatar } from "@/components/user-avatar";

export interface CoachPlanAvatarPerson {
  studentId: string;
  studentDisplayName: string;
  avatarUrl: string | null;
}

export function CoachPlanAvatarStack({
  people,
  overflow = 0,
  size = 28,
  label,
}: {
  people: readonly CoachPlanAvatarPerson[];
  overflow?: number;
  size?: number;
  label: string;
}) {
  if (people.length === 0) return null;

  return (
    <div className="flex items-center" role="img" aria-label={label}>
      {people.map((person, index) => (
        <UserAvatar
          key={person.studentId}
          name={person.studentDisplayName}
          src={person.avatarUrl}
          size={size}
          className={index === 0 ? "" : "-ml-2"}
        />
      ))}
      {overflow > 0 && (
        <span
          className="-ml-2 flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-semibold ring-1 ring-[var(--color-border)]"
          style={{
            backgroundColor: "var(--color-surface-container)",
            color: "var(--color-main)",
          }}
          aria-hidden="true"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
