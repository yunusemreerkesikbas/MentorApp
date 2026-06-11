"use client";

import { Card, Chip } from "@mentor/ui";

/** Shell placeholder for screens owned by upcoming tracks (W1/W2…). */
export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-10">
      <Chip>Yakında</Chip>
      <h1
        className="text-3xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h1>
      <Card>
        <p style={{ color: "var(--color-secondary)" }}>{note}</p>
      </Card>
    </main>
  );
}
