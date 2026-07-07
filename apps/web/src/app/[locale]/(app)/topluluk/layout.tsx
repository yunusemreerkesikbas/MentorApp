import type { ReactNode } from "react";
import { ZoneSidebar } from "./_components/zone-sidebar";
import { ZoneDrawer } from "./_components/zone-drawer";
import { EffortBoardDrawer } from "./_components/effort-board-drawer";
import { EffortBoard } from "./_components/effort-board";
import { HideOnRanking } from "./_components/hide-on-ranking";

/**
 * Three-column community shell (Figma Feed 1:261): left chat rooms (Trending Topics layout),
 * center thread feed (children), right current-user profile + effort board. Borders + white canvas
 * only — no card chrome, mirroring the reference. Below xl the right column can't fit, so the board
 * moves into a slide-in drawer (`EffortBoardDrawer`) — mirroring the left `ZoneDrawer` mobile pattern.
 */
export default function ToplulukLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white">
      {/* Mobile chrome (outside the flex row): left "Kanallar" drawer + right "Sıralama" drawer.
          Both hidden at their desktop breakpoint where the real column shows. */}
      <ZoneDrawer />
      <HideOnRanking>
        <EffortBoardDrawer />
      </HideOnRanking>

      <div className="flex min-h-screen">
        {/* Left: chat rooms */}
        <aside
          className="hidden lg:flex lg:w-72 lg:flex-shrink-0 lg:flex-col lg:border-r lg:py-6"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <ZoneSidebar />
        </aside>

        {/* Center: feed (min-w-0 prevents flex overflow) */}
        <div className="min-w-0 flex-1">{children}</div>

        {/* Right: profile + effort board — xl+ only (below xl it lives in EffortBoardDrawer).
            Hidden on the ranking page, which already IS the full leaderboard (no duplication). */}
        <HideOnRanking>
          <aside
            className="hidden xl:block xl:w-80 xl:flex-shrink-0 xl:border-l xl:py-6"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            <div className="px-6 xl:sticky xl:top-6">
              <EffortBoard />
            </div>
          </aside>
        </HideOnRanking>
      </div>
    </div>
  );
}
