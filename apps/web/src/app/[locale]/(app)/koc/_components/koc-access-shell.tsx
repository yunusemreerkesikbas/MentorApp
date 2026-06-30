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
import { KocChatSkeleton, KocHubSkeleton } from "./koc-content-skeleton";

type AccessState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; access: CoachAccessDto };

const KocAccessContext = createContext<CoachAccessDto | null>(null);

export function useKocAccess(): CoachAccessDto {
  const access = useContext(KocAccessContext);
  if (!access) {
    throw new Error("useKocAccess must be used within KocAccessShell");
  }
  return access;
}

/**
 * /koc layout: probes GET /coach/access once; gates or wraps children with session provider.
 */
export function KocAccessShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<AccessState>({ status: "loading" });
  const isChatRoute = pathname === "/koc/chat" || pathname.endsWith("/koc/chat");

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
    return isChatRoute ? <KocChatSkeleton /> : <KocHubSkeleton />;
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
    <KocAccessContext.Provider value={state.access}>
      <CoachSessionProvider>{children}</CoachSessionProvider>
    </KocAccessContext.Provider>
  );
}
