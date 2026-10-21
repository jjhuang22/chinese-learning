import { ApiError, errorResponse, requireUser } from "@/lib/server";
import { MAX_IMPORT_BYTES, parseLessonImport } from "@/lib/import-lesson";
export async function POST(request: Request) {
  try {
    const { user, db } = await requireUser();
    if (request.headers.get("origin") !== new URL(request.url).origin)
      throw new ApiError("Import from the signed-in app.", 403);
    if (Number(request.headers.get("content-length")) > MAX_IMPORT_BYTES)
      throw new ApiError("Keep the lesson below 300 KB.", 413);
    // Bound streaming reads even when Content-Length is absent.
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError("Paste a lesson first.", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMPORT_BYTES) {
        await reader.cancel();
        throw new ApiError("Keep the lesson below 300 KB.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let lesson;
    try {
      lesson = parseLessonImport(new TextDecoder().decode(bytes));
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : "Invalid lesson.",
        400,
      );
    }
    const { error } = await db
      .from("lessons")
      .insert({ user_id: user.id, lesson_date: lesson.date, content: lesson });
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
