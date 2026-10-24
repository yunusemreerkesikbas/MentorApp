import type { UsersService } from "../../identity/application/users.service";

/** Current contacts on an ACTIVE account; independent of coach registration intake. */
export async function coachContactVerification(
  users: UsersService,
  coachId: string,
  requirePhone: boolean,
): Promise<"EMAIL_UNVERIFIED" | "PHONE_UNVERIFIED" | null> {
  const [email, phone] = await Promise.all([
    users.isEmailVerified(coachId),
    requirePhone ? users.isPhoneVerified(coachId) : true,
  ]);
  if (!email) return "EMAIL_UNVERIFIED";
  return phone ? null : "PHONE_UNVERIFIED";
}
