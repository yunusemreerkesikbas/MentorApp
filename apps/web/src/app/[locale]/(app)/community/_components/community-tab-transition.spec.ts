import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const communityRoot = resolve(process.cwd(), "src/app/[locale]/(app)/community");

describe("community tab transitions", () => {
  it.each([
    "[slug]/_components/zone-shell.tsx",
    "trends/_components/trends-shell.tsx",
  ])("mounts the incoming tab before the outgoing tab finishes: %s", (file) => {
    const source = readFileSync(resolve(communityRoot, file), "utf8");
    expect(source).toContain('<AnimatePresence mode="popLayout" initial={false}>');
    expect(source).not.toContain('<AnimatePresence mode="wait" initial={false}>');
  });
});
