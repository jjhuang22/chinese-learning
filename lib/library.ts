import type { SupabaseClient } from "@supabase/supabase-js";
import { lessonSchema, type Lesson } from "./model";

// Stay below PostgREST's default row cap, and validate administrative imports too.
export async function loadLessons(db: SupabaseClient, learnerId: string) {
  const lessons: Lesson[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("lessons")
      .select("content")
      .eq("user_id", learnerId)
      .order("lesson_date")
      .range(offset, offset + pageSize - 1);
    if (error)
      throw new Error(
        "Your private library could not be loaded. Check Supabase setup.",
      );
    for (const row of data ?? []) lessons.push(lessonSchema.parse(row.content));
    if (!data || data.length < pageSize) return lessons;
  }
}
