import type { ReactNode } from "react";
import { Logo } from "@mentor/ui";

/**
 * The page the invite card sits on. Shared by the loaded states and the skeleton, so the swap
 * from one to the other moves nothing.
 *
 * It carries the app's pastel atmosphere (DESIGN.md §2.2) on its own: this page sits outside the
 * app shell and is often the very first screen someone sees.
 */
export function InviteLandingFrame({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 pb-10 pt-16"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full blur-[150px]"
          style={{ backgroundColor: "var(--blob-blue)", opacity: "var(--blob-blue-opacity)" }}
        />
        <div
          className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full blur-[150px]"
          style={{ backgroundColor: "var(--blob-cyan)", opacity: "var(--blob-cyan-opacity)" }}
        />
        <div
          className="absolute -bottom-24 -left-24 h-[24rem] w-[24rem] rounded-full blur-[150px]"
          style={{ backgroundColor: "var(--blob-pink)", opacity: "var(--blob-pink-opacity)" }}
        />
      </div>
      <p aria-hidden className="absolute left-5 top-6 text-xl text-[var(--color-main)] lg:left-10 lg:top-8">
        <Logo />
      </p>
      {children}
    </main>
  );
}
