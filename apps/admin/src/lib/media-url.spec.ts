import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveMediaUrl } from "./media-url";

afterEach(() => vi.unstubAllEnvs());
describe("review media URL resolution", () => {
  it("loads fake-storage avatars and attachments from the API host", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3001/v1");
    expect(resolveMediaUrl("/v1/storage/fake-object?key=forum/image.webp")).toBe("http://localhost:3001/v1/storage/fake-object?key=forum/image.webp");
  });
  it("preserves production CDN image URLs", () => {
    expect(resolveMediaUrl("https://images.example.test/forum/image.webp")).toBe("https://images.example.test/forum/image.webp");
  });
});
