import { Redirect, Stack } from "expo-router";
import { availableAppDestination, hasCompletedOnboarding, homePathForUser } from "@mentor/core";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function AuthLayout() {
  const { status, user } = useAuth();
  const { availability } = useAppAvailability();
  const { palette } = useThemeTokens();

  if (status === "authenticated" && user) {
    if (!hasCompletedOnboarding(user)) {
      return <Redirect href="/(onboarding)" />;
    }
    const destination = availableAppDestination(homePathForUser(user), user, availability);
    return <Redirect href={destination as never} />;
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
