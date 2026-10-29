import { describe, expect, it } from "vitest";
import { NOTEBOOK_MAX_PAGES } from "@mentor/validation";
import { ErrorCode } from "../../../common/errors/error-code";
import { CoachingEntitlementRegistry } from "./coaching-entitlement.registry";
import { NotebookQuotaService } from "./notebook-quota.service";

const USER_ID = "55555555-5555-4555-8555-555555555555";
const NOTEBOOK_ID = "13131313-1313-4313-8313-131313131313";
const FAKE_TX = {} as never;

async function makeSetup(opts?: {
  isPremium?: boolean;
  usage?: {
    entryCount?: number;
    photoCount?: number;
    customNotebookCount?: number;
  };
  existingPages?: Set<number>;
  flags?: Partial<{
    "coaching.notebook.photo.free_enabled": boolean;
    "coaching.notebook.photo.free_limit": number;
    "coaching.notebook.custom.free_limit": number;
    "coaching.notebook.pages.free_limit": number;
    "coaching.notebook.entries.free_limit": number;
  }>;
}) {
  const entitlement = new CoachingEntitlementRegistry();
  entitlement.register(async () => opts?.isPremium ?? false);

  const usage = {
    entryCount: opts?.usage?.entryCount ?? 0,
    photoCount: opts?.usage?.photoCount ?? 0,
    customNotebookCount: opts?.usage?.customNotebookCount ?? 0,
  };
  const existingPages = opts?.existingPages ?? new Set<number>();

  const repo = {
    lockQuotaUsage: async () => undefined,
    countUserQuotaUsage: async () => usage,
    findPage: async (
      _tx: unknown,
      _userId: string,
      _nbId: string,
      pageIndex: number,
    ) => (existingPages.has(pageIndex) ? { pageIndex } : undefined),
  };

  const defaults = {
    "coaching.notebook.photo.free_enabled": true,
    "coaching.notebook.photo.free_limit": 5,
    "coaching.notebook.custom.free_limit": 1,
    "coaching.notebook.pages.free_limit": 20,
    "coaching.notebook.entries.free_limit": 50,
    ...opts?.flags,
  };

  const config = {
    get: async (key: keyof typeof defaults) => defaults[key],
  };

  const service = new NotebookQuotaService(
    config as never,
    entitlement,
    repo as never,
  );
  const policy = await service.resolvePolicy(USER_ID);
  return { service, policy, usage, defaults };
}

