import { z } from "zod";

export const weeklyRecapOfferQuerySchema = z.object({ examId: z.string().uuid(), weekStart: z.string().date().optional() });
export const openWeeklyRecapSchema = z.object({
  examId: z.string().uuid(),
  weekStart: z.string().date(),
  source: z.enum(["PREMIUM", "EARNED", "COIN", "OWNED"]),
  expectedCost: z.number().int().min(0),
  clientRequestId: z.string().uuid(),
});
export type OpenWeeklyRecapInput = z.infer<typeof openWeeklyRecapSchema>;
