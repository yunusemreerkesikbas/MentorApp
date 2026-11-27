/** The web's `welcome-flow.ts`, plus where a returning (already seen) user starts. */
export const WELCOME_SLIDES = [
  { key: "intro", copyKey: "slide1" },
  { key: "coach", copyKey: "slide2" },
  { key: "dailyStep", copyKey: "slide3" },
  { key: "community", copyKey: "slide4" },
] as const;

export type WelcomeStep = 0 | 1 | 2 | 3;
export type WelcomeSlideKey = (typeof WELCOME_SLIDES)[number]["key"];

const FINAL_STEP: WelcomeStep = 3;

export function nextWelcomeStep(step: WelcomeStep): WelcomeStep {
  return Math.min(step + 1, FINAL_STEP) as WelcomeStep;
}

export function previousWelcomeStep(step: WelcomeStep): WelcomeStep {
  return Math.max(step - 1, 0) as WelcomeStep;
}

export function welcomeSkipStep(): WelcomeStep {
  return FINAL_STEP;
}

export function isFinalWelcomeStep(step: WelcomeStep): boolean {
  return step === FINAL_STEP;
}

/** Seen once: a returning signed-out user lands on the last slide, where sign-up and log-in sit side by side. */
export function welcomeStartStep(seen: boolean): WelcomeStep {
  return seen ? FINAL_STEP : 0;
}
