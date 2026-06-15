'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@mentor/types";
import apiClient from "@/lib/apiClient";
import { clearToken, getToken } from "@/lib/auth";

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
        apiClient
            .get<AuthUser>("/users/me")
            .then(({ data }) => {
                if (!active) return;
                // Panel access: ADMIN (full) or EDITOR (content only — role-gated menu/endpoints).
                const allowed = data?.roles?.some((r) => r === "ADMIN" || r === "EDITOR");
                if (!allowed) {
                    clearToken();
                    router.replace("/login");
                    return;
                }
                setAdmin(data);
            })
            .catch(() => {
                // 401 is handled by the apiClient interceptor (clears token + redirects).
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [router]);

    return <AuthContext.Provider value={{ admin, loading, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
