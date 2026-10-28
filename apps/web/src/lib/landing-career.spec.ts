import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLandingCareer, readLandingCareer, saveLandingCareer } from "./landing-career";

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe("landing career pick", () => {
  it("keeps the field picked on the landing for onboarding", () => {
    stubStorage();
    saveLandingCareer("YAZILIM");
    expect(readLandingCareer()).toBe("YAZILIM");
  });

  it("remembers 'not decided yet' as its own answer", () => {
    stubStorage();
    saveLandingCareer("none");
    expect(readLandingCareer()).toBe("none");
  });

  it("ignores a stored value that is not a career group", () => {
    stubStorage({ mentor_landing_career: "ASTRONOT" });
    expect(readLandingCareer()).toBeNull();
  });

  it("forgets the pick once onboarding has used it", () => {
    stubStorage();
    saveLandingCareer("FEN");
    clearLandingCareer();
    expect(readLandingCareer()).toBeNull();
  });

  it("reads nothing when storage is blocked", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(readLandingCareer()).toBeNull();
  });

  it("reads nothing on the server", () => {
    expect(readLandingCareer()).toBeNull();
  });
});
