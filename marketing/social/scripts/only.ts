// `--only F1,S1` → Set of ids; no flag → null (everything).
export function parseOnly(argv: string[]): Set<string> | null {
  const i = argv.indexOf("--only");
  return i >= 0 && argv[i + 1] ? new Set(argv[i + 1].split(",")) : null;
}
