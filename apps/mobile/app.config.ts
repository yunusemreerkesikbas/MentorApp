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
    ios: {
      supportsTablet: false,
      bundleIdentifier: isProd ? "com.puhukoc.app" : `com.puhukoc.app.${appEnv}`,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: isProd ? "com.puhukoc.app" : `com.puhukoc.app.${appEnv}`,
    },
    plugins: [
      [
        "expo-router",
        {
          root: "./src/app",
        },
      ],
      "expo-secure-store",
      "expo-splash-screen",
      "expo-font",
      "expo-notifications",
      "expo-web-browser",
      // Playback only (session room sounds): no microphone prompt, no RECORD_AUDIO.
      ["expo-audio", { microphonePermission: false, recordAudioAndroid: false }],
      ["expo-image-picker", {
        photosPermission: "Defterine veya hedef panona ekleyeceğin fotoğrafı seç.",
        cameraPermission: "Defterine veya hedef panona eklemek için fotoğraf çek.",
        microphonePermission: false,
      }],
    ],
    experiments: {
      typedRoutes: false,
    },
    extra: {
      appEnv,
      apiUrl: process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001",
      ...(process.env["EXPO_PUBLIC_EAS_PROJECT_ID"]
        ? { eas: { projectId: process.env["EXPO_PUBLIC_EAS_PROJECT_ID"] } }
        : {}),
    },
  };
};
