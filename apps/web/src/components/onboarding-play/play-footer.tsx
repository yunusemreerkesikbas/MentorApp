import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/** Sticky CTA bar. A save error sits right above the button it belongs to. */
export function PlayFooter({ error, divider = false, children }: { error?: string | null; divider?: boolean; children: ReactNode }) {
  return (
    <div
      className={`sticky bottom-0 z-10 flex flex-col gap-4 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 ${divider ? "border-t-2 border-[var(--play-line)] bg-[var(--color-bg)]" : "bg-[linear-gradient(to_bottom,transparent,var(--color-bg)_25%)]"}`}
    >
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm font-semibold leading-normal text-[var(--color-danger)]">
          <CircleAlert size={20} className="shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {children}
    </div>
  );
}
