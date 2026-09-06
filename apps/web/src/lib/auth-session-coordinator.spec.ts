import { describe, expect, it, vi } from "vitest";
import {
  AuthSessionCoordinator,
  SessionRefreshUnavailableError,
  SessionSupersededError,
  type SessionLock,
} from "./auth-session-coordinator";

function sharedLock(): SessionLock {
  let queue = Promise.resolve();
  return {
    request: <T>(_name: string, operation: () => Promise<T>) => {
      const result = queue.then(operation);
      queue = result.then(() => {}, () => {});
      return result;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("AuthSessionCoordinator", () => {
  it("serializes two tabs so the second sends the rotated cookie", async () => {
    const locks = sharedLock();
    const firstTab = new AuthSessionCoordinator(locks);
    const secondTab = new AuthSessionCoordinator(locks);
    let cookie = 0;
    const observed: number[] = [];
    const response = deferred<void>();
    const first = firstTab.refresh(async () => {
      observed.push(cookie);
      await response.promise;
      cookie++;
    });
    const second = secondTab.refresh(async () => { observed.push(cookie); cookie++; });
    await Promise.resolve();
    expect(observed).toEqual([0]);
    response.resolve();
    await Promise.all([first, second]);
    expect(observed).toEqual([0, 1]);
  });

  it("shares one in-flight refresh within a tab, including Strict Mode mounts", async () => {
    const tab = new AuthSessionCoordinator(sharedLock());
    const rotate = vi.fn(async () => "access-in-memory");
    await expect(Promise.all([tab.refresh(rotate), tab.refresh(rotate)])).resolves.toEqual([
      "access-in-memory", "access-in-memory",
    ]);
    expect(rotate).toHaveBeenCalledTimes(1);
  });

  it("cancels a queued refresh when another tab logs out", async () => {
    const locks = sharedLock();
    const blocker = deferred<void>();
    const blockingRequest = locks.request("mentor-auth-session-v1", () => blocker.promise);
    const tab = new AuthSessionCoordinator(locks);
    const rotate = vi.fn(async () => "stale");
    const refresh = tab.refresh(rotate);
    const rejection = expect(refresh).rejects.toBeInstanceOf(SessionSupersededError);
    tab.receive("logout");
    blocker.resolve();
    await blockingRequest;
    await rejection;
    expect(rotate).not.toHaveBeenCalled();
  });

  it("discards a late response after logout and orders server logout after rotation", async () => {
    const tab = new AuthSessionCoordinator(sharedLock());
    const response = deferred<string>();
    const order: string[] = [];
    const refresh = tab.refresh(async () => { order.push("refresh"); return response.promise; });
    const rejection = expect(refresh).rejects.toBeInstanceOf(SessionSupersededError);
    await Promise.resolve();
    tab.announce("logout");
    const logout = tab.mutate(async () => { order.push("logout"); });
    response.resolve("stale");
    await rejection;
    await logout;
    expect(order).toEqual(["refresh", "logout"]);
  });

  it("does not send an unsafe automatic refresh when Web Locks is unavailable", async () => {
    const tab = new AuthSessionCoordinator(undefined);
    const rotate = vi.fn(async () => "token");
    await expect(tab.refresh(rotate)).rejects.toBeInstanceOf(SessionRefreshUnavailableError);
    expect(rotate).not.toHaveBeenCalled();
    await expect(tab.mutate(async () => "interactive-login")).resolves.toBe("interactive-login");
  });

  it("publishes only tokenless invalidations and releases failed locks", async () => {
    const publish = vi.fn();
    const listener = vi.fn();
    const tab = new AuthSessionCoordinator(sharedLock(), publish);
    const unsubscribe = tab.subscribe(listener);
    tab.announce("session-changed");
    expect(publish).toHaveBeenCalledWith("session-changed");
    expect(listener).toHaveBeenCalledWith("session-changed");
    unsubscribe();
    await expect(tab.refresh(async () => { throw new Error("lost response"); })).rejects.toThrow("lost response");
    await expect(tab.refresh(async () => "new-session")).resolves.toBe("new-session");
  });
});
