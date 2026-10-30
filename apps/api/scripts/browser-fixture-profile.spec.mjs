import assert from "node:assert/strict";
import { test } from "node:test";
import { browserFixtureDatabase, browserFixtureFlags } from "./browser-fixture-profile.mjs";

const env = { NODE_ENV: "test", APP_ENV: "development", TEST_DATABASE_URL: "postgres://mentor:mentor@127.0.0.1:5433/browser_test" };
test("accepts only explicit loopback test databases outside production", () => {
  assert.equal(browserFixtureDatabase(env), env.TEST_DATABASE_URL);
  for (const change of [
    { NODE_ENV: "production" }, { APP_ENV: "production" }, { TEST_DATABASE_URL: undefined },
    { TEST_DATABASE_URL: "postgres://host.example/browser_test" },
    { TEST_DATABASE_URL: "postgres://localhost/mentor" },
    { TEST_DATABASE_URL: `${env.TEST_DATABASE_URL}?host=remote.example` },
    { DATABASE_URL: "postgres://localhost/another_test" },
  ]) assert.throws(() => browserFixtureDatabase({ ...env, ...change }));
});
test("profiles explicitly differ while keeping own badges and student signup", () => {
  const enabled = browserFixtureFlags("enabled");
  const closed = browserFixtureFlags("core-trial");
  for (const key of ["community.social.enabled", "forum.enabled", "coaching.study_rooms.enabled", "ai.enabled", "mentorship.enabled", "payments.web.enabled"])
    assert.deepEqual([enabled[key], closed[key]], [true, false]);
  assert.equal(closed["community.achievements.enabled"], true);
  assert.equal(closed["signup.enabled"], true);
  assert.equal(closed["signup.pilot.enabled"], false);
  assert.equal(closed["ads.enabled"], false);
  assert.throws(() => browserFixtureFlags("production"));
});
