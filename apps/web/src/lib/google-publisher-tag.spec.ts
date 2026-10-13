import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it.each([null, "rejected", "accepted"])("loads only the limited tag without consulting the retired advertising choice (%s)", async (value) => {
  const getItem = vi.fn(() => value);
  const appendChild = vi.fn((script: { onload: () => void }) => script.onload());
  const script = { dataset: {}, nonce: "", src: "", onload: () => {} };
  vi.stubGlobal("window", { localStorage: { getItem } });
  vi.stubGlobal("document", { querySelector: () => null, createElement: () => script, head: { appendChild } });
  const { loadLimitedGpt } = await import("./google-publisher-tag");
  const first = await loadLimitedGpt();
  expect(await loadLimitedGpt()).toBe(first);
  expect(script.src).toBe("https://pagead2.googlesyndication.com/tag/js/gpt.js");
  expect(appendChild).toHaveBeenCalledTimes(1);
  expect(getItem).not.toHaveBeenCalled();
});

it("executes queued work without promoting analytics or advertising storage to permission", async () => {
  const getItem = vi.fn(() => { throw new Error("Storage unavailable"); });
  const gpt = { cmd: [] as Array<() => void> };
  vi.stubGlobal("window", { localStorage: { getItem }, googletag: gpt });
  vi.stubGlobal("document", { querySelector: () => ({ dataset: { loaded: "true" } }) });
  const { withGpt } = await import("./google-publisher-tag");
  const run = vi.fn(() => "displayed");
  const pending = withGpt(run);
  await vi.waitFor(() => expect(gpt.cmd).toHaveLength(1));
  gpt.cmd[0]!();
  await expect(pending).resolves.toBe("displayed");
  expect(getItem).not.toHaveBeenCalled();
});

it.each(["NONE", "CHILD", "TEEN"] as const)("always disables personalization and preserves %s protection", async (treatment) => {
  const setPrivacySettings = vi.fn();
  const setConfig = vi.fn();
  const gpt = { setConfig, pubads: () => ({ setPrivacySettings }) };
  const { configureLimitedPrivacy } = await import("./google-publisher-tag");
  configureLimitedPrivacy(gpt as unknown as Parameters<typeof configureLimitedPrivacy>[0], treatment);
  expect(setConfig).toHaveBeenCalledWith({ safeFrame: { forceSafeFrame: true } });
  expect(setPrivacySettings).toHaveBeenCalledWith({ limitedAds: true, childDirectedTreatment: treatment === "CHILD" ? true : null, underAgeOfConsent: treatment === "TEEN" ? true : null });
});
