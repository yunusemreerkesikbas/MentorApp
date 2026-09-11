"use client";
import { Plus } from "lucide-react";

/**
 * Mobile add affordance — sits above the app tab bar. Desktop uses the rail / slot clicks.
 */
export function PlanCalendarFab({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-5 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 flex size-14 cursor-pointer items-center justify-center rounded-full shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 lg:hidden"
      style={{ backgroundColor: "var(--color-btn)", color: "var(--color-btn-label)" }}
    >
      <Plus size={26} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
