import { resolve } from "node:path";

import { validateAchievementDirectory } from "./achievement-asset-validator.mjs";

const ids = [
  "first_step",
  "route_drawn",
  "dream_space_created",
  "rhythm_found",
  "rhythm_kept",
  "returned_to_path",
  "route_renewed",
  "starting_point_set",
  "mistake_revisited",
  "week_reflected",
  "first_hello",
  "helped_someone",
];

const directory = resolve(process.cwd(), "public/achievements/puhu");
const errors = await validateAchievementDirectory({
  directory,
  expectedIds: ids,
  maxBytes: 600 * 1024,
});
if (errors.length > 0) {
  process.stderr.write(
    `Achievement asset validation failed:\n- ${errors.join("\n- ")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write("All 12 achievement assets are valid.\n");
}
