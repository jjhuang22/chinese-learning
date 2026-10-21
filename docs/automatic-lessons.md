# Automatic daily lessons without model API billing

## Configured flow

The existing ChatGPT scheduled lesson task now prepares version-1 JSON internally, calls the connected Supabase app to save it, and sends a readable lesson with passages, vocabulary, and grammar notes. Its schedule, difficulty, reading length, and Taiwan usage are preserved. Vocabulary selection favors broader useful coverage rather than a fixed editorial count. Both the manual importer and stored lesson validator accept 2–3 passages.

```text
ChatGPT scheduled task → private.ingest_daily_lesson(JSON) → Supabase lessons → Vercel reader
```

The database writer is installed and its three-passage dry run has passed against the live database without publishing a test lesson. Local database tests exercise actual inserts, unchanged duplicate dates, malformed imports, and denied browser access. **The first scheduled run with these new instructions has not been verified.** Connected-app availability and any unattended approval requirements must be confirmed by that run. A working connection in this development chat does not prove the task has the same access.

## Save function

The migration is [daily lesson ingestion](../supabase/migrations/20261021233746_daily_lesson_ingestion.sql). The private `ingest_daily_lesson(payload jsonb, dry_run boolean default false)` function:

- Validates raw version-1 JSON, supported fields/formats, 2–3 passages, sentence and suggestion limits, real dates, sequential paragraphs, and exact source sentences. Vocabulary text must occur literally in its source sentence. The task additionally requires literal spans for grammar suggestions.
- Trims strings and assigns stable `import-DATE` lesson/suggestion IDs, matching the manual importer's normalized document. PostgreSQL validates independently of the TypeScript importer; parity tests cover their shared fixtures.
- Uses a private singleton library configuration. The migration populates it only when existing lessons have exactly one distinct owner; it never guesses among multiple owners or accepts an owner from the payload.
- Inserts only into `public.lessons`. It never reads or writes personal flashcards, reading/review progress, or passwords.
- Returns `{status: "created", lesson: ...}`, `{status: "already_exists", lesson: ...}`, or a validation error. The unique `(user_id, lesson_date)` key makes retries safe. An existing date is never overwritten; its stored lesson is returned so the readable reply can match the app.
- With `dry_run: true`, returns `{status: "validated", lesson: ...}` without changing any data.

All functions use `security invoker` and an empty search path. The private schema/configuration/functions grant no access to anonymous or authenticated browser roles, or the app's service role. The existing public-reading/editing-password boundary is unchanged.

The current integration uses the authenticated Supabase administrative SQL connector. The task is instructed to issue only one `SELECT private.ingest_daily_lesson(...)` for this project and never read personal data or execute administrative SQL. **These instructions narrow the task's behavior, not the connector's underlying privileges.** A separately scoped custom MCP action would provide stronger credential-level isolation if required. No service-role key, editing password, or learner UUID is stored in the task prompt.

When constructing the SQL call, the task must choose a dollar-quote delimiter absent from the entire JSON payload. Payload content is data, never executable SQL. A permission, connection, approval, or validation failure must be reported honestly in one short sentence alongside the readable lesson, without claiming a successful save or bypassing access controls.

## Reader refresh

Opening or reloading the app reads current database lessons on the server (`force-dynamic`). No new deployment or generation cron is needed per lesson. A tab already open keeps its current lesson until reopened/reloaded; there is no background poll or automatic replacement of text while someone is reading.

## Verification and remaining check

Completed: two-/three-passage importer parity, real local inserts, duplicate protection, invalid input rejection, browser-role denial, live non-publishing three-passage validation, and unchanged live lesson count. Security advisor information about private RLS without policies is intentional: ordinary roles have no table access.

Remaining: observe the next actual daily run, confirm the connected app is available without daily approval, then verify its new lesson in the database and public app. The task reports failures rather than implying saving worked. Do not infer success solely from a completed task status; inspect the actual save result and stored lesson. An immediate task run should be requested explicitly rather than silently generating an extra lesson.

Generation uses the ChatGPT plan's task allowance, without an OpenAI generation API call. Normal ChatGPT usage limits, Supabase/Vercel quotas, and connected-app permissions still apply. The shared-chat URL is not an ingestion API or a feed of future results.

References: [OpenAI scheduled tasks and connected-app permissions](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt), [Supabase MCP connectivity and project scoping](https://supabase.com/docs/guides/ai-tools/mcp).
