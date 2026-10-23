import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyState } from "./model";
import { progressSchema, revisionSchema } from "./progress-schema";

export async function loadProgress(db: SupabaseClient, learnerId: string) {
  const result = await db
    .from("learner_state")
    .select("data, revision")
    .eq("user_id", learnerId)
    .maybeSingle();
  if (!result.error)
    return {
      state: progressSchema.parse(result.data?.data ?? emptyState),
      revision: revisionSchema.parse(result.data?.revision ?? 0),
    };

  // Existing deployments may not expose the revision column yet. Keep their
  // library readable, but never downgrade writes to unconditional upserts.
  const missingRevision =
    ["42703", "PGRST204"].includes(result.error.code) &&
    /\brevision\b/i.test(result.error.message);
  if (missingRevision) {
    const legacy = await db
      .from("learner_state")
      .select("data")
      .eq("user_id", learnerId)
      .maybeSingle();
    if (!legacy.error)
      return {
        state: progressSchema.parse(legacy.data?.data ?? emptyState),
        revision: null,
      };
    console.error("Progress fallback failed", { code: legacy.error.code });
  } else {
    console.error("Progress load failed", { code: result.error.code });
  }
  throw new Error("Your progress could not be loaded. Check Supabase setup.");
}
