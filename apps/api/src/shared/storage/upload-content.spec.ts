import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { validateUploadContent } from "./upload-content";
import { readUploadStream } from "./upload-stream";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=", "base64");

describe("upload content", () => {
  it("accepts a complete PNG and rejects declared MIME mismatch", () => {
    expect(() => validateUploadContent(png, "image/png")).not.toThrow();
    expect(() => validateUploadContent(png, "image/jpeg")).toThrow();
  });
  it("rejects executable content disguised as an image and truncated image headers", () => {
    expect(() => validateUploadContent(Buffer.from("<svg onload='alert(1)'/>"), "image/png")).toThrow();
    expect(() => validateUploadContent(png.subarray(0, 24), "image/png")).toThrow();
  });
  it("rejects active PDF actions including escaped PDF names", () => {
    expect(() => validateUploadContent(Buffer.from("%PDF-1.7\n1 0 obj <</J#53 (alert(1))>> endobj\n%%EOF"), "application/pdf")).toThrow();
  });
  it("rejects a ZIP header pretending to be OOXML", () => {
    expect(() => validateUploadContent(Buffer.from("PK\x03\x04fake"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toThrow();
  });
});

describe("upload streaming limit", () => {
  it("accepts exactly the cap", async () => {
    await expect(readUploadStream(Readable.from([Buffer.from("123"), Buffer.from("45")]), 5, 1000)).resolves.toEqual(Buffer.from("12345"));
  });
  it("rejects chunked overflow without collecting subsequent chunks", async () => {
    await expect(readUploadStream(Readable.from([Buffer.alloc(4), Buffer.alloc(4)]), 5, 1000)).rejects.toMatchObject({ httpStatus: 413 });
  });
  it("rejects empty streams", async () => {
    await expect(readUploadStream(Readable.from([]), 5, 1000)).rejects.toThrow();
  });
});
