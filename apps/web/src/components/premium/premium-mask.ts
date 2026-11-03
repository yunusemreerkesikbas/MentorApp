// Premium Puhu's hero mask on a 24 grid: one outline with the eye holes cut out (evenodd).
// A plain module, so server components can draw it too (a "use client" file only exports references).
export const PREMIUM_MASK_OUTLINE =
  "M1.2 7Q1.25 5.6 2.1 6.25C3 7.1 4 7.7 5.3 7.7C7.2 7.6 8.7 7.3 10.2 8Q12 8.8 13.8 8C15.3 7.3 16.8 7.6 18.7 7.7C20 7.7 21 7.1 21.9 6.25Q22.75 5.6 22.8 7C22.9 9.6 22.4 12.6 21.2 14.8C20.2 16.6 18.6 17.7 16.6 17.7C15 17.7 14 16.9 13.3 15.8Q12 14.2 10.7 15.8C10 16.9 9 17.7 7.4 17.7C5.4 17.7 3.8 16.6 2.8 14.8C1.6 12.6 1.1 9.6 1.2 7Z";
export const PREMIUM_MASK_EYES =
  "M3.8 12.4a3.6 3.1 0 1 0 7.2 0a3.6 3.1 0 1 0-7.2 0ZM13 12.4a3.6 3.1 0 1 0 7.2 0a3.6 3.1 0 1 0-7.2 0Z";
/** The mask outline with its eye holes, for places that draw the mask without the identity meaning. */
export const PREMIUM_MASK_PATH = PREMIUM_MASK_OUTLINE + PREMIUM_MASK_EYES;
export const PREMIUM_MASK_RING_INNER =
  "M4.8 12.4a2.6 2.1 0 1 0 5.2 0a2.6 2.1 0 1 0-5.2 0ZM14 12.4a2.6 2.1 0 1 0 5.2 0a2.6 2.1 0 1 0-5.2 0Z";
