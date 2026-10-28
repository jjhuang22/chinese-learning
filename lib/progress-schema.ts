import { z } from "zod";
import { progressSchema } from "./model";
export { progressSchema } from "./model";

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
