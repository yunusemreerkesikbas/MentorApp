import { beforeEach, describe, expect, it } from "vitest";
import { ErrorCode } from "../errors/error-code";
import { DomainError } from "../errors/domain-error";
import { ConfigRegistryService } from "./config-registry.service";
import { CONFIG_CATALOG, FeatureFlag, type ConfigEntryDef } from "./config.catalog";

/** In-memory fake of ConfigRepository. */
function makeRepoFake(initial: Record<string, unknown> = {}) {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    map,
    getAll: async () => new Map(map),
    upsert: async (key: string, value: unknown) => {
      map.set(key, value);
    },
  };
}

/** Env reader fake: the registry only asks for NODE_ENV / APP_ENV. */
function makeEnvFake(env: Record<string, string | undefined>) {
  return { get: (key: string) => env[key] };
}

describe("ConfigRegistryService", () => {
  let service: ConfigRegistryService;

  let emitted: { topic: string; payload: unknown }[] = [];

  beforeEach(() => {
    emitted = [];
    service = new ConfigRegistryService(
      makeRepoFake() as never,
      {
        emit: (topic: string, payload: unknown) => {
          emitted.push({ topic, payload });
          return true;
        },
      } as never,
      makeEnvFake({ NODE_ENV: "test" }) as never,
    );
  });

  it("returns the catalog default when no override exists", async () => {
    expect(await service.get(FeatureFlag.AI_ENABLED)).toBe(true);
    expect(await service.get(FeatureFlag.ECONOMY_ENABLED)).toBe(false);
  });

  it("returns the override when set, and reflects it immediately (cache updated)", async () => {
    await service.set("admin", FeatureFlag.ECONOMY_ENABLED, true);
    expect(await service.get(FeatureFlag.ECONOMY_ENABLED)).toBe(true);
  });

  it("set reports before/after", async () => {
    const res = await service.set("admin", FeatureFlag.SIGNUP_ENABLED, false);
    expect(res.before).toBe(true);
    expect(res.after).toBe(false);
  });

  it("rejects an unknown key (ADMIN_CONFIG_KEY_NOT_FOUND)", async () => {
    await expect(service.set("admin", "nope.key", true)).rejects.toMatchObject({
      constructor: DomainError,
      code: ErrorCode.ADMIN_CONFIG_KEY_NOT_FOUND,
    });
  });

  it("rejects a value failing the key's schema (ADMIN_CONFIG_INVALID_VALUE)", async () => {
    await expect(service.set("admin", FeatureFlag.AI_ENABLED, "yes")).rejects.toMatchObject({
      constructor: DomainError,
      code: ErrorCode.ADMIN_CONFIG_INVALID_VALUE,
    });
  });

  it("list returns every catalog entry with its effective value", async () => {
    await service.set("admin", FeatureFlag.ECONOMY_ENABLED, true);
    const list = await service.list();
    const economy = list.find((e) => e.key === FeatureFlag.ECONOMY_ENABLED);
    expect(economy).toMatchObject({ category: "feature-flags", type: "boolean", value: true });
    expect(list.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * Kill switches only work if the module that owns the consequence hears about the flip. Most
   * keys are read on demand and need nothing; this event is what lets one act on what already
   * exists (W8's sponsorship brake listens for exactly this).
   */
  it("announces a change so a kill switch can act on what already exists", async () => {
    await service.set("admin", FeatureFlag.AI_ENABLED, false);
    expect(emitted).toEqual([
      {
        topic: "config.changed",
        payload: expect.objectContaining({ key: FeatureFlag.AI_ENABLED, after: false }),
      },
    ]);
  });
});

/**
 * Dev-only keys switch on things production must never do (console email prints reset links).
 * An admin toggle is not enough of a lock, so outside dev tooling the key must not exist at all,
 * even when a DB copied from staging still carries an override for it.
 */
describe("ConfigRegistryService dev-only keys", () => {
  const DEV_KEY = "dev.email.console_enabled";
  const make = (env: Record<string, string | undefined>, overrides: Record<string, unknown> = {}) =>
    new ConfigRegistryService(
      makeRepoFake(overrides) as never,
      { emit: () => true } as never,
      makeEnvFake(env) as never,
    );

  it("exposes them in dev tooling environments, on by default", async () => {
    const service = make({ NODE_ENV: "development" });
    expect(await service.get(DEV_KEY)).toBe(true);
    expect((await service.list()).find((e) => e.key === DEV_KEY)).toMatchObject({
      category: "dev",
      type: "boolean",
      value: true,
    });
  });

  it("hides them in production: unlisted, unwritable, read as off despite a stored override", async () => {
    const service = make({ NODE_ENV: "production" }, { [DEV_KEY]: true });
    expect(await service.get(DEV_KEY)).toBe(false);
    expect((await service.list()).some((e) => e.key === DEV_KEY)).toBe(false);
    await expect(service.set("admin", DEV_KEY, true)).rejects.toMatchObject({
      constructor: DomainError,
      code: ErrorCode.ADMIN_CONFIG_KEY_NOT_FOUND,
    });
  });

  it("unlocks them on staging, which runs NODE_ENV=production", async () => {
    const service = make({ NODE_ENV: "production", APP_ENV: "staging" });
    expect(await service.get(DEV_KEY)).toBe(true);
    await service.set("admin", DEV_KEY, false);
    expect(await service.get(DEV_KEY)).toBe(false);
  });

  it("keeps every dev-only key a boolean switch, so 'off' has one meaning", () => {
    const devOnly = Object.values(CONFIG_CATALOG).filter((def) => (def as ConfigEntryDef).devOnly);
    expect(devOnly.length).toBeGreaterThan(0);
    for (const def of devOnly) expect(def.type).toBe("boolean");
  });
});
