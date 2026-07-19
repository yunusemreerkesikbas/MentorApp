"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ZoneSidebar } from "./zone-sidebar";

export function ZoneDrawer() {
  const t = useTranslations("community");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      {/* Sticky bar with hamburger */}
      <div
        className="sticky top-14 z-10 flex h-12 items-center gap-3 border-b px-4 backdrop-blur"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
          background: "color-mix(in srgb, var(--color-bg, white) 85%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("drawer_open")}
          className="flex flex-col gap-1 rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <span className="block h-0.5 w-5 rounded-full" style={{ background: "var(--color-main)" }} />
          <span className="block h-0.5 w-5 rounded-full" style={{ background: "var(--color-main)" }} />
          <span className="block h-0.5 w-5 rounded-full" style={{ background: "var(--color-main)" }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>
          {t("drawer_open")}
        </span>
      </div>

      {/* Backdrop — z-[29]: below drawer (z-30), above global content (z-20) */}
      {open && (
        <div
          className="fixed inset-0 z-[29]"
          style={{ top: "3.5rem", background: "rgba(0,0,0,0.3)" }}
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel — starts at top-14 so global header stays visible */}
      <div
        className="fixed bottom-0 left-0 z-30 w-60 overflow-y-auto py-6 transition-transform duration-200"
        style={{
          top: "3.5rem",
          background: "var(--color-bg, white)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          boxShadow: open ? "var(--shadow-card)" : "none",
        }}
      >
        <ZoneSidebar onNavigate={close} />
      </div>
    </div>
  );
}
