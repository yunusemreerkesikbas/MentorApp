"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import type { AuthSession, AuthUser } from "@mentor/types";
import {
  authControllerLogin,
  authControllerLogout,
  authControllerRefresh,
  authControllerSignup,
  configureApiClient,
} from "@mentor/api-client";
import type { LoginInput, SignupInput } from "@mentor/validation";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<AuthUser>;
  signup: (input: SignupInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Sync in-memory user after profile PATCH (greeting, examType, etc.). */
  setUserFromServer: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Strips a trailing /v1 — generated operation URLs already include the prefix. */
function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return raw.replace(/\/v1\/?$/, "");
}

/**
 * Access token lives ONLY in memory (XSS can't read httpOnly refresh cookie; we never
 * persist tokens to storage). On mount we attempt a silent refresh — the cookie decides.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Breaks the applySession ↔ silentRefresh cycle (timer calls through the ref).
  const silentRefreshRef = useRef<() => void>(() => {});
  const locale = useLocale();

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
    setStatus("anonymous");
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const setUserFromServer = useCallback((next: AuthUser) => {
    setUser(next);
    setStatus("authenticated");
  }, []);

  const applySession = useCallback((session: AuthSession) => {
    accessTokenRef.current = session.accessToken;
    setUser(session.user);
    setStatus("authenticated");
    // Schedule a silent refresh slightly before expiry.
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(
      () => silentRefreshRef.current(),
      Math.max((session.expiresIn - 60) * 1000, 30_000),
    );
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const session = (await authControllerRefresh()) as unknown as AuthSession;
      applySession(session);
    } catch {
      clearSession(); // no/expired cookie → anonymous (expected, not an error)
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    silentRefreshRef.current = () => void silentRefresh();
  }, [silentRefresh]);

  // Silent refresh runs once on mount — locale changes do not re-trigger it.
  useEffect(() => {
    silentRefreshRef.current();
  }, []);

  // ponytail: sync call so baseUrl is set before the mount-effect silentRefresh fires.
  // Idempotent (sets a module-level singleton); safe to call on every render.
  configureApiClient({
    baseUrl: apiBaseUrl(),
    getAccessToken: () => accessTokenRef.current,
    getLocale: () => locale,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (input) => {
        const session = (await authControllerLogin(
          input,
        )) as unknown as AuthSession;
        applySession(session);
        return session.user;
      },
      signup: async (input) => {
        const session = (await authControllerSignup(
          input,
        )) as unknown as AuthSession;
        applySession(session);
        return session.user;
      },
      logout: async () => {
        await authControllerLogout().catch(() => undefined); // idempotent server-side
        clearSession();
      },
      setUserFromServer,
    }),
    [status, user, applySession, clearSession, setUserFromServer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
