import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../providers/auth-provider.js";
import { AvailabilityProvider } from "../providers/availability-provider.js";
import { I18nProvider } from "../providers/i18n-provider.js";
import { QueryProvider } from "../providers/query-provider.js";
import { ThemeProvider, useThemeTokens } from "../providers/theme-provider.js";

function RootNavigator() {
  const { mode, palette } = useThemeTokens();

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
          animation: "default",
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <QueryProvider>
            <AuthProvider>
              <AvailabilityProvider>
                <RootNavigator />
              </AvailabilityProvider>
            </AuthProvider>
          </QueryProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
