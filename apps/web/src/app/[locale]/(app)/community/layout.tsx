import type { ReactNode } from "react";
import "./community-parity.css";
import { CommunityHeader } from "./_components/community-header";
import { CommunityQuickReplyProvider } from "./_components/community-quick-reply";
import { ZoneSidebar } from "./_components/zone-sidebar";
import { ZoneDrawer } from "./_components/zone-drawer";
import { ZoneDrawerProvider } from "./_components/zone-drawer-context";

/**
 * Community is a dedicated workspace. On desktop the header (title + search) and the rooms share
 * one sticky left column; on phones the rail dissolves (`display: contents`), the header becomes
 * the top bar and the rooms live in the drawer. Pages own their right rail.
 */
export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <ZoneDrawerProvider>
      <CommunityQuickReplyProvider>
        <div className="community-workspace">
          <ZoneDrawer />
          <div className="community-workspace__body">
            <div className="community-workspace__rail">
              <CommunityHeader />
              <aside className="community-workspace__sidebar">
                <ZoneSidebar />
              </aside>
            </div>
            <div className="community-workspace__content">{children}</div>
          </div>
        </div>
      </CommunityQuickReplyProvider>
    </ZoneDrawerProvider>
  );
}
