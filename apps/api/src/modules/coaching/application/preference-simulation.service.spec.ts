import { describe, expect, it, vi } from "vitest";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { ErrorCode } from "../../../common/errors/error-code";
import { PreferenceSimulationService } from "./preference-simulation.service";

const dataset = {
  version: "yks-2026-guide-2025-placement-v1",
  examType: "YKS" as const,
  guideYear: 2026,
  placementYear: 2025,
  officialPreferenceLimit: 2,
  source: "ÖSYM",
  sourceUrl: "https://www.osym.gov.tr/",
  verifiedAt: "2026-07-30T00:00:00.000Z",
};

const program = {
  code: "102210277",
  name: "Bilgisayar Mühendisliği",
  faculty: "Mühendislik Fakültesi",
  level: "LISANS" as const,
  scoreType: "SAY" as const,
  quota: 80,
  guideYear: 2026,
  placementYear: 2025,
  successRank: 48_250,
  universityId: "11111111-1111-4111-8111-111111111111",
  universityName: "Selçuk Üniversitesi",
  cityCode: "42",
  cityName: "Konya",
  source: "ÖSYM",
  sourceUrl: "https://www.osym.gov.tr/",
  verifiedAt: "2026-07-30T00:00:00.000Z",
};

function createService(options: {
  enabled?: boolean;
  examType?: string | null;
  activeDataset?: typeof dataset | null;
} = {}) {
  const tx = { execute: vi.fn() } as unknown as DatabaseTx;
  const db = {
    transaction: vi.fn(async (callback: (value: DatabaseTx) => Promise<unknown>) =>
      callback(tx),
    ),
  } as unknown as Database;
  const scenarios = {
    findByUser: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    replace: vi.fn(),
    deleteByUser: vi.fn(),
  };
  const catalog = {
    getActiveDataset: vi.fn().mockResolvedValue(
      options.activeDataset === undefined ? dataset : options.activeDataset,
    ),
    findProgramSnapshots: vi.fn().mockResolvedValue([program]),
  };
  const users = {
    getDiscoveryProfile: vi.fn().mockResolvedValue({
      examType: options.examType === undefined ? "YKS" : options.examType,
    }),
  };
  const config = {
    get: vi.fn().mockResolvedValue(options.enabled ?? true),
  };
  return {
    service: new PreferenceSimulationService(
      db,
      scenarios as never,
      catalog as never,
      users as never,
      config as never,
    ),
    scenarios,
    catalog,
    users,
  };
}

describe("PreferenceSimulationService", () => {
  it("keeps the beta closed without reading the user's profile when the flag is off", async () => {
    const { service, users } = createService({ enabled: false });

    await expect(service.getAccess("user-id")).resolves.toEqual({
      enabled: false,
      reason: "FEATURE_DISABLED",
      dataset: null,
    });
    expect(users.getDiscoveryProfile).not.toHaveBeenCalled();
  });

  it("rejects non-YKS profiles before exposing catalogue data", async () => {
    const { service, catalog } = createService({ examType: "KPSS" });

    await expect(service.getAccess("user-id")).resolves.toEqual({
      enabled: false,
      reason: "EXAM_NOT_SUPPORTED",
      dataset: null,
    });
    expect(catalog.getActiveDataset).not.toHaveBeenCalled();
  });

  it("reports DATASET_UNAVAILABLE instead of inventing a preference limit", async () => {
    const { service } = createService({ activeDataset: null });

    await expect(service.getAccess("user-id")).resolves.toEqual({
      enabled: false,
      reason: "DATASET_UNAVAILABLE",
      dataset: null,
    });
  });

  it("enforces the official dataset limit before looking up programs", async () => {
    const { service, catalog } = createService();

    await expect(
      service.put(
        { userId: "user-id", organizationId: null },
        {
          datasetVersion: dataset.version,
          expectedRevision: 0,
          ranks: { SAY: 42_000 },
          programCodes: ["102210277", "102210286", "102210295"],
        },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_PREFERENCE_LIMIT_EXCEEDED,
      httpStatus: 400,
    });
    expect(catalog.findProgramSnapshots).not.toHaveBeenCalled();
  });

  it("rejects a program code absent from the active official catalogue", async () => {
    const { service, catalog } = createService();
    catalog.findProgramSnapshots.mockResolvedValue([]);

    await expect(
      service.put(
        { userId: "user-id", organizationId: null },
        {
          datasetVersion: dataset.version,
          expectedRevision: 0,
          ranks: { SAY: 42_000 },
          programCodes: [program.code],
        },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_PREFERENCE_PROGRAM_INVALID,
      httpStatus: 400,
    });
  });

  it("blocks edits to a stale draft until the user confirms refresh", async () => {
    const { service, scenarios } = createService();
    scenarios.findByUser.mockResolvedValue({
      scenario: {
        datasetVersion: "old-version",
        revision: 3,
      },
      items: [],
    });

    await expect(
      service.put(
        { userId: "user-id", organizationId: null },
        {
          datasetVersion: dataset.version,
          expectedRevision: 3,
          ranks: { SAY: 42_000 },
          programCodes: [program.code],
        },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_PREFERENCE_DATASET_STALE,
      httpStatus: 409,
    });
  });

  it("returns a 409 when another tab has already advanced the revision", async () => {
    const { service, scenarios } = createService();
    scenarios.findByUser.mockResolvedValue({
      scenario: {
        datasetVersion: dataset.version,
        revision: 2,
      },
      items: [],
    });

    await expect(
      service.put(
        { userId: "user-id", organizationId: null },
        {
          datasetVersion: dataset.version,
          expectedRevision: 1,
          ranks: { SAY: 42_000 },
          programCodes: [program.code],
        },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.SCENARIO_REVISION_CONFLICT,
      httpStatus: 409,
    });
    expect(scenarios.replace).not.toHaveBeenCalled();
  });

  it("rejects a catalogue row whose score type is outside the YKS profile", async () => {
    const { service, catalog } = createService();
    catalog.findProgramSnapshots.mockResolvedValue([
      { ...program, scoreType: "INVALID" },
    ]);

    await expect(
      service.put(
        { userId: "user-id", organizationId: null },
        {
          datasetVersion: dataset.version,
          expectedRevision: 0,
          ranks: { SAY: 42_000 },
          programCodes: [program.code],
        },
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_PREFERENCE_SCORE_TYPE_MISMATCH,
      httpStatus: 400,
    });
  });
});
