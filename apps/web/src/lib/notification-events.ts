/**
 * Fired on `window` whenever the bell's live stream delivers something. A screen whose data the
 * other side of a relationship can change (a coach's decision, a student's answer) listens and reads
 * again instead of waiting for a reload.
 */
export const NOTIFICATION_ARRIVED = "mentor:notification-arrived";
