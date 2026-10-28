import { z } from "zod";
import { suggestionSchema } from "./model";
export const progressSchema = z
  .object({
    reviewedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    cards: z
      .array(
        suggestionSchema.extend({
          lessonId: z.string().min(1),
          status: z.enum(["active", "archived"]),
          dueAt: z.number().int().nonnegative(),
          reviews: z.number().int().nonnegative(),
          intervalDays: z.number().min(1).max(30).optional(),
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

export const revisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const progressSnapshotSchema = z
  .object({
    state: progressSchema,
    revision: revisionSchema,
  })
  .strict();
