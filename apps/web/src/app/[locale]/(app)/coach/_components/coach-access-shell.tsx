"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "@/i18n/navigation";
import type { CoachAccessDto } from "@mentor/types";
import { FormError } from "@/components/form";
import { fetchCoachAccess } from "@/lib/coach";
import { CoachAccessGate } from "./coach-access-gate";
import { CoachSessionProvider } from "./coach-session-context";
import { CoachChatSkeleton, CoachHubSkeleton } from "./coach-content-skeleton";

type AccessState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; access: CoachAccessDto };

const CoachAccessContext = createContext<CoachAccessDto | null>(null);

export function useCoachAccess(): CoachAccessDto {
  const access = useContext(CoachAccessContext);
  if (!access) {
    throw new Error("useCoachAccess must be used within CoachAccessShell");
  }
  return access;
}

/**
 * /coach layout: probes GET /coach/access once; gates or wraps children with session provider.
 */
export function CoachAccessShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<AccessState>({ status: "loading" });
  const isChatRoute = pathname === "/coach/chat" || pathname.endsWith("/coach/chat");

  useEffect(() => {
    let active = true;
    fetchCoachAccess()
      .then((access) => {
        if (!active) return;
        setState({ status: "ready", access });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return isChatRoute ? <CoachChatSkeleton /> : <CoachHubSkeleton />;
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <FormError message={state.message} />
      </main>
    );
  }

  if (!state.access.canChat) {
    return <CoachAccessGate access={state.access} />;
  }

  return (
    <CoachAccessContext.Provider value={state.access}>
      <CoachSessionProvider>{children}</CoachSessionProvider>
    </CoachAccessContext.Provider>
  );
}
