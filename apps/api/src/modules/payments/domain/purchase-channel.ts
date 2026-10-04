/**
 * Where a plan can be bought right now. Pure: the service reads the flags, this decides.
 *
 * Two audiences, each with its own switch per channel. A student plan follows
 * `payments.web.enabled` / `payments.mobile.enabled`; a coach seat plan follows
 * `mentorship.seats.billing_enabled` / `mentorship.seats.mobile_billing_enabled`. The stores are
 * likely to sell to students before the app has any coach purchase, and a shared mobile switch
 * would hand coaches to a store that cannot sell to them.
 */
export interface PurchaseChannelFlags {
  /** `PAYMENTS_PROVIDER !== "disabled"`: without a live provider nothing sells on the web. */
  providerEnabled: boolean;
  studentWeb: boolean;
  studentMobile: boolean;
  coachWeb: boolean;
  coachMobile: boolean;
  /** `payments.web.redirect_to_mobile`. */
  redirectToMobile: boolean;
}

export interface PurchaseChannel {
  /** In the catalog at all. A coach plan stays out until one of its channels can sell it. */
  listed: boolean;
  /** A web checkout can complete for this plan. */
  purchaseEnabled: boolean;
  /** The web cannot sell this plan, a store can, and the hand-off is switched on. */
  redirectToMobile: boolean;
}

export function resolvePurchaseChannel(
  plan: { seatCount: number },
  flags: PurchaseChannelFlags,
): PurchaseChannel {
  // A non-zero seat count is what makes a plan a coach plan (W8, APP-079).
  const coach = plan.seatCount > 0;
  const web = coach ? flags.coachWeb : flags.studentWeb;
  const mobile = coach ? flags.coachMobile : flags.studentMobile;
  const purchaseEnabled = flags.providerEnabled && web;
  return {
    listed: !coach || web || mobile,
    purchaseEnabled,
    // Never to a store that does not sell to this audience, never while the web can sell it itself.
    redirectToMobile: !purchaseEnabled && flags.redirectToMobile && mobile,
  };
}
