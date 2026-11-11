import { View } from "react-native";
import { Redirect } from "expo-router";
import { availableAppDestination, hasCompletedOnboarding, homePathForUser } from "@mentor/core";
import { ScreenLoadingSkeleton } from "../components/ui/state-view.js";
import { useAppAvailability } from "../providers/availability-provider.js";
import { useAuth } from "../providers/auth-provider.js";
import { useThemeTokens } from "../providers/theme-provider.js";

/**
 * Cold-start state gate (`appllama-app-design-skill` Navigation Law 5):
 * Never flashes Login before resolving session state; routes one-way via `<Redirect>`.
 */
export default function EntryGateScreen() {
  const { status, user } = useAuth();
  const { availability } = useAppAvailability();
  const { palette, space } = useThemeTokens();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, padding: space.lg, justifyContent: "center" }}>
        <ScreenLoadingSkeleton />
      </View>
    );
  }

  if (status === "anonymous" || !user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!hasCompletedOnboarding(user)) {
    return <Redirect href="/(onboarding)" />;
  }

  const destination = availableAppDestination(homePathForUser(user), user, availability);
  return <Redirect href={destination as never} />;
}
