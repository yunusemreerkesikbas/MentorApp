import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AuthSession } from "@mentor/types";
import { clearToken, getToken, setToken } from "./auth";

// Single API (§1): NestJS /v1. `NEXT_PUBLIC_API_URL` already includes the /v1 prefix
// (see .env.example); defaults to the local api.
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

const apiClient = axios.create({ baseURL, withCredentials: true });
let refreshInFlight: Promise<AuthSession> | null = null;
const ADMIN_REFRESH_LOCK = "mentor-admin-refresh-v1";

function withRefreshLock<T>(operation: () => Promise<T>): Promise<T> {
    if (typeof navigator === "undefined" || !navigator.locks) return operation();
    const locked = navigator.locks.request<Promise<T>>(ADMIN_REFRESH_LOCK, operation);
    return locked.then((result) => result);
}

function isAuthBootstrapRequest(config: InternalAxiosRequestConfig | undefined): boolean {
    const url = config?.url ?? "";
    return url.includes("/auth/login") || url.includes("/auth/refresh");
}

export async function refreshAdminSession(): Promise<AuthSession> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = withRefreshLock(() =>
        apiClient.post<AuthSession>("/auth/refresh").then(({ data }) => {
            setToken(data.accessToken);
            return data;
        }),
    )
        .finally(() => {
            refreshInFlight = null;
        });
    return refreshInFlight;
}

// Attach the admin's bearer token on every request.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// On 401, the session is gone/expired → clear and bounce to login.
apiClient.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as (InternalAxiosRequestConfig & { _adminRefreshRetried?: boolean }) | undefined;
        if (
            error?.response?.status === 401 &&
            original &&
            !original._adminRefreshRetried &&
            !isAuthBootstrapRequest(original)
        ) {
            original._adminRefreshRetried = true;
            try {
                const session = await refreshAdminSession();
                original.headers.Authorization = `Bearer ${session.accessToken}`;
                return apiClient.request(original);
            } catch {
                // The refresh branch below owns the final session cleanup.
            }
        }
        if (error?.response?.status === 401 && typeof window !== "undefined") {
            clearToken();
            if (window.location.pathname !== "/login") window.location.replace("/login");
        }
        return Promise.reject(error);
    },
);

export default apiClient;
