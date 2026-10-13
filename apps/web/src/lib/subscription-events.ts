/** Entitlement reads invalidate any mounted display-ad policy. Carries no personal data. */
export const SUBSCRIPTION_CHANGED_EVENT = "mentor:subscription-changed";

let channel: BroadcastChannel | null = null;

function subscriptionChannel() {
  if (typeof window.BroadcastChannel !== "function") return null;
  channel ??= new window.BroadcastChannel(SUBSCRIPTION_CHANGED_EVENT);
  return channel;
}

export function notifySubscriptionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED_EVENT));
  subscriptionChannel()?.postMessage("changed");
}

export function onSubscriptionChanged(listener: () => void) {
  const receive = (event: MessageEvent<unknown>) => { if (event.data === "changed") listener(); };
  const shared = subscriptionChannel();
  window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, listener);
  shared?.addEventListener("message", receive);
  return () => {
    window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, listener);
    shared?.removeEventListener("message", receive);
  };
}
