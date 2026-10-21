import { readFile } from "node:fs/promises";
import { redirect } from "next/navigation";
import StudyApp from "@/components/study-app";
import { adminClient } from "@/lib/server";
import { isUnlocked } from "@/lib/passcode";
import { loadProgress } from "@/lib/load-progress";
import { loadLessons } from "@/lib/library";
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
    loadProgress(db, learnerId),
  ]);
  const initialLessons = history;
  return (
    <StudyApp
      initialLessons={initialLessons}
      initialState={progress.state}
      initialRevision={progress.revision}
      localDemo={false}
    />
  );
}
