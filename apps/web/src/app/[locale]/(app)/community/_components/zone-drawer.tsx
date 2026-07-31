"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Menu from "lucide-react/dist/esm/icons/menu.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
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
      <div
        className="sticky top-16 z-30 flex h-[52px] items-center gap-3 border-b border-[#e7e9ee] bg-white/95 px-4 backdrop-blur"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("drawer_open")}
          className="grid size-11 place-items-center rounded-[9px] text-[#171b25] hover:bg-[#f1f2f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Menu size={20} aria-hidden />
        </button>
        <span className="text-sm font-bold text-[#171b25]">
          {t("drawer_open")}
        </span>
      </div>

      {open && (
        <div
          className="fixed inset-0 top-16 z-[41] bg-black/35"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <div
        className="fixed bottom-0 left-0 top-16 z-[42] w-[min(82vw,280px)] overflow-y-auto bg-[#f6f7f9] py-5 transition-transform duration-200"
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          boxShadow: open ? "0 24px 60px rgb(15 23 42 / 18%)" : "none",
        }}
      >
        <button
          type="button"
          aria-label={t("close")}
          onClick={close}
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-[9px] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <X size={19} aria-hidden />
        </button>
        <ZoneSidebar onNavigate={close} />
      </div>
    </div>
  );
}
