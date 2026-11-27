import { useRouter } from "expo-router";
import { isWaitlistOn } from "@mentor/core";
import { WelcomeCarousel } from "../../components/welcome/welcome-carousel.js";
import { STUDENT_CORE_ONLY } from "../../lib/release-scope.js";
import { useAppAvailability } from "../../providers/availability-provider.js";

/** Signed-out landing: the web's "Puhu'nun bir günü" welcome. Invite-only routing is unchanged. */
export default function WelcomeScreen() {
  const router = useRouter();
  const { availability } = useAppAvailability();
  const waitlist = isWaitlistOn(availability);
  return (
    <WelcomeCarousel
      onSignup={() => router.push((waitlist ? "/(auth)/waitlist" : "/(auth)/signup") as never)}
      onLogin={() => router.push("/(auth)/login" as never)}
      onCoach={STUDENT_CORE_ONLY ? undefined : () =>
        router.push((waitlist ? "/(auth)/waitlist?role=coach" : "/(auth)/signup?role=coach") as never)}
    />
  );
}
