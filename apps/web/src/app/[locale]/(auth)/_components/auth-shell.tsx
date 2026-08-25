"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { CircularBackLink } from "@/components/circular-back-link";
import { usePathname } from "@/i18n/navigation";
import { authShellNav } from "@/lib/auth-paths";

const AuthSheetExitContext = createContext<(navigate: () => void) => void>(
  (navigate) => navigate(),
);

/** Run `navigate` after the auth sheet close transition (or immediately if reduced-motion). */
export function useAuthSheetExit() {
  return useContext(AuthSheetExitContext);
}

function readCloseMs(el: HTMLElement | null): number {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 0;
  }
  const raw = getComputedStyle(el).getPropertyValue("--panel-close-dur").trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  if (raw.endsWith("s") && !raw.endsWith("ms")) return value * 1000;
  return value;
}

/** Auth chrome — mobile bottom sheet, desktop centered card. */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.shell");
  const pathname = usePathname();
  const nav = authShellNav(pathname);
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [open, setOpen] = useState(true);

  const exitThen = useCallback((navigate: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
    const ms = readCloseMs(panelRef.current);
    if (ms <= 0) {
      navigate();
      return;
    }
    window.setTimeout(navigate, ms);
  }, []);

  return (
    <AuthSheetExitContext.Provider value={exitThen}>
      <main className="flex min-h-dvh w-full flex-col justify-end overflow-hidden lg:items-center lg:justify-center lg:px-5 lg:py-8">
        <div
          ref={panelRef}
          className="auth-sheet flex w-full max-h-[90dvh] flex-col overflow-hidden bg-[var(--color-surface)] max-lg:w-full max-lg:rounded-t-[16px] max-lg:shadow-[0px_-4px_10px_rgba(37,73,150,0.10)] lg:max-h-[82dvh] lg:max-w-[23.4375rem] lg:rounded-[var(--radius-card)] lg:border lg:border-[var(--color-border)] lg:shadow-[var(--shadow-card)]"
          data-open={open ? "true" : "false"}
        >
          <div
            className="flex h-6 shrink-0 items-center justify-center lg:hidden"
            aria-hidden
          >
            <div
              className="h-1 w-9 rounded-full"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-secondary) 40%, transparent)",
              }}
            />
          </div>
          {nav.icon === "none" ? null : (
            <header className="flex shrink-0 items-center px-5 pb-2 lg:pt-5">
              <CircularBackLink
                href={nav.href}
                label={t("back_login")}
                variant="soft"
                icon="chevron"
              />
            </header>
          )}
          <div
            className={`mentor-scrollarea min-h-0 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${nav.icon === "none" ? "pt-5" : "pt-2"}`}
          >
            {children}
          </div>
        </div>
      </main>
    </AuthSheetExitContext.Provider>
  );
}
