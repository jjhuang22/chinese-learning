import {
  ApiError,
  errorResponse,
  requireUser,
  requireSameOrigin,
  readBody,
} from "@/lib/server";
import { MAX_IMPORT_BYTES, parseLessonImport } from "@/lib/import-lesson";
export async function POST(request: Request) {
  try {
    const { learnerId, db } = await requireUser();
    requireSameOrigin(request);
    let lesson;
    try {
      lesson = parseLessonImport(await readBody(request, MAX_IMPORT_BYTES));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error instanceof Error ? error.message : "Invalid lesson.",
        400,
      );
    }
    const { error } = await db.from("lessons").insert({
      user_id: learnerId,
      lesson_date: lesson.date,
      content: lesson,
    });
    if (error?.code === "23505")
      throw new ApiError(
        "A lesson already exists for this date. Nothing was replaced. Change the date or open the existing lesson.",
        409,
      );
    if (error?.code === "42501")
      throw new ApiError(
        "Apply the updated supabase/schema.sql to enable private lesson imports.",
        503,
      );
    if (error)
      throw new ApiError(
        "Could not save to Supabase. Check the schema and connection, then try again.",
        503,
      );
    return Response.json(
      { lesson },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
