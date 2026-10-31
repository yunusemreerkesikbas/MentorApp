import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppAvailabilityDto } from "@mentor/types";
import type { Env } from "../../config/env.validation";
import { resolvePurchaseChannel } from "../../modules/payments/domain/purchase-channel";
import { ConfigRegistryService } from "./config-registry.service";

/** Allowlisted presentation capabilities; never substitutes for a feature's server policy. */
@Injectable()
export class AppAvailabilityService {
  constructor(
    private readonly config: ConfigRegistryService,
    private readonly env: ConfigService<Env, true>,
  ) {}

  async get(): Promise<AppAvailabilityDto> {
    const [aiCoach, social, forum, studyRooms, humanCoaching, studentSignup, applications,
      economy, studentWeb, studentMobile, coachWeb, coachMobile, redirectToMobile] = await Promise.all([
      this.config.get("ai.enabled"), this.config.get("community.social.enabled"),
      this.config.get("forum.enabled"), this.config.get("coaching.study_rooms.enabled"),
      this.config.get("mentorship.enabled"), this.config.get("signup.enabled"),
      this.config.get("mentorship.applications.open"), this.config.get("economy.enabled"),
      this.config.get("payments.web.enabled"), this.config.get("payments.mobile.enabled"),
      this.config.get("mentorship.seats.billing_enabled"),
      this.config.get("mentorship.seats.mobile_billing_enabled"),
      this.config.get("payments.web.redirect_to_mobile"),
    ]);
    const channels = {
      providerEnabled: this.env.get("PAYMENTS_PROVIDER", { infer: true }) !== "disabled",
      studentWeb, studentMobile, coachWeb, coachMobile, redirectToMobile,
    };
    const student = resolvePurchaseChannel({ seatCount: 0 }, channels);
    const coach = resolvePurchaseChannel({ seatCount: 1 }, channels);
    return {
      aiCoach, social, forum, studyRooms, humanCoaching, studentSignup,
      coachRegistration: applications,
      coachSignup: studentSignup && applications,
      studentPurchases: student.purchaseEnabled || student.redirectToMobile,
      coachPurchases: coach.purchaseEnabled || coach.redirectToMobile,
      // Quests, XP and Coin. The public landing hides its "Gece Yolculuğu" section when it is off.
      economy,
      invites: economy && social,
    };
  }
}
