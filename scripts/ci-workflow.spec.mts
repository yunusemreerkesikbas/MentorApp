import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { load } from "js-yaml";

interface Workflow {
  jobs: { build: { steps: { run: string }[] } };
}

const workflow = load(readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")) as Workflow;
const gate = workflow.jobs.build.steps[0].run;
const cases: [string, string, string, boolean][] = [
  ["success", "true", "success", true],
  ["success", "false", "skipped", true],
  ["failure", "", "skipped", false],
  ["success", "true", "failure", false],
  ["success", "true", "cancelled", false],
  ["success", "", "skipped", false],
  ["success", "false", "success", false],
  ["success", "unexpected", "skipped", false],
];

for (const [scope, code, checks, pass] of cases) {
  test(`required CI gate: scope=${scope}, code=${JSON.stringify(code)}, checks=${checks}`, () => {
    const result = spawnSync(process.env.CI_TEST_BASH || "bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", gate], {
      encoding: "utf8",
      env: { ...process.env, SCOPE_RESULT: scope, CODE_CHANGED: code, CHECKS_RESULT: checks },
    });
    if (result.error) throw result.error;
    assert.equal(result.status, pass ? 0 : 1, result.stderr);
  });
}
