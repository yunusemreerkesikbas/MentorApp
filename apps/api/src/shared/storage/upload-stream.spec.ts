import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { readUploadStream } from "./upload-stream";

describe("readUploadStream", () => {
  it("discards the rest of an oversized request before returning 413", async () => {
    const stream = new PassThrough();
    let settled = false;
    const result = readUploadStream(stream, 4, 1_000)
      .then(() => undefined, (error: unknown) => error)
      .finally(() => { settled = true; });

    stream.write(Buffer.alloc(5));
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);

    stream.end(Buffer.alloc(5));
    await expect(result).resolves.toMatchObject({ httpStatus: 413 });
  });
});
