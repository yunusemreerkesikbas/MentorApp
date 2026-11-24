import { Redirect, Stack, usePathname } from "expo-router";
import {
  COACH_HOME,
  hasCompletedOnboarding,
  isCoach,
  isNavActive,
  isStudentOnlyPath,
} from "@mentor/core";
import { STUDENT_CORE_ONLY } from "../../lib/release-scope.js";
import { useAuth } from "../../providers/auth-provider.js";
import { CelebrationProvider } from "../../providers/celebration-provider.js";
import { PushNotificationsProvider } from "../../providers/push-notifications-provider.js";
import { ToastProvider } from "../../providers/toast-provider.js";
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

  if (isCoach(user) && (isStudentOnlyPath(pathname) || isNavActive(pathname, "/weekly-recap"))) {
    return <Redirect href={COACH_HOME as never} />;
  }

  // Notification deep links can still point at community; keep them inside the student core.
  if (STUDENT_CORE_ONLY && isNavActive(pathname, "/community")) {
    return <Redirect href={"/(app)/(tabs)/dashboard" as never} />;
  }

  return (
    <ToastProvider>
      <PushNotificationsProvider>
        <CelebrationProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bg },
            }}
          />
        </CelebrationProvider>
      </PushNotificationsProvider>
    </ToastProvider>
  );
}
