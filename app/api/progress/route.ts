import {
  ApiError,
  errorResponse,
  readBody,
  requireSameOrigin,
  requireUser,
} from "@/lib/server";
import { loadProgress } from "@/lib/load-progress";
import { progressSnapshotSchema, revisionSchema } from "@/lib/progress-schema";
export async function GET() {
  try {
    const { db, learnerId } = await requireUser();
    return Response.json(await loadProgress(db, learnerId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    const { db, learnerId } = await requireUser();
    requireSameOrigin(request);
    let snapshot;
    try {
      snapshot = progressSnapshotSchema.parse(
        JSON.parse(await readBody(request, 2_000_000)),
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("The progress data is invalid.", 400);
    }
    const { data: revision, error } = await db.rpc("save_progress", {
      learner_id: learnerId,
      expected_revision: snapshot.revision,
      progress_data: snapshot.state,
    });
    if (error) {
      const needsSchema = ["PGRST202", "42883", "42703"].includes(error.code);
      throw new ApiError(
        needsSchema
          ? "Progress saving needs a database update. Apply the current supabase/schema.sql, then retry."
          : "Could not save your progress. Check your connection and retry.",
        503,
      );
    }
    if (revision === null)
      throw new ApiError(
        "Progress changed on another device. Export your progress before reloading; your changes have not been saved.",
        409,
      );
    return Response.json(
      { saved: true, revision: revisionSchema.parse(revision) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
