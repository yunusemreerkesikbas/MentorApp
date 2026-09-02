import { describe, expect, it } from "vitest";

import {
  WELCOME_SLIDES,
  isFinalWelcomeStep,
  nextWelcomeStep,
  previousWelcomeStep,
  welcomeSkipStep,
} from "./welcome-flow";

describe("welcome flow", () => {
  it("keeps the four-screen story in the agreed order", () => {
    expect(WELCOME_SLIDES.map((slide) => slide.key)).toEqual([
      "intro",
      "coach",
      "dailyStep",
      "community",
    ]);
  });

  it("sends skip to the final auth choice instead of assuming login", () => {
    expect(welcomeSkipStep()).toBe(3);
    expect(isFinalWelcomeStep(welcomeSkipStep())).toBe(true);
  });

  it("keeps next and back navigation inside the slide range", () => {
    expect(previousWelcomeStep(0)).toBe(0);
    expect(nextWelcomeStep(0)).toBe(1);
    expect(nextWelcomeStep(3)).toBe(3);
  });
});
