import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it.each([null, "rejected"])("does not touch the Google tag without advertising permission (%s)", async (value) => {
  const appendChild = vi.fn();
  vi.stubGlobal("window", { localStorage: { getItem: () => value } });
  vi.stubGlobal("document", { head: { appendChild } });
  const { loadLimitedGpt } = await import("./google-publisher-tag");
  await expect(loadLimitedGpt()).rejects.toThrow(/consent/i);
  expect(appendChild).not.toHaveBeenCalled();
});

it("rechecks consent when a queued GPT command finally executes", async () => {
  let consent = "accepted";
  const gpt = { cmd: [] as Array<() => void> };
  vi.stubGlobal("window", { localStorage: { getItem: () => consent }, googletag: gpt });
  vi.stubGlobal("document", { querySelector: () => ({ dataset: { loaded: "true" } }) });
  const { withGpt, loadLimitedGpt } = await import("./google-publisher-tag");
  const run = vi.fn();
  const pending = withGpt(run);
  await vi.waitFor(() => expect(gpt.cmd).toHaveLength(1));
  consent = "rejected";
  gpt.cmd[0]!();
  await expect(pending).rejects.toThrow(/consent/i);
  await expect(loadLimitedGpt()).rejects.toThrow(/consent/i);
  expect(run).not.toHaveBeenCalled();
});
