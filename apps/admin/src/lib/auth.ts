// Access credentials are intentionally memory-only. The long-lived refresh secret is held by the
// API in an httpOnly cookie, so injected browser code cannot read it from Web Storage.
const TOKEN_KEY = "mentor_admin_token";
let accessToken: string | null = null;

export function getToken(): string | null {
    return accessToken;
}

export function setToken(token: string): void {
    accessToken = token;
}

export function clearToken(): void {
    accessToken = null;
}

/** Remove tokens written by admin builds released before memory-only authentication. */
export function removeLegacyStoredToken(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(TOKEN_KEY);
    } catch {
        // Storage may be disabled. The current build never reads from it.
    }
}
