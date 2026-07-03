import type { ReactNode } from "react";
import { ZoneSidebar } from "./_components/zone-sidebar";
import { ZoneDrawer } from "./_components/zone-drawer";
import { ProfileCard } from "./_components/profile-card";

/**
 * Three-column community shell (Figma Feed 1:261): left chat rooms (Trending Topics layout),
 * center thread feed (children), right current-user profile card. Borders + white canvas only —
 * no card chrome, mirroring the reference.
 */
export default function ToplulukLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white">
      {/* Mobile: full-width sticky "Kanallar" bar + slide-in drawer (must sit OUTSIDE the flex row,
          otherwise it collapses into a narrow left column). Hidden on lg+ where the sidebar shows. */}
      <ZoneDrawer />

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

        {/* Right: profile card — xl+ only */}
        <aside
          className="hidden xl:block xl:w-80 xl:flex-shrink-0 xl:border-l xl:py-6"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div className="px-6 xl:sticky xl:top-6">
            <ProfileCard />
          </div>
        </aside>
      </div>
    </div>
  );
}
