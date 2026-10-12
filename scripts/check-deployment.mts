import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";

interface EnvVariable {
  key: string;
  value?: string | number;
  sync?: boolean;
  generateValue?: boolean;
  fromService?: { type: string; name: string; property?: string; envVarKey?: string };
}

interface Service {
  name: string;
  type: string;
  branch: string;
  region: string;
  plan: string;
  autoDeployTrigger: string;
  domains?: string[];
  renderSubdomainPolicy?: string;
  buildCommand: string;
  startCommand: string;
  preDeployCommand?: string;
  healthCheckPath?: string;
  envVars: EnvVariable[];
}

interface Blueprint { services: Service[] }
interface PackageConfig { scripts: Record<string, string> }
interface TurboConfig { tasks: { build: { env: string[] } } }

const root = new URL("../", import.meta.url);
const readJson = <T,>(path: string): T => JSON.parse(readFileSync(new URL(path, root), "utf8")) as T;
const blueprints = [
  { file: "render.yaml", environment: "production", prefix: "mentor-", hostPrefix: "", site: "puhukoc.com", trigger: "off", bucket: "prod", plan: "0.5c-512mb", scheduled: true, hasAdmin: true },
  { file: "render.staging.yaml", environment: "staging", prefix: "mentor-s1-", hostPrefix: "s1-", site: "s1.puhukoc.com", trigger: "checksPass", bucket: "s1", plan: "0.5c-512mb", scheduled: true, hasAdmin: true },
  { file: "render.staging-low-cost.yaml", environment: "staging", prefix: "mentor-s1-", hostPrefix: "s1-", site: "s1.puhukoc.com", trigger: "off", bucket: "s1", plan: "free", scheduled: false, hasAdmin: false },
];

