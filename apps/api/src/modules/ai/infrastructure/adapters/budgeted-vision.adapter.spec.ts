import { describe, expect, it, vi } from "vitest";
import type { VisionPort } from "../../domain/vision.port";
import { BudgetedVisionAdapter } from "./budgeted-vision.adapter";

const input = {
  imageBytes: Buffer.from("image"),
  mimeType: "image/png",
  allowedSubjects: [],
  allowedTopics: [],
};

describe("BudgetedVisionAdapter", () => {
  it("attaches the atomic reservation to successful provider usage", async () => {
    const delegate = {
      categorizeImage: vi.fn(async () => ({
        subjectSlug: null,
        topicSlug: null,
        model: "vision",
        promptTokens: 10,
        completionTokens: 1,
      })),
    } as VisionPort;
    const adapter = new BudgetedVisionAdapter(delegate, {
      acquire: vi.fn(async () => "budget-id"),
      release: vi.fn(async () => undefined),
    } as never);

    await expect(adapter.categorizeImage(input)).resolves.toMatchObject({
      budgetReservationId: "budget-id",
    });
  });

  it("releases the reservation when classification fails", async () => {
    const release = vi.fn(async () => undefined);
    const adapter = new BudgetedVisionAdapter(
      { categorizeImage: vi.fn(async () => { throw new Error("vision down"); }) },
      { acquire: vi.fn(async () => "budget-id"), release } as never,
    );

    await expect(adapter.categorizeImage(input)).rejects.toThrow("vision down");
    expect(release).toHaveBeenCalledWith("budget-id");
  });
});
