import { describe, expect, it } from "vitest";
import {
  CONTENTS_NOTE_TITLE_MAX,
  firstNoteLine,
  summarizeNotebookPages,
  type ContentsEntryInput,
} from "./notebook-contents.policy";

const entry = (
  id: string,
  subject: [string, string] | null,
  topic: [string, string] | null,
  due = false,
): ContentsEntryInput => ({
  id,
  subjectRef: subject?.[0] ?? null,
  subjectName: subject?.[1] ?? null,
  topicRef: topic?.[0] ?? null,
  topicName: topic?.[1] ?? null,
  due,
});

const card = (entryId: string, y = 0) => ({ kind: "entry", entryId, x: 0, y });
const note = (text: string, y: number, x = 0) => ({ kind: "text", text, x, y });

describe("notebook contents", () => {
  it("leaves out pages with nothing on them and keeps page order", () => {
    const rows = summarizeNotebookPages(
      [
        { pageIndex: 4, items: [note("Sonra", 0)], inkCount: 0 },
        { pageIndex: 1, items: [], inkCount: 0 },
        { pageIndex: 0, items: [], inkCount: 3 },
      ],
      new Map(),
    );
    expect(rows.map((row) => row.pageIndex)).toEqual([0, 4]);
    expect(rows[0]).toMatchObject({ noteTitle: null, inkCount: 3, entryCount: 0 });
  });

  it("titles a page by the note a reader meets first", () => {
    expect(
      firstNoteLine([
        note("Alttaki not", 900),
        note("\n  Osmanlı   kuruluş \n ikinci satır", 120, 400),
        note("Soldaki", 120, 40),
      ]),
    ).toBe("Soldaki");
    expect(firstNoteLine([note("   ", 10), note("Asıl başlık", 20)])).toBe(
      "Asıl başlık",
    );
    expect(firstNoteLine([{ kind: "sticker", x: 0, y: 0 }])).toBeNull();
    expect(firstNoteLine("not an array")).toBeNull();
  });

  it("caps a long first line", () => {
    const line = firstNoteLine([note("a".repeat(200), 0)]);
    expect(line).toHaveLength(CONTENTS_NOTE_TITLE_MAX);
    expect(line?.endsWith("…")).toBe(true);
  });

  it("names a page of cards after the topic most of them were filed under", () => {
    const entries = new Map(
      [
        entry("e1", ["matematik", "Matematik"], ["oran", "Oran orantı"], true),
        entry("e2", ["matematik", "Matematik"], ["oran", "Oran orantı"]),
        entry("e3", ["tarih", "Tarih"], ["kurulus", "Kuruluş dönemi"], true),
        entry("e4", ["matematik", "Matematik"], null),
      ].map((value) => [value.id, value]),
    );
    const [row] = summarizeNotebookPages(
      [
        {
          pageIndex: 2,
          items: [
            card("e3"),
            card("e1"),
            card("e2"),
            card("e4"),
            card("deleted-entry"),
            { kind: "sticker", x: 0, y: 0 },
          ],
          inkCount: 0,
        },
      ],
      entries,
    );
    expect(row).toEqual({
      pageIndex: 2,
      noteTitle: null,
      topicName: "Oran orantı",
      subjectRef: "matematik",
      subjectName: "Matematik",
      entryCount: 4,
      dueCount: 2,
      stickerCount: 1,
      inkCount: 0,
    });
  });

  it("reads a malformed document without throwing", () => {
    const rows = summarizeNotebookPages(
      [
        { pageIndex: 0, items: [null, 3, { kind: "entry" }], inkCount: Number.NaN },
        { pageIndex: 1, items: { not: "an array" }, inkCount: 2 },
      ],
      new Map(),
    );
    expect(rows).toEqual([
      expect.objectContaining({ pageIndex: 0, entryCount: 0, inkCount: 0 }),
      expect.objectContaining({ pageIndex: 1, inkCount: 2 }),
    ]);
  });
});
