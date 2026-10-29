import { describe, expect, it } from "vitest";
import type { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { PublicPulseRepository } from "../infrastructure/public-pulse.repository";
import { PublicPulseService } from "./public-pulse.service";

const NOW = new Date("2026-10-28T20:00:00.000Z");

function service(people: number, minPeople = 100) {
  const calls: Date[] = [];
  const repository = {
    studiedSince: async (since: Date) => {
      calls.push(since);
      return people;
    },
  } as unknown as PublicPulseRepository;
  const config = { get: async () => minPeople } as unknown as ConfigRegistryService;
  return { pulse: new PublicPulseService(repository, config), calls };
}

describe("PublicPulseService", () => {
  it("hides the count below the threshold", async () => {
    const { pulse } = service(99);
    expect(await pulse.get(NOW)).toEqual({ studiedLast24h: null });
  });

  it("shows the count from the threshold up", async () => {
    const { pulse } = service(100);
    expect(await pulse.get(NOW)).toEqual({ studiedLast24h: 100 });
  });

  it("counts the last 24 hours", async () => {
    const { pulse, calls } = service(1284);
    await pulse.get(NOW);
    expect(calls).toEqual([new Date("2026-10-27T20:00:00.000Z")]);
  });
});
