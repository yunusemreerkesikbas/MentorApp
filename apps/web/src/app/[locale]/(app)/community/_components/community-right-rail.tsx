"use client";

import { usePathname } from "next/navigation";
import { EffortBoard } from "./effort-board";
import { HideCompanion } from "./hide-companion";

/** Feed owns its contextual rail; other community surfaces keep the personal effort companion. */
export function CommunityRightRail() {
  const pathname = usePathname();
  const isHub =
    pathname.endsWith("/community") ||
    pathname.endsWith("/topluluk");
  if (!isHub) return null;

  return (
    <HideCompanion>
      <aside
        className="hidden xl:block xl:w-80 xl:flex-shrink-0 xl:border-l xl:py-6"
        style={{ borderColor: "rgba(0,0,0,0.08)" }}
      >
        <div className="px-6 xl:sticky xl:top-6">
          <EffortBoard />
        </div>
      </aside>
    </HideCompanion>
  );
}
