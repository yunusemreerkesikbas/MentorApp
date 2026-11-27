import * as SecureStore from "expo-secure-store";

// The web's `welcome-seen.ts`. ponytail: SecureStore is the only key-value store installed.
const SEEN_KEY = "mentor.welcome.seen.v1";

export function loadWelcomeSeen(): boolean {
  try {
    return SecureStore.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    SecureStore.setItem(SEEN_KEY, "1");
  } catch {
    // Worst case the slides show once more.
  }
}
