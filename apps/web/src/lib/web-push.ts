import {
  notificationsControllerSubscribePush,
  notificationsControllerUnsubscribePush,
} from "@mentor/api-client";

/** Inlined at build time: it must match the API's `VAPID_PUBLIC_KEY`, and a change needs a rebuild. */
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type BrowserPushSupport = "ready" | "unsupported" | "unconfigured";

/** VAPID keys travel as unpadded URL-safe base64; `pushManager.subscribe` wants the raw bytes. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function browserPushSupport(): BrowserPushSupport {
  if (!vapidPublicKey) return "unconfigured";
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  return supported ? "ready" : "unsupported";
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** On only when this browser can really receive: permission granted and a live subscription. */
export async function hasBrowserPushSubscription(): Promise<boolean> {
  if (browserPushSupport() !== "ready" || Notification.permission !== "granted") return false;
  return (await currentSubscription()) !== null;
}

/** Asks for permission, subscribes this browser and hands the endpoint to the API. */
export async function subscribeBrowserPush(): Promise<"subscribed" | "denied" | "error"> {
  if (browserPushSupport() !== "ready") return "error";
  try {
    if ((await Notification.requestPermission()) !== "granted") return "denied";
    await navigator.serviceWorker.register("/sw.js");
    // `subscribe` needs an active worker; `register` can resolve while it is still installing.
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    const { endpoint, keys } = subscription.toJSON();
    if (!endpoint || !keys?.p256dh || !keys.auth) return "error";
    await notificationsControllerSubscribePush({
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    });
    return "subscribed";
  } catch {
    return "error";
  }
}

/** Best-effort: whichever half fails, the API prunes the endpoint on its first 404/410. */
export async function unsubscribeBrowserPush(): Promise<void> {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  const { endpoint } = subscription;
  await Promise.allSettled([
    subscription.unsubscribe(),
    notificationsControllerUnsubscribePush({ endpoint }),
  ]);
}
