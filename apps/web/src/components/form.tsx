"use client";

import type { ReactNode } from "react";
import { Button, TextField } from "@mentor/ui";

/* Form helpers — thin wrappers over the @mentor/ui primitives (DESIGN.md §6). */

export { TextField as Field };

export function SubmitButton({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <Button type="submit" busy={busy} fullWidth>
      {children}
    </Button>
  );
}

/** Backend messages are already localized — render them verbatim (engineering-principles §5). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
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
