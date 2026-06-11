import type { ReactNode } from "react";
import { Card } from "@mentor/ui";

/** Centered auth card — Nuton look (white surface, 10px radius, single shadow). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <h1
        className="mb-6 text-center text-3xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Mentor
      </h1>
      <Card className="flex flex-col gap-4">{children}</Card>
    </main>
  );
}
