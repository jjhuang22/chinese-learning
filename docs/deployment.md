# Deploy the app

The app serves one existing Supabase learner account through Next.js on Vercel. Keep that user's UUID: lessons and progress reference it through `auth.users`.

Current owner deployment: [app](https://chinese-learning-ruddy.vercel.app) · [Supabase project](https://pvyqbkvdqllcevmohdyu.supabase.co). For another deployment, use your own project URL and existing learner UUID.

## Configure

Set these in Vercel's Production environment, or in an untracked `.env.local` for protected local use. Start from [`.env.example`](../.env.example).

| Variable                    | Value                                                          |
| --------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | Supabase project base URL, without `/rest/v1` or `/auth/v1`    |
| `SUPABASE_SERVICE_ROLE_KEY` | Server service-role key or Supabase secret key; mark Sensitive |
| `LEARNER_USER_ID`           | Existing user's UID from Supabase Authentication → Users       |
| `APP_PASSCODE`              | Editing password, 8–128 characters; mark Sensitive             |

`SUPABASE_URL` can replace `NEXT_PUBLIC_SUPABASE_URL`; use one authoritative value. Never prefix the server key or passcode with `NEXT_PUBLIC_`, or put secrets in Git, URLs, or chat. The app does not need an anon key, SMTP, AI key, or cron configuration.

## Apply the schema before deploying

Run the entire [schema.sql](../supabase/schema.sql) in Supabase SQL Editor. It is safe to re-run and preserves existing lessons and progress.

The schema removes legacy authenticated-browser permissions, retains server-only access, adds a progress revision column and `save_progress` function, and installs the durable unlock limiter. Deploy the new application only after applying it. Previously open app versions must reload because saves now require a revision.

Use the repository root as Vercel's Root Directory. Vercel detects Next.js and uses its default build/output settings. Deploy the reviewed commit with the four variables configured.

## Verify

1. In a private window, confirm `/` opens the lessons directly, while `/api/progress` returns 401. Saved cards and personal progress must not appear in page data or Archive counts.
2. Choose **Enable editing** and enter the existing password. Confirm saved cards and personal progress are available, then use **Lock editing** to return to public reading.
3. Import [example-lesson.json](../public/example-lesson.json), using a valid unused date. Reload and verify the lesson persists.
4. Save a card, mark a lesson read, and verify both after reload. Try a second device.
5. Open two tabs, save in one, then edit the other. The stale tab should report a conflict without replacing the first tab's work.
6. Rotate the passcode in Vercel and redeploy when you need to invalidate access on all devices.

Automated tests use synthetic accounts. These checks verify your actual project configuration; native iPhone Safari selection needs a physical device.

## Sessions and saves

Editor sessions last 30 days. The cookie is HttpOnly, SameSite=Strict, and Secure on Vercel/HTTPS. Its HMAC signing key derives from the service key, passcode, and learner UUID. Changing any of those values invalidates app sessions after redeployment. Use **Lock editing** to save pending changes and clear the current device cookie. If saving fails, editing stays enabled so you can retry. Rotating the editing password invalidates editor access on all devices. It does not block public lesson reading.

Lessons and their suggested cards are publicly readable. Saved flashcards, reading/review progress, and all mutation endpoints require the editing password. Public page responses do not load or serialize personal progress. All learning-data queries run on the server and scope to `LEARNER_USER_ID`. Supabase browser roles cannot access lessons or progress after the current schema is applied. The unlock limiter permits five attempts per client and 100 globally per 15-minute window, stores keyed client hashes, and fails closed if unavailable.

Progress stays in memory until saved; it is not mirrored into browser storage in protected mode. Keep the tab open after a save failure and retry. Closing a tab with unsaved progress prompts you to stay. For a conflict, use **Export unsaved progress** in the conflict warning before reloading. The conflict export contains progress and cards only, with no restore UI. Keep a separate Supabase backup for the full library. Previously authorized devices may retain content they have already loaded.

## Troubleshooting

| Symptom                          | Check                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Incomplete setup                 | All four variables, valid UUID, passcode length, server key, then redeploy                     |
| Unlocking unavailable            | Apply the entire current SQL schema and verify the database connection                         |
| Too many attempts                | Wait up to 15 minutes; successful unlocks also count toward the limits                         |
| Library fails to load            | Database availability, schema, learner UUID, and any manually imported lesson data             |
| Save fails after an upgrade      | Apply the revision column/function, then reload old app tabs after preserving unsaved progress |
| Progress conflict                | Export unsaved progress, reload to see the latest saved state, and reapply needed changes      |
| Local development skips the gate | `npm run dev` is always a demo outside Vercel; build, then use `LOCAL_DEMO=0 npm run start`    |

## Administrative imports

For normal imports, use the [JSON importer](importing.md). To import ignored originals from `.private/original-lessons.json`, configure `.env.local` and run `npm run import:lessons`. The script validates stored lesson structure and learner ownership, preserves existing dates, and reports newly inserted lessons.

For a direct SQL example, replace the UUID placeholder in [example-lesson.sql](../supabase/example-lesson.sql) before running it in SQL Editor. Administrative SQL bypasses the app validator; validate content before inserting it. Never commit personal lessons or filled-in environment files.
