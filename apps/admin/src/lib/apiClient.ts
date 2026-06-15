import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearToken, getToken } from "./auth";

// Single API (§1): NestJS /v1. `NEXT_PUBLIC_API_URL` already includes the /v1 prefix
// (see .env.example); defaults to the local api.
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

const apiClient = axios.create({ baseURL });

// Attach the admin's bearer token on every request.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// On 401, the session is gone/expired → clear and bounce to login.
apiClient.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
        if (error?.response?.status === 401 && typeof window !== "undefined") {
            clearToken();
            if (window.location.pathname !== "/login") window.location.href = "/login";
        }
        return Promise.reject(error);
    },
);

export default apiClient;
