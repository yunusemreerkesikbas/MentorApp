import { expect, it } from "vitest";
import { CAPTIONS } from "../src/captions";
import { PIECES, SIZES } from "../src/pieces";
import { POST_TOP, postTop } from "../src/t1/post";
import { SCENES } from "../src/t1/timeline";

const byId = (id: string) => PIECES.find((p) => p.id === id)!;

it("T1P is the same film in the 4:5 feed size, with T1's caption", () => {
  expect(byId("T1P").format).toBe("feed");
  expect(byId("T1P").video).toEqual(byId("T1").video);
  expect(CAPTIONS.T1P).toEqual(CAPTIONS.T1);
});

it("keeps every scene's 1350 px window inside the 1920 px film", () => {
  const room = 1920 - SIZES.feed.height;
  for (const s of SCENES) {
    expect(POST_TOP[s.id], s.id).toBeGreaterThanOrEqual(0);
    expect(POST_TOP[s.id], s.id).toBeLessThanOrEqual(room);
    expect(postTop(s.from), s.id).toBe(POST_TOP[s.id]);
  }
});
