import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("standalone SSR fixture supplies explicit enabled availability", { timeout: 15000 }, async () => {
  const child = spawn(process.execPath, ["--experimental-strip-types", fileURLToPath(new URL("../e2e/fixtures/public-question-api.ts", import.meta.url))], {
    stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true, env: { ...process.env, QA_QUESTION_API_PORT: "0" },
  });
  const exited = once(child, "exit");
  try {
    const [{ port }] = await Promise.race([once(child, "message"), exited.then(() => { throw new Error("Fixture did not start"); })]);
    const response = await fetch(`http://localhost:${port}/v1/app/availability`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      aiCoach: true, coachPurchases: true, coachRegistration: true, coachSignup: true, forum: true,
      humanCoaching: true, invites: true, social: true, studentPurchases: true, studentSignup: true, studyRooms: true,
    });
  } finally {
    child.kill();
    await exited;
  }
});
