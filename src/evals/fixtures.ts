import { z } from "zod";
import { techLeadPlanInputSchema, techLeadReviewInputSchema } from "../server/schemas/inputSchemas.js";

export const evalFixtureSchema = z.object({
  issues: z.array(
    z.object({
      id: z.string(),
      planInput: techLeadPlanInputSchema.optional(),
      reviewInput: techLeadReviewInputSchema.optional()
    })
  )
});

export type EvalFixture = z.infer<typeof evalFixtureSchema>;
