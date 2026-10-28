<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Interface preferences

- Keep UI labels and copy plain and minimal. Avoid motivational taglines, decorative icons, numbered section labels, and explanatory copy where a label and button suffice.
- Use the same color for comparable action buttons, including Daily review and Daily lesson.

## Validation requirements

- Before pushing application or test changes, run `npm run check` on the final code. This is the same complete gate as `.github/workflows/checks.yml`: formatting, production build, TypeScript, database tests, desktop/mobile app tests, privacy tests, and passcode tests. Targeted tests are useful during development but do not replace this gate. Fix failures before pushing; if a check cannot run, report the limitation explicitly.
- When changing navigation labels, badges, button text, or accessible names, search all tests for affected role/name selectors, including `tests/passcode` and `tests/privacy`. Preserve assertions about behavior and update selectors to support intentional dynamic counts. Check desktop and mobile, public and editing modes where applicable.
- After merging or rebasing newer code, validate the integrated result before pushing. Documentation-only changes require `npm run format:check`.
- After pushing, inspect the GitHub Actions `Checks` run for the exact pushed commit and wait for its conclusion. If it fails, read the failed job logs, fix the cause, and validate again. Vercel deployment success and commit status checks do not establish that GitHub Actions passed. Report deployment and workflow status separately, and say explicitly if either is still pending or unavailable.
