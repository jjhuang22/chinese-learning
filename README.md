# Chinese Learning

A single-learner Traditional Chinese reading and flashcard app. Generate lessons in your existing ChatGPT conversation or automation, import the JSON, then read with sentence-level pinyin and review expressions you choose to save.

Built with Next.js 16, React 19, TypeScript, and Supabase. The deployed app uses a private passcode; local demo mode works without credentials.

## How it fits together

```text
ChatGPT → lesson JSON → preview and validation → lesson library
                                                ↓
                                      reader → approved cards → review

Browser ── signed session ── Next.js server/API ── service key ── Supabase
Local demo ─────────────────────────────────────────────────── browser storage
```

The server scopes every database request to one configured learner UUID. The browser never receives the service key. Supabase browser roles have no access to learning data, including through old email-login sessions.

| Path                                                        | Responsibility                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `app/page.tsx`                                              | Authenticate and load the library and progress, or start the local demo             |
| `app/api/`                                                  | Unlock/lock, session checks, imports, and progress saves                            |
| `components/study-app.tsx`                                  | App navigation, lesson selection, and shared dialogs                                |
| `components/reader.tsx`, `lesson-library.tsx`, `review.tsx` | Reading, library browsing, and card review                                          |
| `hooks/use-progress.ts`, `lib/progress-sync.ts`             | Browser storage in demo mode; serialized cloud saves with revision checks           |
| `lib/model.ts`, `import-lesson.ts`, `progress-schema.ts`    | Data contracts, import validation, and card identity                                |
| `lib/passcode.ts`, `server.ts`, `library.ts`                | Sessions, protected database access, bounded requests, and paginated lesson loading |
| `supabase/schema.sql`                                       | Tables, server-only permissions, revision-checked saves, and unlock throttling      |
| `public/`                                                   | Automation instructions, neutral example JSON, and app icons                        |
| `tests/`                                                    | Desktop/mobile browser, database, privacy, and protected-route tests                |

## Run locally

Use Node.js 22.18+ (`nvm use`) and npm:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Development uses neutral lessons, or ignored `.private/original-lessons.json` when present. Demo imports and progress stay in that browser. Set `USE_PUBLIC_FIXTURES=1` to force neutral content.

| Mode                | Command                                                                        | Storage and access                                     |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Development demo    | `npm run dev`                                                                  | Browser storage; no passcode, even with `LOCAL_DEMO=0` |
| Production demo     | `npm run build`, then `LOCAL_DEMO=1 npm run start`                             | Browser storage; no passcode                           |
| Protected local app | Configure `.env.local`, run `npm run build`, then `LOCAL_DEMO=0 npm run start` | Supabase and passcode required                         |
| Vercel              | See [deployment](docs/deployment.md)                                           | Always protected, regardless of `LOCAL_DEMO`           |

Demo servers are for trusted local use. The commands bind to all network interfaces.

## Reading and review

- Read two related passages per lesson. Pinyin starts on; turn off Show all pinyin to reveal individual sentences by tapping.
- Tap highlighted vocabulary for contextual meaning. Save suggestions individually or in bulk; dismissed suggestions stay out of bulk saves.
- Select another phrase to create a card with dictionary-generated pinyin and a meaning you enter. Card identity ignores spacing and common punctuation.
- Review up to 12 due cards. **Keep reviewing** requeues a card once per session and schedules another review in 1–7 days. **Understand already** archives it; an optional refresher becomes available after 30 days.
- Browse, edit, archive, or restore cards. Mark lessons read.

Lessons are stored individually in `lessons`. Cards, dismissed suggestions, read markers, and feedback share one JSON document in `learner_state`. Cloud saves happen after edits, one request at a time. A revision check rejects stale saves from another tab/device. If a conflict appears, use **Export unsaved progress** in the conflict warning before reloading; conflicts are not merged automatically.

## Import lessons

Give ChatGPT the [automation instructions](public/automation-instructions.txt), then paste its JSON into **Import lesson**. Preview before saving. Dates are unique; importing an existing date never replaces its lesson. Suggested cards enter review only after approval.

See the [format contract](docs/importing.md) and [complete example](public/example-lesson.json). Production setup and administrative imports are covered in [deployment](docs/deployment.md).

## Development checks

```sh
npm run check
```

This runs formatting, a production build, TypeScript, and all four test suites. Stop manually running servers on test ports 3000–3002 and 4010 first. Browser tests use `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to another Chromium executable. CI installs Playwright's Chromium and uses synthetic data without production credentials.

Run a suite separately with `npm test`, `npm run test:database`, `npm run test:privacy`, or `npm run test:passcode`; browser/server suites require a current build. Use `npm run format` to apply formatting. Database tests execute the actual SQL in PGlite; protected-route tests use a local Supabase-compatible test service backed by that SQL.

## Current limits

Review scheduling is intentionally simple. Progress is saved as a whole document (up to 5,000 cards and a 2 MB request), with conflict detection rather than automatic merging. The conflict warning offers **Export unsaved progress**, which includes cards and progress but not lesson texts; there is no restore UI yet.

Home Screen installation is supported. Offline reading and push notifications are not implemented. ChatGPT generation stays separate: the app has no AI generation endpoint or scheduled generation job, and does not send feedback or card history back to ChatGPT. Pinyin and definitions need human review. Native iPhone Safari text selection still needs device testing.
