import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Existing admin data-loading effects predate React Compiler lint. Keep these
  // visible as migration debt; other correctness rules remain blocking.
  { rules: { "react-hooks/set-state-in-effect": "warn" } },
  // The adopted Duralux reference remains JavaScript; enforce our TypeScript surface.
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "src/**/*.js", "src/**/*.jsx"]),
]);
