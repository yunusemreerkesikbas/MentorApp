import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@mentor/api-client", () => ({ http: vi.fn() }));
import { http } from "@mentor/api-client";
import { findExamReference } from "./exam-reference";
describe("exam reference lookup", () => {
  beforeEach(() => vi.mocked(http).mockReset());
  it("finds an older exam beyond the first page", async () => {
    vi.mocked(http).mockResolvedValueOnce({ items: [{ id: "other" }], page: 1, pageSize: 1, total: 2 }).mockResolvedValueOnce({ items: [{ id: "wanted", name: "Old exam" }], page: 2, pageSize: 1, total: 2 });
    await expect(findExamReference("wanted")).resolves.toMatchObject({ name: "Old exam" });
    expect(http).toHaveBeenLastCalledWith("/v1/content/exams?page=2&pageSize=100");
  });
  it("does not silently substitute another exam", async () => {
    vi.mocked(http).mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    await expect(findExamReference("missing")).resolves.toBeNull();
  });
});
