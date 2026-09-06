'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import type { AuthUser } from "@mentor/types";
import apiClient, { refreshAdminSession } from "@/lib/apiClient";
import { clearToken, removeLegacyStoredToken } from "@/lib/auth";
import { canEnterPanel } from "@/lib/roles";

interface AuthContextValue {
    admin: AuthUser | null;
    loading: boolean;
    logout: () => Promise<void>;
}

// Admin session context. On mount it rotates the httpOnly refresh cookie and enforces that the
// account still holds an admin role; otherwise it bounces to /login. Team-only (§9).
export const AuthContext = createContext<AuthContextValue>({
    admin: null,
    loading: true,
    logout: async () => {},
});

export default function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [admin, setAdmin] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(async () => {
        await apiClient.post("/auth/logout").catch(() => undefined);
        clearToken();
        router.replace("/login");
    }, [router]);

    useEffect(() => {
        removeLegacyStoredToken();
        let active = true;
        // Retry transient network errors (API not listening yet during dev boot / nest --watch
        // recompile) so the panel doesn't get stuck with a null admin. A real HTTP error (401)
        // carries error.response and is handled by the apiClient interceptor — not retried here.
        // Backoff covers ~30s (same window as web AuthProvider) — 3×300ms was too short.
        const NETWORK_RETRY_MAX = 8;
        const networkRetryDelayMs = (attempt: number) =>
            Math.min(500 * 2 ** (attempt - 1), 8_000);
        const loadMe = async () => {
            for (let attempt = 1; ; attempt++) {
                try {
                    const session = await refreshAdminSession();
                    if (!active) return;
                    // Panel access: any admin role (ADMIN/SUPER_ADMIN/EDITOR/SUPPORT/FINANCE/MODERATOR);
                    // menu items + API endpoints are further role-gated (§9 fine sub-roles).
                    if (!canEnterPanel(session.user?.roles)) {
                        clearToken();
                        router.replace("/login");
                        return;
                    }
                    setAdmin(session.user);
                    return;
                } catch (error) {
                    const isNetworkError = !(error as AxiosError)?.response;
                    if (isNetworkError && active && attempt < NETWORK_RETRY_MAX) {
                        await new Promise((r) => setTimeout(r, networkRetryDelayMs(attempt)));
                        continue;
                    }
                    // Real HTTP error (e.g. 401 → interceptor cleared token + redirected), or
                    // network still down after retries: fall through to loading=false.
                    return;
                }
            }
        };
        void loadMe().finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [router]);

    return <AuthContext.Provider value={{ admin, loading, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
