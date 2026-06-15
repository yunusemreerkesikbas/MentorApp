// Minimal token storage for the admin panel.
// MVP: access token in localStorage. In prod the app also sits behind Cloudflare Access (§9);
// the refresh-cookie flow can replace this later (see devnote 0018 follow-ups).
const TOKEN_KEY = "mentor_admin_token";

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}
