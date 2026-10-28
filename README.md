# 日常 · Everyday Chinese

A private Chinese reading and flashcard app with a public codebase and a server-verified passcode gate. Copy structured lessons from your existing ChatGPT automation, preview them, and save them to Supabase. No AI API billing, generation endpoint, or scheduled Vercel job is required.

## Setup

Follow **[docs/deployment.md](docs/deployment.md)**, the single current setup guide. It includes the exact Vercel/Supabase URLs, the four required settings, updated schema, passcode setup, test steps, and direct SQL import instructions.

- **Automation instructions:** `public/automation-instructions.txt`
- **Pasteable example:** `public/example-lesson.json`
- **Database setup:** `supabase/schema.sql`
- **Direct SQL example:** `supabase/example-lesson.sql` (replace its user UUID placeholder)
- **Format reference:** `docs/importing.md`

The deployed app requires your private passcode. All data access happens on the server, scoped to your existing learner UUID; browser database access is not used. Personal originals are ignored under `.private/`; only neutral examples are public.

## Local development

Node.js 22.6+ and npm:

```sh
npm ci
npm run dev
```

Outside Vercel, development mode is a browser-only prototype. It reads ignored original lessons when present and neutral fixtures otherwise. Local imports/cards persist only in that browser. Invalid saved progress is preserved for export until you explicitly reset it. Use `LOCAL_DEMO=0 npm run start` after building to test the protected production boundary. Vercel always requires the passcode even if LOCAL_DEMO was set accidentally.

## Validation

```sh
npm run build
npm run typecheck
npm test
npm run test:database
npm run test:privacy
npm run test:passcode
```

Stop a manually started server on port 3000 before npm test. Browser tests use desktop and phone-sized Chromium; set CHROMIUM_PATH if it isn't /usr/bin/chromium. Database tests use PGlite to run the actual SQL schema and example against a local PostgreSQL engine, and cover card identity, persisted-data validation, and save ordering. The privacy command rebuilds with private runtime data present; on a clean checkout it creates and removes an ignored canary fixture. Live unlocking and your Supabase project still need deployed testing with real configuration. Native iPhone Safari selection needs a real device check.

## Reading and review

Sentences flow together in paragraphs. Tap a sentence for pinyin or use Show all pinyin. Tap a highlighted expression for contextual meaning and Save flashcard. Select any other phrase to create a card with draft dictionary pinyin, a manually entered meaning, and its source sentence.

Highlights and suggested cards share one approval state. Review shows characters/pinyin first and meaning/context on reveal. Keep reviewing requeues a card once in the session; Understand already archives it, with an optional refresher after 30 days. Review also supports browsing and restoring cards. Scheduling is a simple initial version rather than full FSRS. Saves from one tab are serialized; cloud saves across tabs/devices still use last-write-wins. Locking waits for pending saves, and closing a tab with unsaved changes prompts you to stay.

The app includes Home Screen metadata and icons. Offline reading and push notifications are not implemented. Vocabulary and difficulty feedback do not sync back into the separate ChatGPT automation automatically.
