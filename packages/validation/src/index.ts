/**
 * @mentor/validation — Zod schemas (single source for FE+BE, §8).
 *
 * NOTE: Feature schemas (mock-analysis input, onboarding, etc.) will be added
 * later. For now, only common/skeleton schemas.
 */
import { z } from "zod";

export * from "./pagination.js";
export * from "./admin.js";
export * from "./ai.js";
export * from "./auth.js";
export * from "./coaching.js";
export * from "./content.js";
export * from "./economy.js";
export * from "./forum.js";
export * from "./payments.js";
export * from "./notifications.js";
export * from "./social.js";

export { z };
