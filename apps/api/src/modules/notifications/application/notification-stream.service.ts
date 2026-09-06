import { Injectable, type MessageEvent, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { from, interval, Observable, Subject } from "rxjs";
import { exhaustMap } from "rxjs/operators";
import { UnauthorizedError } from "../../../common/errors/domain-error";
import { TokenService } from "../../identity/application/token.service";

const STREAM_TOKEN_TTL_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
export const REALTIME_QUEUE_TTL_MS = 5 * 60_000;
export interface StreamPrincipal { userId: string; sessionId: string }

/** Process-local, one-time SSE tickets always retain their originating login session. */
@Injectable()
export class NotificationStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly tokens = new Map<string, StreamPrincipal & { exp: number }>();
  private readonly streams = new Map<string, Set<Subject<MessageEvent>>>();
  private readonly pending = new Map<string, { data: Record<string, unknown>; exp: number }>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly sessions: TokenService) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [token, entry] of this.tokens) if (entry.exp <= now) this.tokens.delete(token);
      for (const [userId, entry] of this.pending) if (entry.exp <= now) this.pending.delete(userId);
    }, STREAM_TOKEN_TTL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
    for (const set of this.streams.values()) for (const subject of set) subject.complete();
    this.streams.clear();
    this.tokens.clear();
    this.pending.clear();
  }

  createStreamToken(userId: string, sessionId: string): string {
    const token = randomUUID();
    this.tokens.set(token, { userId, sessionId, exp: Date.now() + STREAM_TOKEN_TTL_MS });
    return token;
  }

  validateAndConsumeStreamToken(token: string): StreamPrincipal {
    const entry = this.tokens.get(token);
    this.tokens.delete(token);
    if (!entry || entry.exp <= Date.now()) throw new UnauthorizedError();
    return { userId: entry.userId, sessionId: entry.sessionId };
  }

  async createStream(userId: string, sessionId: string): Promise<Observable<MessageEvent>> {
    await this.sessions.validateSession(sessionId, userId);
    return new Observable<MessageEvent>((subscriber) => {
      const subject = new Subject<MessageEvent>();
      let set = this.streams.get(userId);
      if (!set) { set = new Set(); this.streams.set(userId, set); }
      set.add(subject);
      const live = subject.subscribe(subscriber);
      const heartbeat = interval(HEARTBEAT_INTERVAL_MS).pipe(
        exhaustMap(() => from(this.sessions.validateSession(sessionId, userId))),
      ).subscribe({
        next: () => subscriber.next({ data: "" }),
        // Revocation, account deletion, expiry or a failed auth lookup closes the stream.
        error: () => subscriber.complete(),
      });
      const queued = this.pending.get(userId);
      this.pending.delete(userId);
      if (queued && queued.exp > Date.now()) subscriber.next({ data: queued.data });
      return () => {
        heartbeat.unsubscribe();
        live.unsubscribe();
        set.delete(subject);
        if (set.size === 0) this.streams.delete(userId);
      };
    });
  }

  pushRealtimeEvent(userId: string, event: string, extra?: Record<string, unknown>, queueTtlMs?: number): void {
    const data = { event, ...extra };
    const set = this.streams.get(userId);
    if (set?.size) {
      for (const subject of set) subject.next({ data });
    } else if (queueTtlMs) {
      this.pending.set(userId, { data, exp: Date.now() + queueTtlMs });
    }
  }
}
