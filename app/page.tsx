import { readFile } from "node:fs/promises";
import { redirect } from "next/navigation";
import StudyApp from "@/components/study-app";
import { adminClient } from "@/lib/server";
import { isUnlocked } from "@/lib/passcode";
import { emptyState, progressSchema } from "@/lib/model";
import { localDemoAllowed } from "@/lib/demo";
import { lessonSchema, type Lesson } from "@/lib/model";
import samples from "@/lib/sample-lessons.json";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (localDemoAllowed()) {
    let initialLessons: Lesson[] = lessonSchema.array().parse(samples);
    // A private local file is read only at runtime; it is never imported into a JS bundle.
    try {
      if (process.env.USE_PUBLIC_FIXTURES !== "1")
        initialLessons = lessonSchema
          .array()
          .parse(
            JSON.parse(
              await readFile(
                process.cwd() + "/.private/original-lessons.json",
                "utf8",
              ),
            ),
          );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return <StudyApp initialLessons={initialLessons} localDemo />;
  }
  if (!(await isUnlocked())) redirect("/sign-in");
  const { db, learnerId } = adminClient();
  const [history, progress] = await Promise.all([
    db
      .from("lessons")
      .select("content")
      .eq("user_id", learnerId)
      .order("lesson_date"),
    db
      .from("learner_state")
      .select("data")
      .eq("user_id", learnerId)
      .maybeSingle(),
  ]);
  if (history.error || progress.error)
    throw new Error(
      "Your private library could not be loaded. Check Supabase setup.",
    );
  const initialLessons = (history.data ?? []).map((row) =>
    lessonSchema.parse(row.content),
  );
  return (
    <StudyApp
      initialLessons={initialLessons}
      initialState={progressSchema.parse(progress.data?.data ?? emptyState)}
      localDemo={false}
    />
  );
}
