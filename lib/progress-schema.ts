import { z } from "zod";
import { suggestionSchema } from "./model";
export const progressSchema = z
  .object({
    cards: z
      .array(
        suggestionSchema.extend({
          lessonId: z.string().min(1),
          status: z.enum(["active", "archived"]),
          dueAt: z.number().int().nonnegative(),
          reviews: z.number().int().nonnegative(),
          createdAt: z.number().int().nonnegative(),
        }),
      )
      .max(5000),
    dismissed: z.array(z.string()).max(20000),
    read: z.array(z.string()).max(20000),
    feedback: z.record(
      z.string(),
      z.enum(["Too easy", "About right", "Too hard"]),
    ),
  })
  .strict();