// Alternative stage profiles intentionally manage the same resources. Never apply both.
const allNames = new Map<string, string>();
const allDomains = new Map<string, string>();
for (const config of blueprints) {
  const blueprint = load(readFileSync(new URL(config.file, root), "utf8")) as Blueprint;
  assert.equal(blueprint.services.length, config.scheduled ? 7 : config.hasAdmin ? 3 : 2, `${config.file}: incorrect service count`);
  assert.equal(blueprint.services.filter((item) => item.type === "cron").length, config.scheduled ? 4 : 0);
  assert.equal(new Set(blueprint.services.map((item) => item.name)).size, blueprint.services.length);
  const byName = new Map(blueprint.services.map((service) => [service.name, service]));
  const service = (suffix: string) => {
    const found = byName.get(`${config.prefix}${suffix}`);
    assert.ok(found, `${config.file}: missing ${suffix}`);
    return found;
  };
  const value = (item: Service, key: string) => item.envVars.find((env) => env.key === key)?.value;
  const apiHost = `${config.hostPrefix}api.puhukoc.com`;
  const adminHost = `${config.hostPrefix}admin.puhukoc.com`;
  const api = service("api");
  const web = service("web");
  const admin = config.hasAdmin ? service("admin") : undefined;
  if (!config.hasAdmin) {
    assert.equal(blueprint.services.flatMap((item) => item.domains ?? []).length, 2,
      "Minimum-cost stage must remain within the two-domain allowance of an otherwise empty Hobby workspace");
  }

  for (const item of blueprint.services) {
    assert.ok(!allNames.has(item.name) || allNames.get(item.name) === config.environment, `${item.name}: reused service across environments`);
    allNames.set(item.name, config.environment);
    assert.equal(item.region, "frankfurt", `${item.name}: expected EU region`);
    assert.equal(item.plan, config.plan, `${item.name}: incorrect compute plan`);
    assert.equal(item.branch, "master", `${item.name}: expected the current release branch`);
    assert.equal(item.autoDeployTrigger, config.trigger, `${item.name}: incorrect release gate`);
    assert.equal(new Set(item.envVars.map((env) => env.key)).size, item.envVars.length, `${item.name}: duplicate env key`);
    for (const domain of item.domains ?? []) {
      assert.ok(!allDomains.has(domain) || allDomains.get(domain) === config.environment, `${domain}: reused domain across environments`);
      allDomains.set(domain, config.environment);
      assert.ok(domain === "puhukoc.com" || /^[a-z0-9-]+\.puhukoc\.com$/.test(domain), `${domain}: outside Universal SSL coverage`);
    }
    if (item.type === "cron") {
      assert.deepEqual(item.envVars.find((env) => env.key === "API_HOST")?.fromService,
        { type: "web", name: api.name, property: "host" }, `${item.name}: cron points to another environment`);
      assert.deepEqual(item.envVars.find((env) => env.key === "CRON_SECRET")?.fromService,
        { type: "web", name: api.name, envVarKey: "CRON_SECRET" }, `${item.name}: wrong cron credentials`);
      assert.ok(item.startCommand.includes("https://${API_HOST}/v1/internal/cron/"), `${item.name}: insecure cron target`);
      continue;
    }
    assert.equal(item.type, "web", `${item.name}: unexpected service type`);
    assert.equal(value(item, "NODE_ENV"), "production", `${item.name}: runtime security locks must remain enabled`);
    assert.equal(value(item, "APP_ENV"), config.environment, `${item.name}: deployment environment mismatch`);
    assert.equal(value(item, "NODE_VERSION"), "22.22.0", `${item.name}: unpinned runtime`);
    assert.ok(item.buildCommand.includes("install --frozen-lockfile --prod=false"), `${item.name}: build tooling missing`);
    assert.ok(item.buildCommand.includes("turbo run build --filter=@mentor/"), `${item.name}: workspace dependencies not built`);
  }
  assert.deepEqual(api.domains, [apiHost]);
  assert.deepEqual(web.domains, [config.site]);
  assert.equal(api.renderSubdomainPolicy, "enabled", "API Render hostname must remain available for authenticated cron");
  assert.equal(web.renderSubdomainPolicy, "disabled", "Web must use the canonical custom domain");
  if (admin) {
    assert.deepEqual(admin.domains, [adminHost]);
    assert.equal(admin.renderSubdomainPolicy, "disabled", "Admin must not bypass Cloudflare through its Render hostname");
  }
  assert.equal(value(api, "APP_URL"), `https://${config.site}`);
  assert.equal(value(api, "ADMIN_APP_URL"), `https://${adminHost}`);
  assert.equal(value(api, "CORS_ORIGINS"), `https://${config.site},https://${adminHost}`);
  assert.equal(value(api, "TURNSTILE_EXPECTED_HOSTNAME"), config.site);
  assert.equal(value(api, "R2_PUBLIC_BASE_URL"), `https://${config.hostPrefix}media.puhukoc.com`);
  assert.equal(value(api, "R2_PUBLIC_BUCKET"), `puhu-${config.bucket}-public`);
  assert.equal(value(api, "R2_PRIVATE_BUCKET"), `puhu-${config.bucket}-private`);
  assert.equal(value(api, "R2_JURISDICTION"), "eu");
  assert.equal(value(api, "PAYMENTS_PROVIDER"), "disabled");
  assert.notEqual(value(api, "AI_PROVIDER"), "fake");
  assert.notEqual(value(api, "VISION_PROVIDER"), "fake");
  assert.equal(value(api, "STORAGE_PROVIDER"), "r2");
  for (const key of ["DATABASE_URL", "DATABASE_MIGRATION_URL", "EDGE_ORIGIN_SECRET", "POSTMARK_TOKEN", "TURNSTILE_SECRET_KEY"]) {
    assert.deepEqual(api.envVars.find((env) => env.key === key), { key, sync: false }, `${api.name}: ${key} must be supplied separately`);
  }
  for (const key of ["JWT_ACCESS_SECRET", "AUTH_RATE_LIMIT_SECRET", "CRON_SECRET"]) {
    assert.deepEqual(api.envVars.find((env) => env.key === key), { key, generateValue: true }, `${api.name}: ${key} must be independently generated`);
  }
  assert.equal(api.preDeployCommand, config.scheduled ? "pnpm --filter @mentor/api db:migrate" : undefined,
    `${api.name}: Free services require separate manual migrations`);
  assert.equal(api.healthCheckPath, "/v1/health/ready");
  assert.equal(value(web, "NEXT_PUBLIC_SITE_URL"), `https://${config.site}`);
  const frontends: Array<readonly [Service, "web" | "admin"]> = [[web, "web"]];
  if (admin) frontends.push([admin, "admin"]);
  for (const [item, suffix] of frontends) {
    assert.equal(value(item, "NEXT_PUBLIC_API_URL"), `https://${apiHost}/v1`);
    assert.equal(item.startCommand, `pnpm --filter @mentor/${suffix} start:prod`);
    assert.equal(readJson<PackageConfig>(`apps/${suffix}/package.json`).scripts["start:prod"], "next start --hostname 0.0.0.0");
  }
  console.log(`${config.file}: environment, domains, build, migrations and cron references verified`);
}

const buildEnv = readJson<TurboConfig>("turbo.json").tasks.build.env;
for (const key of ["APP_ENV", "NEXT_PUBLIC_*", "WEB_CSP_STORAGE_ORIGINS", "GOOGLE_ADS_PUBLISHER_ID"]) {
  assert.ok(buildEnv.includes(key), `${key}: missing from Turbo build cache inputs`);
}
console.log("Deployment configuration checks passed. Provider setup and live release gates remain separate.");