describe("NotebookQuotaService", () => {
  it("does not grow grandfathered page allowance from the current row count", async () => {
    const { service, policy } = await makeSetup({ existingPages: new Set([...Array.from({ length: 20 }, (_, index) => index), 25]) });
    await expect(
      service.assertCanSavePage(FAKE_TX, USER_ID, NOTEBOOK_ID, 20, policy),
    ).rejects.toMatchObject({ code: ErrorCode.COACHING_NOTEBOOK_PAGE_LIMIT_EXCEEDED });
  });

  it("resolves unlimited quotas for premium users", async () => {
    const { service, policy } = await makeSetup({
      isPremium: true,
      usage: { entryCount: 60, photoCount: 12, customNotebookCount: 4 },
    });

    const limits = await service.resolveLimits(FAKE_TX, USER_ID, policy);
    expect(limits).toEqual({
      isPremium: true,
      maxPages: NOTEBOOK_MAX_PAGES,
      maxCustomNotebooks: null,
      customNotebookCount: 4,
      maxEntries: null,
      entryCount: 60,
      photoUploadEnabled: true,
      maxPhotos: null,
      photoCount: 12,
    });
  });

  it("resolves configured free quotas and disables photoUploadEnabled when quota is reached", async () => {
    const { service, policy } = await makeSetup({
      isPremium: false,
      usage: { entryCount: 10, photoCount: 5, customNotebookCount: 1 },
      flags: { "coaching.notebook.photo.free_limit": 5 },
    });

    const limits = await service.resolveLimits(FAKE_TX, USER_ID, policy);
    expect(limits.isPremium).toBe(false);
    expect(limits.maxPhotos).toBe(5);
    expect(limits.photoCount).toBe(5);
    expect(limits.photoUploadEnabled).toBe(false);
    expect(limits.maxCustomNotebooks).toBe(1);
    expect(limits.maxPages).toBe(20);
    expect(limits.maxEntries).toBe(50);
  });

  it("blocks free photo upload when disabled via boolean toggle or limit is 0", async () => {
    const disabledToggle = await makeSetup({
      flags: { "coaching.notebook.photo.free_enabled": false },
    });
    await expect(
      disabledToggle.service.assertCanUploadPhoto(FAKE_TX, USER_ID, 1, disabledToggle.policy),
    ).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
    });

    const zeroLimit = await makeSetup({
      flags: { "coaching.notebook.photo.free_limit": 0 },
    });
    await expect(
      zeroLimit.service.assertCanUploadPhoto(FAKE_TX, USER_ID, 1, zeroLimit.policy),
    ).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
    });
  });

  it("counts both question and solution photos against free photo limit", async () => {
    const { service, policy } = await makeSetup({
      usage: { photoCount: 4 },
      flags: { "coaching.notebook.photo.free_limit": 5 },
    });

    // Adding 1 photo (4 + 1 <= 5) succeeds.
    await expect(
      service.assertCanUploadPhoto(FAKE_TX, USER_ID, 1, policy),
    ).resolves.toBeUndefined();

    // Adding both question + solution photo (4 + 2 > 5) exceeds the limit.
    await expect(
      service.assertCanCreateEntry(FAKE_TX, USER_ID, 2, policy),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_NOTEBOOK_PHOTO_LIMIT_EXCEEDED,
    });
  });

  it("enforces total mistake entry limit for free users", async () => {
    const { service, policy } = await makeSetup({
      usage: { entryCount: 50 },
      flags: { "coaching.notebook.entries.free_limit": 50 },
    });

    await expect(
      service.assertCanCreateEntry(FAKE_TX, USER_ID, 0, policy),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_NOTEBOOK_ENTRY_LIMIT_EXCEEDED,
    });
  });

  it("enforces custom notebook limit and supports 0 as premium-only", async () => {
    const reached = await makeSetup({
      usage: { customNotebookCount: 1 },
      flags: { "coaching.notebook.custom.free_limit": 1 },
    });
    await expect(
      reached.service.assertCanCreateCustomNotebook(FAKE_TX, USER_ID, reached.policy),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_NOTEBOOK_CUSTOM_LIMIT_EXCEEDED,
    });

    const zeroCustom = await makeSetup({
      usage: { customNotebookCount: 0 },
      flags: { "coaching.notebook.custom.free_limit": 0 },
    });
    await expect(
      zeroCustom.service.assertCanCreateCustomNotebook(FAKE_TX, USER_ID, zeroCustom.policy),
    ).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
    });
  });

  it("enforces page limit for new pages while grandfathering existing pages", async () => {
    const { service, policy } = await makeSetup({
      existingPages: new Set([0, 1, 25]),
      flags: { "coaching.notebook.pages.free_limit": 10 },
    });

    // Page within limit (index 5 < 10) is allowed.
    await expect(
      service.assertCanSavePage(FAKE_TX, USER_ID, NOTEBOOK_ID, 5, policy),
    ).resolves.toBeUndefined();

    // Brand-new page beyond limit (index 12 >= 10) is blocked.
    await expect(
      service.assertCanSavePage(FAKE_TX, USER_ID, NOTEBOOK_ID, 12, policy),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_NOTEBOOK_PAGE_LIMIT_EXCEEDED,
    });

    // Existing page at index 25 is grandfathered and remains editable.
    await expect(
      service.assertCanSavePage(FAKE_TX, USER_ID, NOTEBOOK_ID, 25, policy),
    ).resolves.toBeUndefined();
  });
});
