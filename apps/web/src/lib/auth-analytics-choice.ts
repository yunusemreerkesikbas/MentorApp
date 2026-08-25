import type { ConsentContextValue } from "./analytics-consent";

export const AUTH_ANALYTICS_FIELD = "analytics";

export function applyAuthAnalyticsChoice(
  checked: boolean,
  consent: Pick<ConsentContextValue, "accept" | "reject">,
): void {
  if (checked) consent.accept();
  else consent.reject();
}

export function readAuthAnalyticsChecked(): boolean {
  return (
    document.querySelector<HTMLInputElement>(
      `input[name="${AUTH_ANALYTICS_FIELD}"]`,
    )?.checked === true
  );
}
