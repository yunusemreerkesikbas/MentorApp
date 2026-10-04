import { describe, expect, it } from "vitest";
import { weeklyReportFilename } from "../app/[locale]/(coach)/students/[studentId]/weekly-reports/[reportId]/print/weekly-report-pdf";

describe("weeklyReportFilename", () => {
  it("creates a safe and meaningful filename with Turkish characters", () => {
    expect(weeklyReportFilename("İpek Şahin", "2026-09-07")).toBe(
      "ipek-sahin-haftalik-degerlendirme-2026-09-07.pdf",
    );
  });
});
