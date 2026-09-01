import { describe, expect, it, vi } from "vitest";
import { PaymentsEventTopic } from "../domain/payments.events";
import type { SubscriptionRow } from "../infrastructure/payments.repositories";
import { SubscriptionMaintenanceService } from "./subscription-maintenance.service";

const NOW = new Date("2026-06-10T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

function sub(partial: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "s1",
    userId: "u1",
    planId: "premium-monthly",
    status: "ACTIVE",
    provider: "FAKE",
    providerRef: "ref",
    trialEndsAt: null,
    currentPeriodStart: days(-40),
    currentPeriodEnd: days(-10),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    createdAt: days(-40),
    updatedAt: days(-10),
    ...partial,
  } as SubscriptionRow;
}

function makeService(pages: SubscriptionRow[][], options: { markExpired?: boolean } = {}) {
  let call = 0;
  const subsRepo = {
    listMaybeRanOut: vi.fn(async () => pages[call++] ?? []),
    markExpired: vi.fn(async () => options.markExpired ?? true),
  };
  const events = { emit: vi.fn() };
  const service = new SubscriptionMaintenanceService(subsRepo as never, events as never);
  return { service, subsRepo, events };
}

describe("SubscriptionMaintenanceService", () => {
  it("retires a subscription whose paid time ran out and announces it", async () => {
    const { service, subsRepo, events } = makeService([[sub()]]);

    const result = await service.expireNow(NOW);

    expect(result).toEqual({ expired: 1 });
    expect(subsRepo.markExpired).toHaveBeenCalledWith("s1", "ACTIVE");
    expect(events.emit).toHaveBeenCalledWith(
      PaymentsEventTopic.SUBSCRIPTION_EXPIRED,
      expect.objectContaining({ userId: "u1", subscriptionId: "s1", planId: "premium-monthly" }),
    );
  });

  it("leaves a row the wider SQL predicate caught but the real rule spares", async () => {
    // PAST_DUE inside the dunning grace: the query cut-off is intentionally loose, `hasRunOut`
    // is the authority.
    const { service, subsRepo, events } = makeService([[sub({ status: "PAST_DUE", currentPeriodEnd: days(-2) })]]);

    expect(await service.expireNow(NOW)).toEqual({ expired: 0 });
    expect(subsRepo.markExpired).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("does not announce when a concurrent webhook already moved the row", async () => {
    const { service, events } = makeService([[sub()]], { markExpired: false });

    expect(await service.expireNow(NOW)).toEqual({ expired: 0 });
    // The compare-and-set lost — emitting would tell listeners about a transition we did not make.
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("pages with a keyset cursor until a short page ends the sweep", async () => {
    const full = Array.from({ length: 200 }, (_, i) => sub({ id: `s${i}`, userId: `u${i}` }));
    const { service, subsRepo } = makeService([full, [sub({ id: "last", userId: "ulast" })]]);

    const result = await service.expireNow(NOW);

    expect(result.expired).toBe(201);
    expect(subsRepo.listMaybeRanOut).toHaveBeenCalledTimes(2);
    expect(subsRepo.listMaybeRanOut).toHaveBeenLastCalledWith(NOW, 200, "s199");
  });

  it("refuses to run twice at once", async () => {
    const { service, subsRepo } = makeService([[sub()]]);

    const [first, second] = await Promise.all([service.expireNow(NOW), service.expireNow(NOW)]);

    expect([first.expired, second.expired].sort()).toEqual([0, 1]);
    expect(subsRepo.listMaybeRanOut).toHaveBeenCalledTimes(1);
  });
});
