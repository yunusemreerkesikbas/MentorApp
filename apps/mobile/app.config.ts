import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const appEnv = process.env["APP_ENV"] ?? "development";
  const isProd = appEnv === "production";

  return {
    ...config,
    name: isProd ? "PuhuKoç" : `PuhuKoç (${appEnv})`,
    slug: "puhukoc",
    version: "0.1.0",
    orientation: "portrait",
    scheme: "puhukoc",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      bundleIdentifier: isProd ? "com.puhukoc.app" : `com.puhukoc.app.${appEnv}`,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: isProd ? "com.puhukoc.app" : `com.puhukoc.app.${appEnv}`,
      edgeToEdgeEnabled: true,
    },
    plugins: [
      [
        "expo-router",
        {
          root: "./src/app",
        },
      ],
      "expo-secure-store",
    ],
    experiments: {
      typedRoutes: false,
    },
    extra: {
      appEnv,
      apiUrl: process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001",
    },
  };
};
