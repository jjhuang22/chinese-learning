import { readFile } from "node:fs/promises";
import { redirect } from "next/navigation";
import StudyApp from "@/components/study-app";
import { adminClient } from "@/lib/server";
import { isUnlocked } from "@/lib/passcode";
import { progressSchema, revisionSchema } from "@/lib/progress-schema";
import { loadLessons } from "@/lib/library";
import { emptyState } from "@/lib/model";
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
    loadLessons(db, learnerId),
    db
      .from("learner_state")
      .select("data, revision")
      .eq("user_id", learnerId)
      .maybeSingle(),
  ]);
  if (progress.error)
    throw new Error(
      "Your private library could not be loaded. Check Supabase setup.",
    );
  const initialLessons = history;
  return (
    <StudyApp
      initialLessons={initialLessons}
      initialState={progressSchema.parse(progress.data?.data ?? emptyState)}
      initialRevision={revisionSchema.parse(progress.data?.revision ?? 0)}
      localDemo={false}
    />
  );
}
