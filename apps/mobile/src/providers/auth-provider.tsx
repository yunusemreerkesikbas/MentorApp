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
import * as SecureStore from "expo-secure-store";
import type { AuthSession, AuthUser } from "@mentor/types";
import type { LoginInput, SignupInput } from "@mentor/validation";
import {
  authControllerLogin,
  authControllerLogout,
  authControllerRefresh,
  authControllerSignup,
  configureApiClient,
} from "@mentor/api-client";
import { getApiBaseUrl } from "../lib/env.js";
import {
  createSecureTokenStore,
  getCachedRefreshToken,
} from "../lib/secure-token.js";
import { useLocale } from "./i18n-provider.js";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<AuthUser>;
  signup: (input: SignupInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUserFromServer: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const secureTokenStore = createSecureTokenStore(SecureStore);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<AuthSession | null> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silentRefreshRef = useRef<() => void>(() => {});
  const { locale } = useLocale();
  const localeRef = useRef(locale);
  localeRef.current = locale;

  // Configure @mentor/api-client synchronously before children or effects issue requests.
  useMemo(() => {
    configureApiClient({
      baseUrl: getApiBaseUrl(),
      clientPlatform: "mobile",
      getAccessToken: () => accessTokenRef.current,
      getRefreshToken: () => getCachedRefreshToken(),
      getLocale: () => localeRef.current,
    });
  }, []);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await secureTokenStore.clearRefreshToken();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const applySession = useCallback(async (session: AuthSession) => {
    accessTokenRef.current = session.accessToken;
    if (session.refreshToken) {
      await secureTokenStore.setRefreshToken(session.refreshToken);
    }
    setUser(session.user);
    setStatus("authenticated");
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(
      () => silentRefreshRef.current(),
      Math.max((session.expiresIn - 60) * 1000, 30_000),
    );
  }, []);

  const silentRefresh = useCallback(async (): Promise<AuthSession | null> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const task = (async () => {
      try {
        const storedRefresh = await secureTokenStore.getRefreshToken();
        if (!storedRefresh) {
          await clearSession();
          return null;
        }
        const session = (await authControllerRefresh()) as unknown as AuthSession;
        await applySession(session);
        return session;
      } catch {
        await clearSession();
        return null;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = task;
    return task;
  }, [applySession, clearSession]);

  useEffect(() => {
    silentRefreshRef.current = () => {
      void silentRefresh();
    };
  }, [silentRefresh]);

  useEffect(() => {
    void silentRefresh();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [silentRefresh]);

  const setUserFromServer = useCallback((next: AuthUser) => {
    setUser(next);
    setStatus("authenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (input) => {
        const session = (await authControllerLogin(input)) as unknown as AuthSession;
        await applySession(session);
        return session.user;
      },
      signup: async (input) => {
        const session = (await authControllerSignup(input)) as unknown as AuthSession;
        await applySession(session);
        return session.user;
      },
      logout: async () => {
        try {
          await authControllerLogout();
        } finally {
          await clearSession();
        }
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
