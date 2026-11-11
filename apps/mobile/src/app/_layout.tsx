import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { isCoach } from "@mentor/core";
import { CoachOnWebScreen } from "../components/coach-on-web-screen.js";
import { STUDENT_CORE_ONLY } from "../lib/release-scope.js";
import { AuthProvider, useAuth } from "../providers/auth-provider.js";
import { AvailabilityProvider } from "../providers/availability-provider.js";
import { I18nProvider } from "../providers/i18n-provider.js";
import { QueryProvider } from "../providers/query-provider.js";
import { ThemeProvider, useThemeTokens } from "../providers/theme-provider.js";

function RootNavigator() {
  const { mode, palette } = useThemeTokens();
  const { user } = useAuth();

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {STUDENT_CORE_ONLY && isCoach(user) ? (
        <CoachOnWebScreen />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.bg },
            animation: "default",
          }}
        />
      )}
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
