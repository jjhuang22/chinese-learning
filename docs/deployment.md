# Current setup: manual import, no AI API billing

This is the single current setup guide. The earlier automatic-generation and cron instructions no longer apply.

Your Vercel URL: https://chinese-learning-ruddy.vercel.app
Your Supabase project: https://pvyqbkvdqllcevmohdyu.supabase.co

## 1. Publish and deploy the code

The app source must be committed and pushed to `jjhuang22/chinese-learning` before Vercel can deploy it. Creating a Vercel project or adding environment variables does not upload this workspace's code. If the repository has no `main` branch yet, its initial code push must create it.

In Vercel, open the project → Settings → Git and confirm the connected repository is `jjhuang22/chinese-learning` and the Production Branch is `main`. Use the repository root (leave Root Directory blank). The checked-in vercel.json pins framework=nextjs, buildCommand=npm run build, and outputDirectory=.next so Vercel cannot treat this as a static public/ deployment. Use Node.js 22 or newer.

Under Settings → Environment Variables, the application now requires only:

| Variable                        | Value / source                                                             | Type                               |
| ------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://pvyqbkvdqllcevmohdyu.supabase.co`                                 | Config                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings → API Keys → publishable key, or legacy anon key | Config, intentionally browser-safe |
| `ALLOWED_EMAIL`                 | Your account's exact email address                                         | Config                             |

The URL must be the project base URL only: no /rest/v1/ or /auth/v1/ suffix. The SDK appends those paths itself. The app also normalizes these common copied API endpoints as a safeguard.

Apply them to Production, then deploy the new commit. If testing a Preview deployment, those variables must also be configured for Preview and its callback URL must be explicitly allowed in Supabase. A fresh deployment is required after changing the public variables because they are included at build time.

No `CHINESE_AI_API_KEY`, `CHINESE_AI_MODEL`, or `CRON_SECRET` is used. There is no Vercel cron configuration, and this app does not require Pro scheduling. The web app no longer uses `SUPABASE_SERVICE_ROLE_KEY` or `LEARNER_USER_ID`; those are optional local-only inputs for the one-time original-lesson importer described below. They can be removed from Vercel.

## 2. Apply the database schema

Open Supabase → SQL Editor → New query. Paste all of `supabase/schema.sql` and run it.

**Run the current file again even if you ran the previous version.** It now adds the `Insert own lessons` policy and INSERT permission needed by the manual importer. Re-running is safe; it keeps your existing rows.

It creates:

- `public.lessons`: private lesson documents, one per user and date.
- `public.learner_state`: private cards, dismissals, read status, and feedback.

Row-level security permits a signed-in user to read/insert only their own lessons and manage only their own progress. Lessons cannot be overwritten by the web app. Anonymous users cannot read either table.

## 3. Configure your account and login

In Supabase → Authentication → Users, create/confirm a user for the exact address entered in `ALLOWED_EMAIL`. If using the dashboard's Add user flow, choose Create user and auto-confirm the email where offered. Do not invent a user UUID or store it in the web app.

In Authentication → Sign In / Providers, disable **Allow new users to sign up**. The app's magic-link login deliberately does not create new accounts.

In Authentication → URL Configuration set:

- Site URL: `https://chinese-learning-ruddy.vercel.app`
- Redirect URL: `https://chinese-learning-ruddy.vercel.app/auth/callback`

For production the exact URL above is sufficient. Add your local callback or a specific preview callback only if testing there. Do not add broad redirect wildcards to make a failing redirect work.

Open the deployed site. It must show Sign in before revealing any lessons. Enter your approved email, open the emailed link **in the same browser/device where you requested it**, and return to the app. The cookie login uses PKCE, so the requesting browser must retain the verifier. On iPhone, request the link in Safari and open it in that Safari context. If you get an invalid/expired-link error, request a fresh link rather than reusing one. A diagnostic email requested by an agent or another device cannot sign you in here: its PKCE verifier belongs to the requesting environment. The app distinguishes a missing/mismatched verifier from a generally expired link.

If email delivery fails, check that the user exists/is confirmed, inspect Supabase Authentication logs, and check the project's email limits. Configure SMTP if needed; that is separate from application environment variables. Do not disable row-level security to fix a login problem.

## 4. Test a lesson

### Recommended: paste into the app

