import { describe, expect, it, vi } from "vitest";
import { migrateLegacyPrivateObject } from "./private-media-migration";

describe("legacy private-media migration", () => {
  it("does not mutate either bucket without the explicit apply flag", async () => {
    const send = vi.fn();
    await expect(
      migrateLegacyPrivateObject(
        { send } as never,
        "public",
        "private",
        { key: "notebook/u1/a.png", size: 10 },
        false,
      ),
    ).resolves.toBe("planned");
    expect(send).not.toHaveBeenCalled();
  });

  it("copies with private cache metadata, verifies size, then deletes the public source", async () => {
    const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
    const send = vi.fn(async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      calls.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === "HeadObjectCommand") {
        return { ContentLength: 10, ContentType: "image/png" };
      }
      return {};
    });

    await expect(
      migrateLegacyPrivateObject(
        { send } as never,
        "public",
        "private",
        { key: "vision-board/u1/a b.png", size: 10 },
        true,
      ),
    ).resolves.toBe("migrated");

    expect(calls.map((call) => call.name)).toEqual([
      "HeadObjectCommand",
      "CopyObjectCommand",
      "HeadObjectCommand",
      "DeleteObjectCommand",
    ]);
    expect(calls[1]?.input).toMatchObject({
      Bucket: "private",
      CopySource: "public/vision-board/u1/a%20b.png",
      CacheControl: "private, no-store",
      MetadataDirective: "REPLACE",
    });
    expect(calls[3]?.input).toMatchObject({ Bucket: "public" });
  });

  it("keeps the public source when destination verification fails", async () => {
    let headCount = 0;
    const send = vi.fn(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "HeadObjectCommand") {
        headCount += 1;
        return { ContentLength: headCount === 1 ? 10 : 9, ContentType: "image/png" };
      }
      return {};
    });

    await expect(
      migrateLegacyPrivateObject(
        { send } as never,
        "public",
        "private",
        { key: "notebook/u1/a.png", size: 10 },
        true,
      ),
    ).rejects.toThrow(/size/);
    expect(
      send.mock.calls.some(([command]) => command.constructor.name === "DeleteObjectCommand"),
    ).toBe(false);
  });
});
