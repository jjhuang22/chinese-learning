import { readFile } from "node:fs/promises";
import { redirect } from "next/navigation";
import StudyApp from "@/components/study-app";
import { authClient } from "@/lib/auth-server";
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
  const db = await authClient();
  if (!db || !process.env.ALLOWED_EMAIL) redirect("/sign-in?error=setup");
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/sign-in");
  if (user.email?.toLowerCase() !== process.env.ALLOWED_EMAIL.toLowerCase())
    redirect("/sign-in?error=forbidden");
  const { data: rows, error: historyError } = await db
    .from("lessons")
    .select("content")
    .eq("user_id", user.id)
    .order("lesson_date");
  if (historyError)
    throw new Error(
      "Your lesson library could not be loaded. Check the Supabase schema and permissions.",
    );
  const initialLessons = (rows ?? []).map((row) => row.content as Lesson);
  return <StudyApp initialLessons={initialLessons} localDemo={false} />;
}
