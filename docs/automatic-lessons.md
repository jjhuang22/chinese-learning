# Automatic daily lessons without model API billing

## Proposed flow

Keep lesson generation in the existing ChatGPT scheduled task. Give that task a narrowly scoped connected action that validates and saves the generated lesson to the existing Supabase `lessons` table. The Vercel app already loads that table when a visitor opens or reloads the app. No separate generation cron or model API call is needed.

```text
ChatGPT scheduled task → create_lesson(JSON) → existing import validator → Supabase lessons → Vercel reader
```

This is a design, not an enabled writer. Supabase connectivity and the existing table structure have been verified from this chat. The scheduled task's own app access, write permissions, and unattended behavior still need an end-to-end test. The shared chat link is not an ingestion feed.

## Save action contract

- Accept the same version-1 JSON used by manual Import lesson. Reuse `parseLessonImport` from `lib/import-lesson.ts`, rather than accepting arbitrary SQL or trusting model-generated validation.
- The server assigns lesson and suggestion IDs with `normalizeImport`; it obtains the learner ID from its own configuration. The task supplies no database credentials or learner IDs.
- The existing unique `(user_id, lesson_date)` key makes the date the retry/idempotency boundary. Return `created` for an insert, `already_exists` for an unchanged existing date, or a validation error. Never replace a published lesson or silently change its date to evade a duplicate.
- Scope authorization to inserting lessons for this one library. Do not grant the action access to saved flashcards, reading/review progress, editing-password management, or arbitrary database administration. Keep all credentials server-side.
- Return the saved lesson date, ID, and app URL. The task reports success only after the saved row is verified; a generated JSON response alone is not proof of saving.

A connected app/MCP action is preferable to putting a password or service-role key in the task prompt. The current Supabase connection can inspect the database, but broad administrative SQL access is not the intended daily save-action contract.

## Preserve the existing lesson task

Preserve its schedule, topic variety, difficulty, length, Taiwan usage, and historical context. Add a save step rather than replacing generation with a reminder. Align the task and importer before enabling writes: the current task permits 2–3 passages while `importSchema` requires exactly two. Either keep exactly two full-length passages or explicitly extend the shared validator and its tests to accept three; do not silently shorten the lesson.

After validation, call `create_lesson`. On success, send a brief link to the saved lesson. If a write needs approval or a connection fails, report the actual blocker and retain the JSON as a manual fallback. Do not claim the lesson was saved, disable authorization, or overwrite an existing lesson.

Suggested final task instruction, once the action exists:

> Generate the lesson using the agreed schema, validate it, then call the connected create_lesson action. Confirm the returned date matches today's date in America/New_York. Treat already_exists as a successful no-op. Report the saved lesson link only after the action verifies it; report validation, permission, or connection failures instead of claiming success.

## Reader refresh

No Vercel deployment is required for each new lesson. Opening or reloading the app reads the current database contents. For tabs kept open all day, a public lessons-only read endpoint can refresh on focus and poll about once per minute while visible. That endpoint must never return saved cards or personal progress. Avoid replacing a passage while somebody is reading it; offer the newly available lesson without losing their place.

## Acceptance checks

1. Use a non-publishing validation/dry-run first; invalid dates, incomplete sentences, and malformed JSON fail without inserting rows.
2. Save a valid lesson through the connected action and verify the database row and public reader agree.
3. Retry the same date and confirm the existing lesson and its card references remain unchanged.
4. Run the actual scheduled task once with its own connected-app permissions. An interactive write from a different chat does not prove scheduled access.
5. Confirm the task can finish without daily approval if the account's permissions support that; otherwise the remaining approval step must be made explicit.
6. Confirm public visitors still cannot read personal progress or perform writes.

Generation would use the ChatGPT plan's task allowance rather than paid OpenAI API generation. Normal ChatGPT usage limits, Supabase/Vercel quotas, and any connected-app approval requirements still apply.

References: [OpenAI scheduled tasks and connected-app permissions](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt), [Supabase MCP connectivity and project scoping](https://supabase.com/docs/guides/ai-tools/mcp).
