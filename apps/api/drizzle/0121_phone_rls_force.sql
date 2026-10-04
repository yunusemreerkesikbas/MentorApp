-- Generated custom forward migration: owners are also subject to the SERVICE-only policies.
ALTER TABLE "phone_verifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "phone_otp_attempts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "phone_trial_claims" FORCE ROW LEVEL SECURITY;
