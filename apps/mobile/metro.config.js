const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

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
