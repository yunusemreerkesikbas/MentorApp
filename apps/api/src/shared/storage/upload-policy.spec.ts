import { describe, expect, it } from "vitest";
import { NOTEBOOK_IMAGE_MAX_BYTES } from "@mentor/validation";
import { uploadPolicy } from "./upload-policy";

const owner = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";

describe("notebook page upload policy", () => {
  it.each(["jpg", "jpeg", "png", "webp"])("accepts owner-scoped page and entry images (%s)", (ext) => {
    const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    for (const filename of [id, `page-${id}`]) {
      expect(uploadPolicy(`notebook/${owner}/${filename}.${ext}`, owner, mime)).toEqual({
        purpose: "notebook", maxBytes: NOTEBOOK_IMAGE_MAX_BYTES,
      });
    }
  });

  it.each([
    [`avatars/${owner}/page-${id}.png`, "image/png"],
    [`vision-board/${owner}/page-${id}.png`, "image/png"],
    [`notebook/${id}/page-${id}.png`, "image/png"],
    [`notebook/${owner}/page-invalid.png`, "image/png"],
    [`notebook/${owner}/page-page-${id}.png`, "image/png"],
    [`notebook/${owner}/page-${id}.jpg`, "image/png"],
    [`notebook/${owner}/page-${id}.svg`, "image/svg+xml"],
  ])("rejects invalid namespace, owner, filename or type (%s)", (key, mime) => {
    expect(() => uploadPolicy(key, owner, mime)).toThrow();
  });
});
