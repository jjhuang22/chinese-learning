# Current setup: private passcode + manual lesson imports

This replaces the earlier email-login instructions. The app uses one private passcode, a server-verified session cookie, and server-only Supabase access. No email delivery, SMTP, AI API billing, or Vercel cron is required.

Your site: https://chinese-learning-ruddy.vercel.app
Your database: https://pvyqbkvdqllcevmohdyu.supabase.co

## 1. Vercel variables

In your Vercel project's Settings → Environment Variables, configure these for **Production**:

| Variable                    | Value / source                                                                         | Type          |
| --------------------------- | -------------------------------------------------------------------------------------- | ------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | `https://pvyqbkvdqllcevmohdyu.supabase.co` (base URL only)                             | Config        |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings → API Keys → legacy **service_role**, or a server secret key | **Sensitive** |
| `LEARNER_USER_ID`           | Supabase Authentication → Users → your existing account → User UID                     | Config        |
| `APP_PASSCODE`              | A private passcode you choose, 8–128 characters                                        | **Sensitive** |

Use your **existing** learner UUID so all lessons and cards stay attached to the same account. Do not delete/recreate the account. The Supabase account is now just the private data owner; you do not log in through Supabase email.

Never prefix the passcode or service-role key with NEXT_PUBLIC_. Never put either value in chat, Git, or a URL. Enter them securely in Vercel. The browser receives neither value. The old NEXT_PUBLIC_SUPABASE_ANON_KEY and ALLOWED_EMAIL are no longer used by the app. AI and cron variables are also unused.

A server-only SUPABASE_URL can be used instead of NEXT_PUBLIC_SUPABASE_URL if preferred; keep only one authoritative value. Known /rest/v1/ and /auth/v1/ suffixes are normalized, but the base URL above is the intended setting.

## 2. Supabase schema

Run the entire current `supabase/schema.sql` in Supabase SQL Editor. Re-running is safe and preserves existing lessons/cards. This version adds a private `passcode_attempts` table and server-only `register_unlock_attempt` function.

The limiter persists across serverless instances: at most five attempts per client and 100 attempts globally per 15-minute window. It stores keyed hashes, not plain IP addresses. It fails closed if the database/function is unavailable. No passcode is stored in Supabase. Public and authenticated browser roles cannot call the limiter or read its table.

Existing row-level policies remain enabled. All app data now passes through server routes that require a signed session and explicitly scope queries to LEARNER_USER_ID. The service-role key stays on the server; the app never accepts a learner ID from the browser. Legacy browser sessions cannot bypass the new app gate.

## 3. Deploy and unlock

Deploy the latest `main` commit from `jjhuang22/chinese-learning`. Vercel detects Next.js and uses its default build/output settings; Root Directory should remain the repository root (blank).

Visit https://chinese-learning-ruddy.vercel.app, enter APP_PASSCODE, and click **Unlock**. No email is sent. The cookie lasts 30 days and uses HttpOnly, Secure on Vercel/HTTPS, and SameSite=Strict. Changing APP_PASSCODE, the service key, or LEARNER_USER_ID invalidates all existing app sessions after redeploying.

Use Settings → Lock this device to save pending changes and clear the current cookie. If saving fails, the app stays unlocked so you can retry or export your progress. This locks only that device; rotate the passcode to invalidate every device. Sessions do not depend on Supabase Auth email quotas. A locked request cannot fetch the library, import lessons, or load/save progress.

If the unlock page reports incomplete setup, check all four variables and redeploy. If it says to run the schema, re-run the current SQL file. Repeated incorrect attempts will be limited for up to 15 minutes.

## 4. Import a lesson

1. Unlock the app.
2. Click **Import lesson**.
3. Paste the JSON from ChatGPT, preview it, then **Save to my library**.
4. Reload to verify persistence. Save a suggested card, open Review, and try another device with the same passcode.

For a complete neutral test, copy `public/example-lesson.json`. It uses 2026-10-22; duplicate dates are rejected without replacing existing lessons. Change to a valid unused date if needed.

For a direct database test before deployment, open `supabase/example-lesson.sql`, replace YOUR_SUPABASE_USER_UUID with your existing learner UUID, paste the full SQL into SQL Editor, and run it. Plain ChatGPT JSON belongs in the app importer, not SQL Editor. Administrative SQL testing does not establish that the public app gate works.

Copy `public/automation-instructions.txt` into your existing ChatGPT automation. It can keep generating at 8 AM America/New_York. The web app does not access your ChatGPT subscription or run that schedule. The format is documented in docs/importing.md. Cards require your approval; selected custom phrases get draft dictionary pinyin and a manually entered meaning. Difficulty feedback does not sync back to ChatGPT automatically.

## Privacy and operation

Anyone can visit the unlock page. Private content is fetched only after server verification. Signed tokens cannot be edited to extend expiry or select a different learner. The cookie signing key is derived from the server service key, passcode, and learner UUID, using a purpose-specific HMAC; no extra signing-secret variable is needed. Keep the passcode private and use at least eight characters.

Progress is saved to Supabase, not mirrored into browser storage. Keep a tab open if saving fails. Saves within one tab are serialized and opening a library does not write its initial snapshot. Closing a tab with unsaved changes prompts you to stay. Sync across tabs/devices remains last-write-wins, so avoid editing the same deck in multiple places simultaneously. Previously loaded content can be read by an unlocked device; the app checks the session when a tab regains focus. Locking does not erase copies a previously authorized person might have made.

Personal originals remain ignored under .private/original-lessons.json. The optional one-time script `npm run import:lessons` can import them using your local server key and learner UUID. It validates the stored lesson format, accepts either Supabase URL setting, and preserves existing dates. Do not commit learning exports, filled-in environment files, or private lesson data.

## Local development and tests

`npm run dev` provides an explicitly local, browser-only prototype without credentials outside Vercel. `LOCAL_DEMO=1 npm run start` does the same after building. Vercel always enforces the gate even if LOCAL_DEMO was set. Do not expose local demo mode as a public service.

For a real local gate, use LOCAL_DEMO=0 and the four variables privately in .env.local. Build once with `npm run build` before the browser suites; `npm run test:privacy` also builds for itself. No production secrets are required for automated tests:

- `npm test`: desktop/mobile reading, imports, and review in a local demo.
- `npm run test:database`: actual SQL, limiter permissions/reset, duplicate preservation, URL handling, session forgery/expiry/rotation.
- `npm run test:privacy`: rebuilds with private runtime data present, checks browser bundles for private titles, and verifies deployment-mode access stays locked without a valid session. On a clean checkout it temporarily creates an ignored private canary and removes it afterward; existing originals are never replaced.
- `npm run test:passcode`: the real protected Next.js routes against a local PostgreSQL test service, including cookie properties, wrong-passcode throttling, data ownership, import cancellation, progress, reload, and flushing pending changes before locking.

Tests do not know your real passcode. Live unlocking must be checked after the variables/schema are supplied. Real iPhone Safari interactions still need a physical device test.
