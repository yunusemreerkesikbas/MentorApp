"use client";

import { WelcomeCarousel } from "./welcome-carousel";
import { WelcomeGuard } from "./welcome-guard";

export function WelcomeShell() {
  return (
    <WelcomeGuard>
      <WelcomeCarousel />
    </WelcomeGuard>
  );
}
