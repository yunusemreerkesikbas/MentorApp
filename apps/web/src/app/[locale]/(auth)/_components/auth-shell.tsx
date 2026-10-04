"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { CircularBackLink } from "@/components/circular-back-link";
import { usePathname } from "@/i18n/navigation";
import { authShellShowsBack, authShellShowsHang } from "@/lib/auth-paths";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";
import { HANG_OVERHANG_PX } from "./auth-hang-choreography";
import { useAuthHang } from "./auth-hang-puhu";

const AuthSheetExitContext = createContext<(navigate: () => void) => void>(
  (navigate) => navigate(),
);

/** Run `navigate` after the auth sheet close animation (or immediately if reduced-motion). */
export function useAuthSheetExit() {
  return useContext(AuthSheetExitContext);
}

function readCloseMs(el: HTMLElement | null): number {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 0;
  }
  const raw = getComputedStyle(el).getPropertyValue("--auth-sheet-close-dur").trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  if (raw.endsWith("s") && !raw.endsWith("ms")) return value * 1000;
  return value;
}

/** How long the sheet takes to settle on its new height when login and signup swap. */
const SWAP_MS = 320;

/**
 * Auth chrome — mobile bottom sheet, desktop centered card.
 *
 * Entrance and exit are CSS keyframes (`globals.css`), not a JS-driven transition. Measured on a 4x
 * throttled phone, the old version waited for hydration and a double rAF before it could start —
 * 650 ms of an empty page on a direct load — and left the sheet frozen half off screen while the
 * next route loaded. Keyframes start on the first paint of the server HTML and run on the
 * compositor while the page is still booting.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.shell");
  const pathname = usePathname();
  const showBack = authShellShowsBack(pathname);
  const showHang = authShellShowsHang(pathname);
  const hang = useAuthHang(showHang);
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const lastTopRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<"open" | "exiting">("open");

  /*
   * Login and signup share this sheet and their forms are not the same height, so the top edge and
   * the Puhu hanging from it used to jump 160 px in a single frame. This glides it instead (FLIP).
   * `offsetTop`, not the bounding box: the entrance keyframes may still be moving the sheet.
   * Phones only — the desktop card is centred, and its height change reads as growth, not a jump.
   */
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const top = el.offsetTop;
    const previous = lastTopRef.current;
    lastTopRef.current = top;
    if (previous === null || Math.abs(previous - top) < 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce), (min-width: 64rem)").matches) return;
    el.animate(
      [{ transform: `translate3d(0, ${previous - top}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
      { duration: SWAP_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [pathname]);

  const exitThen = useCallback((navigate: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase("exiting");
    const ms = readCloseMs(panelRef.current);
    if (ms <= 0) {
      navigate();
      return;
    }
    window.setTimeout(navigate, ms);
  }, []);

  return (
    <AuthSheetExitContext.Provider value={exitThen}>
      <main
        // `overflow-clip`, not hidden: a hidden box is still scrollable from code, and on a client
        // navigation Next scrolled it by the sheet's under-extension (50dvh), cutting the form off
        // at the top. A clipped box has no scroll position to move.
        className="auth-shell flex min-h-dvh w-full flex-col justify-end max-lg:overflow-clip lg:mx-auto lg:grid lg:max-w-[72rem] lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-12 lg:overflow-visible lg:px-8 lg:py-10 xl:gap-16 xl:px-0"
        data-hang={showHang ? "true" : "false"}
        data-phase={phase}
        style={showHang ? { "--auth-hang-overhang": `${HANG_OVERHANG_PX}px` } as CSSProperties : undefined}
      >
        <section
          className="auth-narrative hidden min-w-0 flex-col items-center justify-center text-center lg:flex"
          aria-label={t("narrative_label")}
        >
          <div
            className="relative max-w-md rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-card)]"
            data-auth-narrative-bubble
          >
            <h1 className="text-balance text-3xl font-extrabold leading-tight text-[var(--color-main)]">
              {t("narrative_title")}
            </h1>
            <p className="mt-2 text-pretty text-base font-medium leading-relaxed text-[var(--color-secondary)]">
              {t("narrative_body")}
            </p>
            <span
              aria-hidden
              className="absolute -bottom-[9px] left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-[var(--play-line)] bg-[var(--color-surface)]"
            />
          </div>
          <Image
            src={PUHU_MOTION_FRAMES.wave}
            alt=""
            width={240}
            height={240}
            priority
            className="mt-5 size-60 object-contain"
          />
        </section>
        <div
          ref={panelRef}
          className="auth-sheet relative isolate max-h-[90dvh] w-full overflow-visible lg:max-h-none lg:max-w-[26rem]"
          data-phase={phase}
          onFocusCapture={hang.onFocusCapture}
          onBlurCapture={hang.onBlurCapture}
        >
          <span className="contents lg:hidden">{hang.back}</span>
          <div
            className={`relative z-[1] flex max-h-[inherit] w-full flex-col overflow-hidden bg-[var(--color-surface)] max-lg:rounded-t-[16px] lg:rounded-[var(--radius-card)] lg:border lg:border-[var(--color-border)] ${showHang ? "shadow-[var(--shadow-card)]" : "max-lg:shadow-[0px_-4px_10px_rgba(37,73,150,0.10)] lg:shadow-[var(--shadow-card)]"}`}
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
            {showBack ? (
              <header className="flex shrink-0 items-center px-5 pb-2 lg:pt-5">
                <CircularBackLink
                  href="/login"
                  label={t("back_login")}
                  variant="soft"
                  icon="chevron"
                />
              </header>
            ) : null}
            <div
              className={`mentor-scrollarea min-h-0 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:overflow-visible lg:px-6 lg:pb-6 ${showBack ? "pt-2" : "pt-5"}`}
            >
              {children}
            </div>
          </div>
          <span className="contents lg:hidden">{hang.front}</span>
        </div>
      </main>
    </AuthSheetExitContext.Provider>
  );
}
