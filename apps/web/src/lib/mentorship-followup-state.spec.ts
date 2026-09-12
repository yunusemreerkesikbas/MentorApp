import { describe, expect, it, vi } from "vitest";

import {
  appendUniqueById,
  istanbulDate,
  operationForDraft,
} from "./mentorship-followup-state";

const draft = {
  title: "Haftalık değerlendirme",
  privateNote: "Koça özel bağlam",
  sharedDecision: "Paragraf çalışmasına devam",
  followUpDate: "2026-09-15",
  replacesId: null,
};

describe("follow-up mutation state", () => {
  it("reuses the operation id for an unchanged retry and rotates it after an edit", () => {
    const createId = vi.fn().mockReturnValueOnce("first").mockReturnValueOnce("second");
    const first = operationForDraft(null, draft, createId);
    const retry = operationForDraft(first, { ...draft }, createId);
    const edited = operationForDraft(first, { ...draft, title: "Yeni başlık" }, createId);

    expect(retry).toBe(first);
    expect(edited.operationId).toBe("second");
    expect(createId).toHaveBeenCalledTimes(2);
  });

  it("calculates the minimum scheduling date in Istanbul", () => {
    expect(istanbulDate(new Date("2026-09-11T21:30:00.000Z"))).toBe("2026-09-12");
  });

  it("appends pages without duplicating an item returned across a page boundary", () => {
    expect(
      appendUniqueById(
        [{ id: "one", value: 1 }],
        [
          { id: "one", value: 2 },
          { id: "two", value: 3 },
        ],
      ),
    ).toEqual([
      { id: "one", value: 1 },
      { id: "two", value: 3 },
    ]);
  });
});
