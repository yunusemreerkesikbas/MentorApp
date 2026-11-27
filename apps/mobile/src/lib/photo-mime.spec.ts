import assert from "node:assert/strict";
import { test } from "node:test";
import { photoMimeType } from "./photo-mime.ts";

test("photoMimeType keeps a reported image type", () => {
  assert.equal(photoMimeType("image/png", "file:///a/b.png"), "image/png");
  assert.equal(photoMimeType("IMAGE/JPEG", "file:///a/b"), "image/jpeg");
});

test("photoMimeType falls back to the extension when Android leaves the type out", () => {
  assert.equal(photoMimeType(undefined, "file:///cache/ImagePicker/x.PNG"), "image/png");
  assert.equal(photoMimeType("", "content://media/x.jpg?v=1"), "image/jpeg");
  assert.equal(photoMimeType("application/octet-stream", "file:///x.png"), "image/png");
});

test("photoMimeType maps aliases and rejects what is not an image", () => {
  assert.equal(photoMimeType("image/x-png", "file:///x"), "image/png");
  assert.equal(photoMimeType("image/jpg", "file:///x"), "image/jpeg");
  assert.equal(photoMimeType(undefined, "file:///x.heic"), null);
  assert.equal(photoMimeType("image/gif", "file:///x.gif"), null);
});
