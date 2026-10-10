import { afterEach, describe, expect, it, vi } from "vitest";
import { ADVERTISING_CONSENT_KEY, blockAdvertisingForDocument, readAdvertisingConsent } from "./advertising-consent-storage";

afterEach(() => { vi.unstubAllGlobals(); blockAdvertisingForDocument(false); });

describe("advertising consent", () => {
  it("blocks queued/new work even if persistent withdrawal fails", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "accepted" } });
    blockAdvertisingForDocument(true);
    expect(readAdvertisingConsent()).toBeNull();
  });
  it("never migrates analytics permission into advertising permission", () => {
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => key === "mentor.analytics-consent.v1" ? "accepted" : null } });
    expect(readAdvertisingConsent()).toBeNull();
  });

  it.each(["accepted", "rejected", "invalid", null])("reads only an explicit valid advertising choice: %s", (value) => {
    const getItem = vi.fn().mockReturnValue(value);
    vi.stubGlobal("window", { localStorage: { getItem } });
    expect(readAdvertisingConsent()).toBe(value === "accepted" || value === "rejected" ? value : null);
    expect(getItem).toHaveBeenCalledWith(ADVERTISING_CONSENT_KEY);
  });

  it("fails closed when browser storage is unavailable", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("Blocked"); } });
    expect(readAdvertisingConsent()).toBeNull();
  });
});
