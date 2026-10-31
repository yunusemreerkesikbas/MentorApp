/** Public capabilities only; per-user authorization and entitlement remain server-side. */
export const APP_AVAILABILITY_KEYS = [
  "aiCoach", "coachPurchases", "coachRegistration", "coachSignup", "economy", "forum", "humanCoaching", "invites", "social",
  "studentPurchases", "studentSignup", "studyRooms",
] as const;

export type AppAvailabilityDto = Record<(typeof APP_AVAILABILITY_KEYS)[number], boolean>;
