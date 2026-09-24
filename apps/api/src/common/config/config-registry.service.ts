import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { z } from "zod";
import { isDevToolingAllowed, type Env } from "../../config/env.validation";
import { DomainError } from "../errors/domain-error";
import { ErrorCode } from "../errors/error-code";
import { CONFIG_CATALOG, isConfigKey, type ConfigEntryDef, type ConfigKey } from "./config.catalog";
import { ConfigRepository } from "./config.repository";

/**
 * A config override actually changed. Most knobs are read on demand and need no announcement; a
 * few are kill-switches whose whole point is to act on what ALREADY exists, and those have to
 * reach the module that owns the consequence. Emitting generically keeps that knowledge in the
 * owning module rather than teaching this service, or the admin controller, about anyone's domain.
 */
export const CONFIG_CHANGED_EVENT = "config.changed";

export class ConfigChanged {
  constructor(
    readonly key: string,
    readonly before: unknown,
    readonly after: unknown,
  ) {}
}

/** One row of the admin config view (catalog entry + effective value). */
export interface ConfigEntryView {
  key: string;
  category: string;
  type: string;
  value: unknown;
  sensitive: boolean;
  description: string;
}

export interface ConfigChangeResult {
  before: unknown;
  after: unknown;
}

/**
 * Central config registry (§9, engineering-principles §2/§8). Effective value = DB override ??
 * catalog default. Reads are served from an in-memory cache (lazy-loaded, invalidated on write).
 *
 * Cache scope is the process — fine for the MVP single Render instance; multi-instance invalidation
 * (pub/sub or short TTL) is a Phase-2 concern (see devnote).
 */
@Injectable()
export class ConfigRegistryService {
  private overrides: Map<string, unknown> | null = null;
  private readonly devTooling: boolean;

  constructor(
    private readonly repo: ConfigRepository,
    private readonly events: EventEmitter2,
    env: ConfigService<Env, true>,
  ) {
    this.devTooling = isDevToolingAllowed({
      NODE_ENV: env.get("NODE_ENV", { infer: true }),
      APP_ENV: env.get("APP_ENV", { infer: true }),
    });
  }

  private async ensureLoaded(): Promise<Map<string, unknown>> {
    if (this.overrides === null) {
      this.overrides = await this.repo.getAll();
    }
    return this.overrides;
  }

  /** Outside dev tooling a dev-only key does not exist (see `ConfigEntryDef.devOnly`). */
  private isHidden(key: ConfigKey): boolean {
    return !this.devTooling && (CONFIG_CATALOG[key] as ConfigEntryDef).devOnly === true;
  }

  /** Typed read of a single key: the override if set, otherwise the catalog default. */
  async get<K extends ConfigKey>(key: K): Promise<z.infer<(typeof CONFIG_CATALOG)[K]["schema"]>> {
    const overrides = await this.ensureLoaded();
    // ponytail: dev-only keys are boolean switches, so "off" is false. A non-boolean dev key (an
    // OTP bypass code, say) needs its own production value here first.
    const value = this.isHidden(key)
      ? false
      : overrides.has(key)
        ? overrides.get(key)
        : CONFIG_CATALOG[key].default;
    return value as z.infer<(typeof CONFIG_CATALOG)[K]["schema"]>;
  }

  /** Catalog + effective values, for the admin panel. */
  async list(): Promise<ConfigEntryView[]> {
    const overrides = await this.ensureLoaded();
    const keys = (Object.keys(CONFIG_CATALOG) as ConfigKey[]).filter((key) => !this.isHidden(key));
    return keys.map((key) => {
      const def = CONFIG_CATALOG[key];
      return {
        key,
        category: def.category,
        type: def.type,
        value: overrides.has(key) ? overrides.get(key) : def.default,
        sensitive: def.sensitive,
        description: def.description,
      };
    });
  }

  /**
   * Set an override. Rejects unknown keys (404) and values failing the key's Zod schema (400 with
   * bounds). Returns before/after for the audit trail. Updates the cache after persisting.
   */
  async set(actorId: string, key: string, value: unknown): Promise<ConfigChangeResult> {
    if (!isConfigKey(key) || this.isHidden(key)) {
      throw new DomainError(ErrorCode.ADMIN_CONFIG_KEY_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const parsed = CONFIG_CATALOG[key].schema.safeParse(value);
    if (!parsed.success) {
      throw new DomainError(ErrorCode.ADMIN_CONFIG_INVALID_VALUE, HttpStatus.BAD_REQUEST);
    }
    const overrides = await this.ensureLoaded();
    const before = overrides.has(key) ? overrides.get(key) : CONFIG_CATALOG[key].default;

    await this.repo.upsert(key, parsed.data, actorId);
    overrides.set(key, parsed.data);
    this.events.emit(CONFIG_CHANGED_EVENT, new ConfigChanged(key, before, parsed.data));

    return { before, after: parsed.data };
  }
}
