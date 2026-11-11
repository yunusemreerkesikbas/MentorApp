import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../providers/auth-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function OnboardingLayout() {
  const { status } = useAuth();
  const { palette } = useThemeTokens();

  if (status === "anonymous") {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
      }}
    />
  );
}
