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
  ApiClientError,
  authControllerLogin,
  authControllerLogout,
  authControllerRefresh,
  authControllerSignup,
  configureApiClient,
} from "@mentor/api-client";
import type { LoginInput, SignupInput } from "@mentor/validation";
import { apiBaseUrl } from "./api-base";

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

/**
 * Access token lives ONLY in memory (XSS can't read httpOnly refresh cookie; we never
 * persist tokens to storage). On mount we attempt a silent refresh — the cookie decides.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef<Promise<AuthSession> | null>(null);
  const sessionVersionRef = useRef(0);
  // Breaks the applySession ↔ silentRefresh cycle (timer calls through the ref).
  const silentRefreshRef = useRef<() => void>(() => {});
  const locale = useLocale();

  const clearSession = useCallback(() => {
    sessionVersionRef.current += 1;
    accessTokenRef.current = null;
    setUser(null);
    setStatus("anonymous");
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const setUserFromServer = useCallback((next: AuthUser) => {
    sessionVersionRef.current += 1;
    setUser(next);
    setStatus("authenticated");
  }, []);

  const applySession = useCallback((session: AuthSession) => {
    sessionVersionRef.current += 1;
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
    const startedAtVersion = sessionVersionRef.current;
    // ponytail: fixed 3× short retry; add backoff/jitter only if the boot race widens.
    for (let attempt = 1; ; attempt++) {
      try {
        refreshInFlightRef.current ??= (
          authControllerRefresh() as unknown as Promise<AuthSession>
        ).finally(() => {
          refreshInFlightRef.current = null;
        });
        const session = await refreshInFlightRef.current;
        if (sessionVersionRef.current === startedAtVersion) applySession(session);
        return;
      } catch (err) {
        // Only a real HTTP error (ApiClientError, e.g. 401/expired cookie) → anonymous.
        // A "Failed to fetch" TypeError means the API is briefly unreachable (dev boot /
        // watch recompile) — retry instead of dropping a possibly-valid session.
        const isNetworkError = !(err instanceof ApiClientError);
        const stillCurrent = sessionVersionRef.current === startedAtVersion;
        if (isNetworkError && stillCurrent && attempt < 3) {
          await new Promise((r) => setTimeout(r, 300 * attempt));
          continue;
        }
        // Stale refresh must not erase a newer login/signup.
        if (stillCurrent) clearSession();
        return;
      }
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    silentRefreshRef.current = () => void silentRefresh();
  }, [silentRefresh]);

  // Configure before the mount-effect silent refresh below; operation calls read the latest ref lazily.
  useEffect(() => {
    configureApiClient({
      baseUrl: apiBaseUrl(),
      getAccessToken: () => accessTokenRef.current,
      getLocale: () => locale,
    });
  }, [locale]);

  // Silent refresh runs once on mount — locale changes do not re-trigger it.
  useEffect(() => {
    silentRefreshRef.current();
  }, []);

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
