/**
 * Hardware-backed refresh token storage adapter (`expo-secure-store`).
 * Access tokens NEVER touch storage (in-memory only).
 * Refresh tokens live exclusively in iOS Keychain / Android EncryptedSharedPreferences.
 */
export const REFRESH_TOKEN_STORAGE_KEY = "mentor.auth.refresh_token.v1" as const;

export interface SecureTokenStorePort {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
}

/** In-memory cache of the refresh token so synchronous `getRefreshToken()` in `@mentor/api-client` works. */
let cachedRefreshToken: string | null = null;

export function getCachedRefreshToken(): string | null {
  return cachedRefreshToken;
}

export function createSecureTokenStore(driver: {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}): SecureTokenStorePort {
  return {
    async getRefreshToken(): Promise<string | null> {
      try {
        const value = await driver.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
        cachedRefreshToken = value;
        return value;
      } catch {
        cachedRefreshToken = null;
        return null;
      }
    },
    async setRefreshToken(token: string): Promise<void> {
      cachedRefreshToken = token;
      await driver.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, token);
    },
    async clearRefreshToken(): Promise<void> {
      cachedRefreshToken = null;
      await driver.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(() => {});
    },
  };
}
