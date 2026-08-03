import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../database/drizzle";
import { ErrorCode } from "../../../common/errors/error-code";
import type { PreferenceCatalogRepository } from "../infrastructure/preference-catalog.repository";
import { PreferenceCatalogService } from "./preference-catalog.service";

const dataset = {
  id: "dataset-id",
  examType: "YKS",
  version: "yks-2026-guide-2025-placement-v1",
  guideYear: 2026,
  placementYear: 2025,
  officialPreferenceLimit: 24,
  source: "ÖSYM 2026-YKS Yükseköğretim Programları Kılavuzu",
  sourceUrl: "https://www.osym.gov.tr/",
  verifiedAt: new Date("2026-07-30T00:00:00.000Z"),
  isActive: true,
  createdAt: new Date("2026-07-30T00:00:00.000Z"),
  updatedAt: new Date("2026-07-30T00:00:00.000Z"),
};

function createService(overrides: Partial<PreferenceCatalogRepository> = {}) {
  const repository = {
    findActiveDataset: vi.fn().mockResolvedValue(dataset),
    searchPrograms: vi.fn(),
    findProgramsByCodes: vi.fn(),
    findCampusExperience: vi.fn(),
    ...overrides,
  } as unknown as PreferenceCatalogRepository;
  return {
    service: new PreferenceCatalogService({} as Database, repository),
    repository,
  };
}

describe("PreferenceCatalogService", () => {
  it("returns a machine-readable error when no verified dataset is active", async () => {
    const { service } = createService({
      findActiveDataset: vi.fn().mockResolvedValue(undefined),
    });

    await expect(service.search("bilgisayar", 1, 20)).rejects.toMatchObject({
      code: ErrorCode.CONTENT_PROGRAM_DATASET_UNAVAILABLE,
      httpStatus: 503,
    });
  });

  it("preserves the requested program order when creating snapshots", async () => {
    const rows = [
      {
        code: "102210277",
        name: "Bilgisayar Mühendisliği",
        faculty: "Mühendislik Fakültesi",
        level: "LISANS",
        scoreType: "SAY",
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
        verifiedAt: new Date("2026-07-30T00:00:00.000Z"),
      },
      {
        code: "102210286",
        name: "Endüstri Mühendisliği",
        faculty: "Mühendislik Fakültesi",
        level: "LISANS",
        scoreType: "SAY",
        quota: 70,
        guideYear: 2026,
        placementYear: 2025,
        successRank: 62_000,
        universityId: "11111111-1111-4111-8111-111111111111",
        universityName: "Selçuk Üniversitesi",
        cityCode: "42",
        cityName: "Konya",
        source: "ÖSYM",
        sourceUrl: "https://www.osym.gov.tr/",
        verifiedAt: new Date("2026-07-30T00:00:00.000Z"),
      },
    ];
    const { service } = createService({
      findProgramsByCodes: vi.fn().mockResolvedValue(rows),
    });

    const result = await service.findProgramSnapshots(dataset.version, [
      "102210286",
      "102210277",
    ]);

    expect(result.map((program) => program.code)).toEqual([
      "102210286",
      "102210277",
    ]);
  });
});
