import { describe, expect, it } from "vitest";
import { firstValueFrom } from "rxjs";
import { take } from "rxjs/operators";
import { NotificationsService, REALTIME_QUEUE_TTL_MS } from "./notifications.service";

/**
 * Regression: the live "study_invite" cue used to be fire-and-forget, so it was lost
 * whenever the recipient had no open SSE stream at that instant (the common case when
 * they're in another window). It must survive briefly and flush on the next connect.
 */
function makeService(): NotificationsService {
  return new NotificationsService(
    {} as never, // db — unused by the realtime paths
    {} as never,
    {} as never,
    {} as never,
  );
}

const USER = "u1";

describe("NotificationsService realtime cue delivery", () => {
  it("delivers straight to an already-connected stream", async () => {
    const svc = makeService();
    const stream = svc.createStream(USER);
    const received = firstValueFrom(stream.pipe(take(1)));

    svc.pushRealtimeEvent(USER, "study_invite", { actorName: "Elif" }, REALTIME_QUEUE_TTL_MS);

    expect((await received).data).toEqual({ event: "study_invite", actorName: "Elif" });
  });

  it("queues for an offline recipient and flushes on their next connect", async () => {
    const svc = makeService();
    // Nobody connected yet — the cue must not be dropped.
    svc.pushRealtimeEvent(USER, "study_invite", { actorName: "Elif" }, REALTIME_QUEUE_TTL_MS);

    const first = await firstValueFrom(svc.createStream(USER).pipe(take(1)));
    expect(first.data).toEqual({ event: "study_invite", actorName: "Elif" });
  });

  it("delivers a queued cue only once", async () => {
    const svc = makeService();
    svc.pushRealtimeEvent(USER, "study_invite", { actorName: "Elif" }, REALTIME_QUEUE_TTL_MS);

    await firstValueFrom(svc.createStream(USER).pipe(take(1)));

    // A second connect must not replay the same invite.
    const events: unknown[] = [];
    const sub = svc.createStream(USER).subscribe((e) => events.push(e.data));
    await new Promise((r) => setTimeout(r, 20));
    sub.unsubscribe();
    expect(events).toEqual([]);
  });

  it("drops a cue that was never queued (no TTL) when nobody is listening", async () => {
    const svc = makeService();
    svc.pushRealtimeEvent(USER, "new_notification"); // no queueTtlMs → fire-and-forget

    const events: unknown[] = [];
    const sub = svc.createStream(USER).subscribe((e) => events.push(e.data));
    await new Promise((r) => setTimeout(r, 20));
    sub.unsubscribe();
    expect(events).toEqual([]);
  });
});