1. Sign in to the deployed app.
2. Click **Import lesson** at the top.
3. Open `public/example-lesson.json` and copy the entire JSON object.
4. Paste it into Lesson JSON → Preview lesson → Save to my library.
5. Reload. The lesson should still appear in Today and Library.
6. Save one suggested flashcard and open Review. Sign in on your phone to confirm the card also appears there.

The example uses 2026-10-22. A second import for the same date is rejected without replacing the saved lesson. Change the example's date to another valid, unused date if needed.

In the explicitly local demo, the button says **Save on this device**; this does not write to Supabase. A Supabase-backed test must use the signed-in deployed app or protected local production mode.

### Optional: paste directly into Supabase now

You can test the database before the app is deployed:

1. Apply `supabase/schema.sql` and create your user first.
2. In Authentication → Users, copy your account's User UID.
3. Open `supabase/example-lesson.sql`. Replace the single `YOUR_SUPABASE_USER_UUID` placeholder with that UUID.
4. Paste the entire SQL script into SQL Editor → New query → Run.
5. In Table Editor → lessons, confirm one row with your `user_id`, date 2026-10-22, and a nonempty content object.
6. After the new app is deployed and you sign in, it will read that row automatically.

Do not paste plain JSON into SQL Editor: it expects SQL. The SQL example contains the normalized JSON that the reader expects. Future daily ChatGPT outputs should go through **Import lesson**, which assigns IDs and validates the data for you. SQL Editor runs with administrative rights, so executing this script proves the insert works but does not prove signed-in row policies work; the app test and a separate account test are still useful.

## 5. Set your ChatGPT automation's format

Copy all of `public/automation-instructions.txt` into your existing ChatGPT automation's instructions. Keep its 8 AM America/New_York schedule in ChatGPT. The app does not run that schedule or access your ChatGPT subscription.

Each day copy the returned JSON → app's Import lesson → preview → save. `docs/importing.md` documents the format. The parser accepts either a bare JSON object or a single JSON code block.

Saving a suggested card requires approval. A newly selected phrase gets dictionary pinyin; you enter its meaning manually. Neither operation calls an AI API. Difficulty feedback remains saved in Supabase, but your ChatGPT automation cannot see it automatically. Share feedback or current vocabulary in that thread when you want the next lessons to adapt.

## Privacy

The deployed app verifies the signed-in user on the server and allows only `ALLOWED_EMAIL`. Supabase also enforces row-level security. Sessions and your private lesson content must not be committed to the public repository. Only neutral examples live in `public/` and `lib/sample-lessons.json`.

Personal original lessons remain in the ignored `.private/original-lessons.json`. An optional one-time script, `node --env-file=.env.local scripts/import-lessons.mjs`, imports those originals using local-only admin credentials. That script requires the two public Supabase variables, ALLOWED_EMAIL, SUPABASE_SERVICE_ROLE_KEY, and LEARNER_USER_ID in the ignored .env.local; the deployed web app does not.

Cloud progress is kept in Supabase and memory, not mirrored into browser local storage. Unsaved changes can be lost if the tab closes during a sync failure. Local demo progress is explicitly browser-only. The current sync is last-write-wins, so avoid changing the same deck simultaneously on two devices.

## What has and has not been verified

Local browser tests cover paste → preview → save → reload → Library → card creation/review. A PostgreSQL-compatible local engine exercises the actual schema, owner insert/read, duplicate protection, anonymous/cross-user denial, and the exact copy-paste SQL example. These tests do not prove your remote Supabase project or email delivery is configured.

Live verification requires the current code to be deployed, the schema applied, and your successful sign-in. This coding workspace currently has no Supabase credentials and its network proxy blocked both project URLs before reaching them. Vercel environment variables are not automatically available to the coding workspace. If you want the agent to check the public site directly, allow the two exact project hostnames in the cloud environment's network settings. Network draft changes require review/save; publication is separate.

## Healthy deployment but every app page is 404

If /icon.svg and /example-lesson.json return 200 while /, /sign-in, /manifest.webmanifest, and /api/import return Vercel NOT_FOUND, the deployment is serving public assets without the Next.js runtime. The repository's vercel.json explicitly selects Next.js and .next output. Deploy the latest main commit and keep Root Directory at the repository root. A correct build's output includes /sign-in, the dynamic / page, /api/import, /auth/callback, and the proxy. Do not change Supabase login settings to resolve this deployment-level 404.
