import {
  ApiError,
  errorResponse,
  readBody,
  requireSameOrigin,
  requireUser,
} from "@/lib/server";
import { emptyState } from "@/lib/model";
import { progressSchema } from "@/lib/progress-schema";
export async function GET() {
  try {
    const { db, learnerId } = await requireUser();
    const { data, error } = await db
      .from("learner_state")
      .select("data")
      .eq("user_id", learnerId)
      .maybeSingle();
    if (error) throw new ApiError("Could not load your progress.", 503);
    return Response.json(
      { state: data?.data ?? emptyState },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    const { db, learnerId } = await requireUser();
    requireSameOrigin(request);
    let state;
    try {
      state = progressSchema.parse(
        JSON.parse(await readBody(request, 2_000_000)),
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("The progress data is invalid.", 400);
    }
    const { error } = await db
      .from("learner_state")
      .upsert({
        user_id: learnerId,
        data: state,
        updated_at: new Date().toISOString(),
      });
    if (error)
      throw new ApiError(
        "Could not save your progress. Keep this tab open and retry.",
        503,
      );
    return Response.json(
      { saved: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
