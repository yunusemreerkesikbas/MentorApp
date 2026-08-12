"use client";
import { X } from "lucide-react";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ZoneSidebar } from "./zone-sidebar";
import { useZoneDrawer } from "./zone-drawer-context";

export function ZoneDrawer() {
  const t = useTranslations("community");
  const { open, closeDrawer } = useZoneDrawer();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [closeDrawer, open]);

  return (
    <div className="lg:hidden">
      {open && (
        <div
          className="fixed inset-0 top-16 z-[41] bg-black/35"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <div
        id="community-zone-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("drawer_open")}
        aria-hidden={!open}
        inert={!open}
        className="fixed bottom-0 left-0 top-16 z-[42] w-[min(82vw,280px)] overflow-y-auto bg-[#f6f7f9] py-5 transition-transform duration-200"
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          boxShadow: open ? "0 24px 60px rgb(15 23 42 / 18%)" : "none",
        }}
      >
        <button
          type="button"
          aria-label={t("close")}
          onClick={closeDrawer}
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-[9px] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <X size={19} aria-hidden />
        </button>
        <ZoneSidebar onNavigate={closeDrawer} />
      </div>
    </div>
  );
}
