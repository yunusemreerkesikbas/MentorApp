import type { ReactNode } from "react";
import { ZoneSidebar } from "./_components/zone-sidebar";
import { ZoneDrawer } from "./_components/zone-drawer";

export default function ToplulukLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Mobile: sticky bar + slide-in drawer */}
      <ZoneDrawer />
      {/* Desktop: in-flow zone sidebar (sits inside the global lg:pl-60 content area) */}
      <aside
        className="hidden lg:flex lg:w-60 lg:flex-shrink-0 lg:flex-col lg:border-r lg:py-5"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 7%, transparent)",
          background: "var(--color-surface-container)",
        }}
      >
        <ZoneSidebar />
      </aside>
      {/* Main content — min-w-0 prevents flex overflow */}
      <div className="min-w-0 flex-1" style={{ background: "#f7f8fa" }}>
        {children}
      </div>
    </div>
  );
}
