import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForumZoneSeedService } from "./forum-zone-seed.service";

describe("ForumZoneSeedService", () => {
  let seedZone: ReturnType<typeof vi.fn>;

  const service = () => new ForumZoneSeedService({ seedZone } as never);

  beforeEach(() => {
    vi.restoreAllMocks();
    seedZone = vi.fn(async () => true);
  });

  it("seeds the launch zones with their STABLE slugs (never re-slugified)", async () => {
    await service().onModuleInit();

    const slugs = seedZone.mock.calls.map((call) => (call[0] as { slug: string }).slug);
    expect(slugs).toEqual(["genel-sohbet", "soru-cevap"]);
    // A timestamped slug (ForumService.slugify) would break idempotency across restarts.
    for (const slug of slugs) expect(slug).toMatch(/^[a-z-]+$/);

    const types = seedZone.mock.calls.map((call) => (call[0] as { type: string }).type);
    expect(types).toEqual(["CHAT", "QA"]); // The hub can recommend both launch room formats.
  });

  it("is idempotent: a second boot inserts nothing (unique slug conflict)", async () => {
    await service().onModuleInit();
    expect(seedZone).toHaveBeenCalledTimes(2);

    // Second run — the repo reports "already there" for every zone.
    seedZone.mockClear();
    seedZone.mockResolvedValue(false);
    const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    await service().onModuleInit();

    expect(seedZone).toHaveBeenCalledTimes(2); // attempted…
    expect(logSpy.mock.calls.flat().join(" ")).toContain("0 created"); // …but created none
  });

  it("never crashes boot when seeding fails", async () => {
    seedZone.mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    await expect(service().onModuleInit()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
