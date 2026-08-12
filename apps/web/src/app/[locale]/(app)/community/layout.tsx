import type { ReactNode } from "react";
import "./community-parity.css";
import { CommunityHeader } from "./_components/community-header";
import { CommunityQuickReplyProvider } from "./_components/community-quick-reply";
import { ZoneSidebar } from "./_components/zone-sidebar";
import { ZoneDrawer } from "./_components/zone-drawer";
import { ZoneDrawerProvider } from "./_components/zone-drawer-context";

/**
 * Community is a dedicated workspace. Individual pages own the contextual right rail so the
 * hub, discovery feed, room and detail screens can follow their reference layouts independently.
 */
export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <ZoneDrawerProvider>
      <CommunityQuickReplyProvider>
        <div className="community-workspace">
          <CommunityHeader />
          <ZoneDrawer />
          <div className="community-workspace__body">
            <aside className="community-workspace__sidebar">
              <ZoneSidebar />
            </aside>
            <div className="community-workspace__content">{children}</div>
          </div>
        </div>
      </CommunityQuickReplyProvider>
    </ZoneDrawerProvider>
  );
}
