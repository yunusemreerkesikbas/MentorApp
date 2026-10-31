import base from "../../../apps/api/vitest.config";
export default { ...base, test: { ...base.test, include: ["../../.artifacts/qa/economy-audit-20261031/economy-off.e2e-spec.ts"] } };
