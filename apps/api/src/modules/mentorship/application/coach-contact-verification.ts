import type { UsersService } from "../../identity/application/users.service";

/** Current contacts on an ACTIVE account; independent of coach registration intake. */
export async function coachContactVerification(
  users: UsersService,
  coachId: string,
): Promise<"EMAIL_UNVERIFIED" | "PHONE_UNVERIFIED" | null> {
  const [email, phone] = await Promise.all([
    users.isEmailVerified(coachId),
    users.isPhoneVerified(coachId),
  ]);
  if (!email) return "EMAIL_UNVERIFIED";
  return phone ? null : "PHONE_UNVERIFIED";
}
