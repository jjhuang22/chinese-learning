# 日常 · Everyday Chinese

A private Chinese reading and flashcard app with a public codebase. Copy structured lessons from your existing ChatGPT automation, preview them, and save them to Supabase. No AI API billing, generation endpoint, or scheduled Vercel job is required.

## Setup

Follow **[docs/deployment.md](docs/deployment.md)**, the single current setup guide. It includes the exact Vercel/Supabase URLs, the three required web-app variables, updated schema, login redirects, test steps, and direct SQL import instructions.

- **Automation instructions:** `public/automation-instructions.txt`
- **Pasteable example:** `public/example-lesson.json`
- **Database setup:** `supabase/schema.sql`
- **Direct SQL example:** `supabase/example-lesson.sql` (replace its user UUID placeholder)
- **Format reference:** `docs/importing.md`

The deployed app requires your approved email. Row-level security protects lessons and progress separately. Personal originals are ignored under `.private/`; only neutral examples are public.

## Local development

Node.js 22+ and npm:

```sh
npm ci
npm run dev
```

Outside Vercel, development mode is a browser-only prototype. It reads ignored original lessons when present and neutral fixtures otherwise. Local imports/cards persist only in that browser. Use `LOCAL_DEMO=0 npm run start` after building to test the protected production boundary. Vercel always requires sign-in even if LOCAL_DEMO was set accidentally.

## Validation

```sh
npm run build
npm run typecheck
npm test
npm run test:database
npm run test:privacy
```

Stop a manually started server on port 3000 before npm test. Browser tests use desktop and phone-sized Chromium; set CHROMIUM_PATH if it isn't /usr/bin/chromium. Database tests use PGlite to run the actual SQL schema and example against a local PostgreSQL engine. Email delivery and your live Supabase project still need deployed testing. Native iPhone Safari selection needs a real device check.

## Reading and review

Sentences flow together in paragraphs. Tap a sentence for pinyin or use Show all pinyin. Tap a highlighted expression for contextual meaning and Save flashcard. Select any other phrase to create a card with draft dictionary pinyin, a manually entered meaning, and its source sentence.

Highlights and suggested cards share one approval state. Review shows characters/pinyin first and meaning/context on reveal. Keep reviewing requeues a card once in the session; Understand already archives it, with an optional refresher after 30 days. Review also supports browsing and restoring cards. Scheduling is a simple initial version rather than full FSRS. Cloud saves currently use last-write-wins.

The app includes Home Screen metadata and icons. Offline reading and push notifications are not implemented. Vocabulary and difficulty feedback do not sync back into the separate ChatGPT automation automatically.
