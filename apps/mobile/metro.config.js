const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo so @mentor/* packages hot-reload cleanly.
config.watchFolders = [monorepoRoot];

// Resolve modules from apps/mobile/node_modules first, then root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// ponytail: the monorepo writes NodeNext-style relative imports ("./x.js") that point at
// .ts/.tsx sources. Metro has no TS-aware extension mapping, so retry without the ".js".
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      // fall through: a real .js file
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
