import base from "../../../apps/api/vitest.unit.config";
export default { ...base, test: { ...base.test, include: ["../../.artifacts/qa/economy-audit-20261031/*.spec.ts"] } };
