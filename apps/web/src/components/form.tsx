"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

/* Small form primitives styled with DESIGN.md tokens (radius 10, single shadow, Lato). */

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
        {label}
      </span>
      <input
        {...props}
        className="rounded-[var(--radius-card)] border border-white bg-white/50 px-5 py-3 text-base outline-none focus:ring-2"
        style={{ color: "var(--color-body)", boxShadow: "var(--shadow-card)" }}
      />
    </label>
  );
}

export function SubmitButton({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white disabled:opacity-60"
      style={{ backgroundColor: "var(--color-btn)", boxShadow: "var(--shadow-card)" }}
    >
      {busy ? "Bekleyin…" : children}
    </button>
  );
}

/** Backend messages are already localized — render them verbatim (engineering-principles §5). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm" style={{ color: "var(--color-like-active)" }}>
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="text-sm" style={{ color: "var(--color-progress)" }}>
      {message}
    </p>
  );
}
