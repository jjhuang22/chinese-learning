// Run locally with: node --env-file=.env.local scripts/import-lessons.mjs
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  LEARNER_USER_ID: userId,
} = process.env;
if (!url || !key || !userId)
  throw new Error(
    "Set the Supabase URL, server key, and existing LEARNER_USER_ID in .env.local.",
  );
const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.auth.admin.getUserById(userId);
if (error || data.user?.id !== userId)
  throw new Error("LEARNER_USER_ID does not identify an existing learner account.");
const lessons = JSON.parse(
  await readFile(
    new URL("../.private/original-lessons.json", import.meta.url),
    "utf8",
  ),
);
const { error: saveError } = await client.from("lessons").upsert(
  lessons.map((content) => ({
    user_id: userId,
    lesson_date: content.date,
    content,
  })),
  { onConflict: "user_id,lesson_date", ignoreDuplicates: true },
);
if (saveError)
  throw new Error("Import failed. Check the Supabase schema and access.");
console.log(
  `Imported ${lessons.length} lessons into the private account. Existing dates were preserved.`,
);
