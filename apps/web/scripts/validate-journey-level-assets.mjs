import { resolve } from "node:path";

import { validateJourneyLevelDirectory } from "./journey-level-asset-validator.mjs";

const ids = [
  "spark",
  "trail",
  "compass",
  "cycle",
  "rhythm",
  "flow",
  "root",
  "wing",
  "horizon",
  "lantern",
  "star",
  "constellation",
];

const directory = resolve(process.cwd(), "public/journey-levels/puhu");
const errors = await validateJourneyLevelDirectory({
  directory,
  expectedIds: ids,
  maxBytes: 300 * 1024,
});

if (errors.length > 0) {
  process.stderr.write(
    `Journey-level asset validation failed:\n- ${errors.join("\n- ")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write("All 12 journey-level assets are valid.\n");
}

