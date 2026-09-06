interface TurnstileOptions {
  sitekey: string;
  action: "signup";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let pending: Promise<TurnstileApi> | undefined;

/** Loads only on the signup screen; a failed script can be retried explicitly. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else { pending = undefined; script.remove(); reject(new Error("Turnstile unavailable")); }
    };
    script.onerror = () => {
      pending = undefined;
      script.remove();
      reject(new Error("Turnstile could not load"));
    };
    document.head.appendChild(script);
  });
  return pending;
}
