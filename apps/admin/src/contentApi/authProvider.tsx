'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import type { AuthUser } from "@mentor/types";
import apiClient from "@/lib/apiClient";
import { clearToken, getToken } from "@/lib/auth";
import { canEnterPanel } from "@/lib/roles";

interface AuthContextValue {
    admin: AuthUser | null;
    loading: boolean;
    logout: () => void;
}

// Admin session context. On mount it loads the current admin (GET /v1/users/me) and enforces
// that the account holds the ADMIN role; otherwise it bounces to /login. Team-only (§9).
export const AuthContext = createContext<AuthContextValue>({
    admin: null,
    loading: true,
    logout: () => {},
});

export default function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [admin, setAdmin] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        clearToken();
        router.replace("/login");
    }, [router]);

    useEffect(() => {
        if (!getToken()) {
            router.replace("/login");
            return;
        }
        let active = true;
        // Retry transient network errors (API not listening yet during dev boot / nest --watch
        // recompile) so the panel doesn't get stuck with a null admin. A real HTTP error (401)
        // carries error.response and is handled by the apiClient interceptor — not retried here.
        const loadMe = async () => {
            for (let attempt = 1; ; attempt++) {
                try {
                    const { data } = await apiClient.get<AuthUser>("/users/me");
                    if (!active) return;
                    // Panel access: any admin role (ADMIN/SUPER_ADMIN/EDITOR/SUPPORT/FINANCE/MODERATOR);
                    // menu items + API endpoints are further role-gated (§9 fine sub-roles).
                    if (!canEnterPanel(data?.roles)) {
                        clearToken();
                        router.replace("/login");
                        return;
                    }
                    setAdmin(data);
                    return;
                } catch (error) {
                    const isNetworkError = !(error as AxiosError)?.response;
                    if (isNetworkError && active && attempt < 3) {
                        await new Promise((r) => setTimeout(r, 300 * attempt));
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
