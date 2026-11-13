import * as SecureStore from "expo-secure-store";

// The web's `mentor.weekly-recap.opened.v2:<date>`, with a dot: SecureStore keys allow only
// [A-Za-z0-9._-]. ponytail: one tiny flag per week in SecureStore, the only key-value store
// installed; old weeks are never read again, so nothing prunes them.
const key = (startDate: string) => `mentor.weekly-recap.opened.v2.${startDate}`;

/** The panel card turns from "new" into "watch again" once a week's story has loaded here. */
export function isRecapOpened(startDate: string): boolean {
  try {
    return SecureStore.getItem(key(startDate)) === "1";
  } catch {
    return false;
  }
}

export function markRecapOpened(startDate: string): void {
  try {
    SecureStore.setItem(key(startDate), "1");
  } catch {
    // A lost flag only shows the card as "new" again.
  }
}
