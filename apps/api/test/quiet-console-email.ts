/**
 * Test-run noise filter. Every e2e app polls the jobs table and NODE_ENV=test counts as dev
 * tooling, so any suite that signs a user up prints its verify email through the console sink.
 * Dropped here rather than in the adapter; specs that assert on those lines spy on stdout
 * themselves, which replaces this wrapper for the duration of the spy.
 */
const write = process.stdout.write.bind(process.stdout) as (...args: unknown[]) => boolean;

process.stdout.write = ((chunk: unknown, ...rest: unknown[]) =>
  typeof chunk === "string" && chunk.startsWith("[email:console] ")
    ? true
    : write(chunk, ...rest)) as typeof process.stdout.write;
