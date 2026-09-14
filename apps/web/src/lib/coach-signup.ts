import { apiBaseUrl } from "@/lib/api-base";

/**
 * Whether coach signup (`mentorship.applications.open`) is open. Public, like the Google status read,
 * because the signup screen asks before anyone has an account.
 *
 * Fails closed: an unreachable API hides the coach entry points, and the API refuses the coach intent
 * on its own anyway, so a wrong "closed" costs a hidden link while a wrong "open" would cost a
 * filled-in form that gets rejected.
 */
export async function fetchCoachSignupOpen(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl()}/v1/auth/coach-signup/status`, { cache: "no-store" });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return Boolean(body && typeof body === "object" && (body as { open?: unknown }).open === true);
  } catch {
    return false;
  }
}
