import { Redirect, Stack, usePathname } from "expo-router";
import { COACH_HOME, hasCompletedOnboarding, isCoach, isStudentOnlyPath } from "@mentor/core";
import { useAuth } from "../../providers/auth-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

/**
 * Authenticated shell guard:
 * - Bounces any user who hasn't completed onboarding (`username && examType`) to `/(onboarding)`.
 * - Bounces a human coach (`UserRole.COACH`) away from student-only study surfaces to `COACH_HOME` (`/students`),
 *   using the exact same `@mentor/core` contract as `apps/web`.
 */
export default function AuthenticatedAppLayout() {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const { palette } = useThemeTokens();

  if (status === "anonymous") {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user && !hasCompletedOnboarding(user)) {
    return <Redirect href="/(onboarding)" />;
  }

  if (isCoach(user) && isStudentOnlyPath(pathname)) {
    return <Redirect href={COACH_HOME as never} />;
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
