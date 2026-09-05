const LOCK_NAME = "mentor-auth-session-v1";
const EVENT_NAME = "mentor-auth-session-event-v1";

export type SessionEvent = "logout" | "session-changed";
type Listener = (event: SessionEvent) => void;
export interface SessionLock {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export class SessionRefreshUnavailableError extends Error {
  constructor() {
    super("Coordinated session refresh is unavailable; sign in again.");
  }
}

export class SessionSupersededError extends Error {}

/** Serializes cookie rotation across tabs without persisting access credentials. */
export class AuthSessionCoordinator {
  private revision = 0;
  private refreshInFlight: Promise<unknown> | null = null;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly locks: SessionLock | undefined,
    private readonly publish: Listener = () => {},
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  receive(event: SessionEvent): void {
    this.revision++;
    this.refreshInFlight = null;
    this.listeners.forEach((listener) => listener(event));
  }

  announce(event: SessionEvent): void {
    this.receive(event);
    this.publish(event);
  }

  refresh<T>(operation: () => Promise<T>): Promise<T> {
    // A localStorage lease cannot provide mutual exclusion. Older browsers must
    // sign in again on reload/expiry instead of racing a rotating refresh cookie.
    if (!this.locks) return Promise.reject(new SessionRefreshUnavailableError());
    if (this.refreshInFlight) return this.refreshInFlight as Promise<T>;
    const revision = this.revision;
    const pending = this.locks.request(LOCK_NAME, async () => {
      if (revision !== this.revision) throw new SessionSupersededError();
      const result = await operation();
      if (revision !== this.revision) throw new SessionSupersededError();
      return result;
    });
    this.refreshInFlight = pending;
    void pending.finally(() => {
      if (this.refreshInFlight === pending) this.refreshInFlight = null;
    }).catch(() => {});
    return pending;
  }

  /** Login, signup and logout also mutate the shared cookie, so use the same lock. */
  mutate<T>(operation: () => Promise<T>): Promise<T> {
    return this.locks ? this.locks.request(LOCK_NAME, operation) : operation();
  }
}

let browserCoordinator: AuthSessionCoordinator | undefined;

export function getAuthSessionCoordinator(): AuthSessionCoordinator {
  if (browserCoordinator) return browserCoordinator;
  const channel = typeof BroadcastChannel === "function"
    ? new BroadcastChannel(EVENT_NAME)
    : undefined;
  const coordinator = new AuthSessionCoordinator(navigator.locks, (event) => {
    if (channel) channel.postMessage(event);
    else {
      try {
        // This event contains no token, account identifier or user data.
        localStorage.setItem(EVENT_NAME, JSON.stringify({ event, nonce: crypto.randomUUID() }));
        localStorage.removeItem(EVENT_NAME);
      } catch {
        // Storage-disabled browsers still share the Web Lock for refresh safety.
      }
    }
  });
  const receive = (value: unknown) => {
    if (value === "logout" || value === "session-changed") coordinator.receive(value);
  };
  if (channel) channel.onmessage = (message: MessageEvent<unknown>) => receive(message.data);
  else window.addEventListener("storage", (event) => {
    if (event.key !== EVENT_NAME || !event.newValue) return;
    try { receive((JSON.parse(event.newValue) as { event?: unknown }).event); } catch { /* Ignore malformed events. */ }
  });
  browserCoordinator = coordinator;
  return coordinator;
}
