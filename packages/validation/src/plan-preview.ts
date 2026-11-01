import { z } from "zod";
import { coachPlanAdaptationSchema } from "./ai.js";

/** Coin explicitly funds the PLAN wizard, never passive mood/session adaptation. */
export const coinPlanPreviewSchema = z.object({
  input: coachPlanAdaptationSchema
    .refine((input) => input.source === "PLAN", {
      message: "Coin previews require PLAN source",
    })
    .transform((input) => ({ ...input, source: "PLAN" as const })),
  expectedCost: z.number().int().positive(),
  clientRequestId: z.string().uuid(),
});
export type CoinPlanPreviewInput = z.infer<typeof coinPlanPreviewSchema>;
export const confirmPlanPreviewSchema = z.object({
  expectedCost: z.number().int().positive(),
});
