import { KeyboardAvoidingView, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { isCoach } from "@mentor/core";
import { CoachOnWebScreen } from "../components/coach-on-web-screen.js";
import { StateView } from "../components/ui/index.js";
import { STUDENT_CORE_ONLY } from "../lib/release-scope.js";
import { AuthProvider, useAuth } from "../providers/auth-provider.js";
import { AvailabilityProvider } from "../providers/availability-provider.js";
import { I18nProvider, useTranslations } from "../providers/i18n-provider.js";
import { QueryProvider } from "../providers/query-provider.js";
import { ThemeProvider, useThemeTokens } from "../providers/theme-provider.js";

function RootNavigator() {
  const { mode, palette, space } = useThemeTokens();
  const { user, status, retryRestore } = useAuth();
  const tCommon = useTranslations("common");
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {status === "unreachable" ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: palette.bg,
            paddingTop: insets.top,
            paddingHorizontal: space.lg,
          }}
        >
          <StateView
            title={tCommon("error_title")}
            body={tCommon("offline_restore_body")}
            actionLabel={tCommon("retry")}
            onAction={retryRestore}
            tone="error"
          />
        </View>
      ) : STUDENT_CORE_ONLY && isCoach(user) ? (
        <CoachOnWebScreen />
      ) : (
        // Android is edge-to-edge, so the window no longer resizes for the keyboard: without
        // this every field in the lower half of a screen ends up typed blind.
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bg },
              animation: "default",
            }}
          />
        </KeyboardAvoidingView>
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
