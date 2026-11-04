# TL;DA - product and architecture spec

Paste meeting notes, an LLM extracts the action items, and they're stored on a meeting. Each item has a status (open / in progress / done). No login.
Keep it simple, correct, and well-validated. Deployment is out of scope (local only).
Known concerns and deliberately skipped work are listed in `CONCERNS.md`. Code style rules are in `CLAUDE.md`.

## Design reference

The UI design lives in a Claude artifact (Design canvas, 3 boards: interactive planner, processing state, error state):

- https://claude.ai/artifact/LCy8vcbA2ihQb4f6G67rzp
- Source files in the artifact: `project/Main.dc.html` (interactive page, all markup/CSS/logic), `project/Processing.dc.html` and `project/Error.dc.html` (frozen state frames), `project/canvas.json`.
- Read it with the Artifact tool (`action: "read"`, with `path: "project/Main.dc.html"` for the source) from the same Claude account. The link is private. If it can't be opened, use the summary below.
- The artifact simulates the LLM with a timer + keyword matching. Replace that with the real API calls described below. Keep the UI as designed.

### Design summary
- Header: "TL;DA" in Instrument Serif, 72px, letter-spacing 0.02em; under it "Too long; do actions." (serif, 22px, muted grey); then "Paste your meeting notes and get the to-dos." (body size). Primary button "New meeting notes" on the right, anchors to the meeting form. Shown only on narrow screens (below `lg`), where the form stacks below the list.
- Layout: max-width 1216px, centered. Meetings list (flex 999 1 560px) beside the meeting form (flex 1 1 360px); the meeting form stacks below the list on narrow widths.
- Meeting card: serif title, date, "X of Y done" + progress bar, list of items. Item text is struck through and muted when done.
- Delete: an icon button in the meeting card header (trash icon, `aria-label` "Delete meeting: {title}") opens a modal `<dialog>` ("Delete this meeting?", the title and item count, "This can't be undone."), with a ghost "Cancel" and a red "Delete meeting" button; Esc or a backdrop click cancels. The delete waits for the server (not optimistic): the confirm button shows "Deleting…" with a spinner and both buttons are disabled. On success the dialog closes, the card plays a 200ms leave animation and is removed, and the live region says "Deleted {title}." On failure the dialog stays open with a `role="alert"` banner ("Couldn't delete this meeting" + the server message) and the buttons are enabled again. A 404 counts as deleted. The failure banner is one small state added to the design.
- Status control per item: 3 real `<button type="button">` segments (Open / In progress / Done) with `aria-pressed`, icons (ring / half ring / ring with check). Selected colors: open bg #D9DCD3; in progress bg #F6DD92 text #442F00; done bg #BFE3CB text #0D4222.
- Meeting form (`MeetingForm`): optional Title input, Notes textarea (min-height 240px), submit button ("Extract action items" / "Extracting…" with spinner / "Try again"), `aria-live` message.
- Processing state: a placeholder meeting card (`SkeletonCard`) at the top of the list (spinner, the fixed title "New meeting", "Extracting action items from your notes…", 3 skeleton rows) and a busy submit button. Disable submit while processing.
- Error state: `role="alert"` banner above the button: "Couldn't extract action items" / "The notes weren't processed, so nothing was added. Your notes are still here." Button becomes "Try again". Notes and title stay in the form. The banner text comes from the server message (see Error handling).
- Empty state: "No meetings yet".
- Tokens: bg #F4F5F1, card #fff, ink #16191C, muted #5B6168, line #E4E6DF, accent #3340B5, ease-out `cubic-bezier(0.23, 1, 0.32, 1)`. Fonts: Geist (400/500/600) and Instrument Serif.
- Motion (Emil Kowalski rules): UI transitions under 300ms (press 160ms, enter 300ms), `:active` scale(0.97), never scale(0), hover only under `(hover: hover) and (pointer: fine)`, animate transform/opacity only, honor `prefers-reduced-motion`, spinner spins fast.
- Accessibility: real buttons, labeled inputs, `aria-pressed`, `aria-busy`, `role="alert"`, `aria-live`.

## Stack
- Next.js (App Router) + React + TypeScript + Tailwind. One codebase, no separate backend.
- SQLite via better-sqlite3 + Drizzle ORM.
- zod for all validation (schemas shared between frontend and backend in one file).
- pino for logging (JSON).
- vitest for tests.
- LLM: Gemini free tier by default (key from Google AI Studio), swappable (see below).
- No auth, no state library, no queue, no Fastify.
- Layers: route handlers (`app/api/**/route.ts`: `app/api/meetings/`, `app/api/meetings/[id]/`, `app/api/action-items/[id]/`) only handle HTTP (parse, validate, call the service, shape the response). `services/MeetingService.ts` owns the logic: the DB writes, the LLM call, the extraction log, and turning every failure into an `AppError`. `integrations/` holds the LLM integration (`LlmIntegrationService`, providers, prompt, output parsing) and does no logging, no DB work and knows no HTTP error codes. `lib/server/db/` holds the schema and the connection (the queries live in `MeetingService`); `lib/server/` holds the server-only helpers (`withApi`, logger, env, request validation), `lib/` the code shared with the client (schemas, error table), `app/lib/` the client-only helpers and `types/` the shared types. Routes call the service, never the DB or the integration directly.
- Frontend: the client calls the Route Handlers with `fetch` (no Server Actions). Keep fetch and state logic out of components:
  - `app/lib/apiClient.ts`: thin typed `fetch` wrapper that parses the error envelope (`code`, `message`, `fields`, `requestId`) into a single `ApiError` type. All hooks use it.
  - `app/hooks/useCreateMeeting.ts`: returns `{ phase, error, submit, reset }`, where `phase` is `'idle' | 'processing' | 'error'`; aborts the request on unmount.
  - `app/hooks/useSetItemStatus.ts`: PATCH with `useOptimistic` (flip instantly, roll back on failure).
  - The first meeting list is read on the server in `app/page.tsx` (through `MeetingService`) and passed to the client `Planner`, so there is no loading state. Everything after that uses `fetch` against the Route Handlers.
  - Components live in `app/components/` (re-exported from `index.ts`): `Planner` holds the page state and the header, and `MeetingForm` holds its own field state and empties it when `onSubmit` resolves to true; `MeetingList` (with the empty state), `MeetingCard`, `StatusButtons`, `SkeletonCard`, `MeetingForm`, `Button` and `Spinner` render it. Every `<button>` is the shared `Button`: `variant` says what the button means (`primary` default, `primary-danger`, `secondary`, `delete`) and decides its look and hover, `size` is `md` (default), `sm` or `icon` (needs an `aria-label`), and `pending` shows the spinner and disables it. Dialogs live in `app/components/dialogs/`: `Dialog` is the shared confirm-dialog skeleton (open/close, Esc and backdrop dismissal, busy state, unique ids, layout) and each specific dialog, such as `DeleteMeetingDialog`, only supplies its text, labels and handlers. Icons are separate files in `app/components/icons/`. Pure helpers (`app/lib/format.ts`, `app/lib/meetings.ts`) keep list logic out of components.
  - `app/hooks/useDeleteMeeting.ts`: returns `{ pending, error, remove, reset }`; waits for the `DELETE` response before reporting it, treats a 404 as deleted, and keeps the error so the dialog can show it. `DeleteMeetingDialog` uses it (the dialog owns the request and its error); `MeetingCard` owns whether the dialog is open and the exit animation; `Planner` only removes the meeting from the list and announces it.
  - Hooks live in `app/hooks/` with an `index.ts`. Don't add a generic mutation abstraction or a data-fetching library for two mutations and one read.

## Next.js setup notes
- Route Handler caching: every Route Handler file exports `runtime = 'nodejs'` (required for `better-sqlite3`) and `dynamic = 'force-dynamic'`, so the list is never served from a cache. Client `fetch` calls use `cache: 'no-store'`.
- Native and worker-thread packages: in `next.config` set `serverExternalPackages: ['better-sqlite3', 'pino', 'pino-pretty']` so they load from `node_modules` instead of being bundled. Log plain JSON with pino in every environment; for readable local output pipe it through the `pino-pretty` CLI in the dev script (`next dev | pino-pretty`), not a pino transport inside the app.
- Dev hot reload re-runs module code, which would create duplicate singletons (SQLite connection, logger). Keep each on `globalThis` so it is created once (`globalThis.__db ??= createDb()`).

## Security basics
Checked against the OWASP Top 10 (2025). Cheap measures to include; the larger gaps (no auth, no rate limiting, no encryption at rest) are in `CONCERNS.md`.
- Security headers: set `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'` (or `X-Frame-Options: DENY`) and a `Referrer-Policy` in `next.config`. A strict CSP is left to CONCERNS.md.
- No auth, so bind the dev and start scripts to `127.0.0.1` explicitly (`next dev -H 127.0.0.1`, `next start -H 127.0.0.1`), not to all interfaces.
- Never prefix the LLM key (or any secret) with `NEXT_PUBLIC_`. Add `import 'server-only'` to `lib/server/`, `integrations/` and `services/` so an accidental client import fails the build.
- No SQL built from strings: all queries go through Drizzle's query builder or parameterized statements.
- Return only the fields the UI needs: `GET /api/meetings` must not include the raw `notes`.
- No CORS headers: never add permissive CORS. Together with the required `application/json` content type, this stops other websites from calling the API from a browser.
- Fail closed: any unexpected error returns a non-2xx status and writes nothing. Add `app/error.tsx` and `app/global-error.tsx` so a rendering crash shows a friendly message, not a raw error.
- Supply chain: commit the lockfile, keep dependencies minimal, run `npm audit` before finishing, and check that `better-sqlite3` installs cleanly.

## Linting and formatting
Use the following ESLint (flat config) and Prettier setup exactly as given. Create both files in the project root.

`eslint.config.mjs`
```js
import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import js from "@eslint/js"
import prettierPlugin from "eslint-plugin-prettier/recommended"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import tailwind from "eslint-plugin-tailwindcss"
import tsParser from "@typescript-eslint/parser"

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    js.configs.recommended,
    prettierPlugin,
    {
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "no-shadow": "off",
            "no-undef": "off",
            curly: "warn",
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-shadow": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                },
            ],
            "simple-import-sort/imports": [
                "error",
                {
                    groups: [["^react", "^\\u0000", "^@?\\w", "^[^.]", "^\\."]],
                },
            ],
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    {
        files: ["app/**/*.tsx"],
        plugins: { tailwindcss: tailwind },
        settings: {
            tailwindcss: {
                cssConfigPath: "app/globals.css",
            },
        },
        rules: {
            "tailwindcss/classnames-order": "off",
            "tailwindcss/no-contradicting-classname": "error",
            "tailwindcss/no-custom-classname": "off",
            "tailwindcss/enforces-shorthand": "warn",
            "tailwindcss/important-modifier-suffix": "warn",
        },
    },
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        ".prettierrc.cjs",
    ]),
])

export default eslintConfig
```

`.prettierrc.cjs`
```js
module.exports = {
    semi: false,
    trailingComma: "all",
    singleQuote: false,
    tabWidth: 4,
}
```

- Packages (dev): `eslint`, `eslint-config-next`, `@eslint/js`, `@typescript-eslint/parser`, `prettier`, `eslint-plugin-prettier`, `eslint-config-prettier`, `eslint-plugin-simple-import-sort`, `eslint-plugin-tailwindcss`.
- Scripts: `"lint": "eslint ."`, `"lint:fix": "eslint . --fix"`, `"format": "prettier --write ."`. Call `eslint` directly rather than `next lint`.
- Tailwind plugin version: the config uses `cssConfigPath`, which is the Tailwind v4 setting. Check that the installed `eslint-plugin-tailwindcss` version supports the Tailwind version the scaffold installs, and fix the version pairing if it does not.
- Type-aware linting (`parserOptions.project`) fails on any `.ts`/`.tsx` file that `tsconfig.json` does not include. Make sure `include` covers `vitest.config.ts`, `drizzle.config.ts`, test files and scripts.
- The Tailwind rules only apply to `app/**/*.tsx`, so keep all UI components under `app/` (for example `app/components/`).
- The Next.js scaffold formats with 2 spaces; the Prettier config uses 4. Run `npm run format` once right after scaffolding so the first commit is consistent.
- Code snippets in this spec are illustrative and use their own formatting. Real code follows the Prettier config.

## Data model
- `meetings`: id, title, notes, created_at
- `action_items`: id, meeting_id (FK, cascade), text, status (`open` | `in_progress` | `done`, default `open`), created_at

## API (Next Route Handlers)
- `GET /api/meetings` → one page of meetings (newest first) with their items. Does not include the raw `notes`.
- `POST /api/meetings` body `{ title?, notes }` → calls the LLM to extract the action items, saves meeting + items in ONE transaction, returns the saved meeting (201, bare JSON).
- `DELETE /api/meetings/:id` → deletes the meeting and its items (the foreign key cascades), returns 204 with no body. Missing meeting → 404.
- `PATCH /api/action-items/:id` body `{ status }` → returns the updated item (bare JSON).

`GET /api/meetings?cursor=<nextCursor>` returns `{ meetings, nextCursor }`: 5 meetings per page, newest first. `nextCursor` is the id of the last meeting on the page (keyset), or null on the last page; the client passes it back unchanged. The UI shows a "Load more" button under the list.

Intentionally not handled (see CONCERNS.md): duplicate submissions (no idempotency key; the UI only disables the button while processing). Don't add solutions for these.

Order in POST: validate → LLM call → validate LLM output → transaction. A failure writes nothing, and no DB lock is held during the LLM call.

## Validation (zod, strict)
- Bodies are `.strict()`: unknown keys rejected. Trim strings and strip control characters from `notes` and `title`, but keep newlines (`\n`) and tabs, which are normal in meeting notes. `rawNotes` in logs is the notes exactly as submitted, before any trimming or stripping.
- `title`: optional, max 120 chars. `notes`: required, min ~20 chars, max ~20,000.
- Require `Content-Type: application/json`. Malformed JSON → 400. Over-long notes are rejected by the schema (400, field message on the notes).
- Validate `:id` (positive integer) and `status` (enum). Missing item or meeting → 404.
- LLM output is untrusted and must be usable action items, NOT prose. Accept only a response that is valid JSON (a single optional ```json fence is tolerated, nothing else around it) and matches the zod schema: 0–30 items (an empty list is valid and means "nothing found", see Error handling); each `text` trimmed, 1–300 chars, single line. Dedupe identical items.
- Anything else is "prose" / unusable: chatty text, markdown, refusals, explanations, JSON of the wrong shape, items that are paragraphs. Classify with a `reason`: `not_json`, `schema_mismatch`, `prose` (e.g. an item over the length limit or containing line breaks).
- Meeting title: if the user typed a title, use it. Otherwise the model suggests one: the LLM JSON has an optional `title` field (short, about 8 words max; prompt asks for it). Use it only if it is valid (single line, 1-120 chars after trimming); if it is missing or invalid, fall back to `"Untitled meeting"`. The title is cosmetic, so a bad title never makes the response unusable. While processing, the placeholder card always reads "New meeting".
- Validity is all-or-nothing for the items: one bad item (e.g. over-long or multi-line) makes the whole response unusable, and more than 30 items is rejected, not truncated.
- Unusable response → discard it (never saved to the DB), return `LLM_BAD_OUTPUT` to the client so the error state is shown, and still log the event (see Logging).
- The server always sets status to `open`; the model never chooses it.
- Prompt injection: put the notes inside clear delimiters and tell the model to treat them as data only.
- Safe rendering: all LLM output (item text, suggested title) is untrusted. Render it only as plain React text, which React escapes. Never use `dangerouslySetInnerHTML` or build HTML from it.

## Error handling
- Typed `AppError` classes + a `withApi(handler)` wrapper that catches everything and returns one envelope: `{ error: { code, message, fields?, requestId } }`. Never leak stack traces or internals.
- Codes: `VALIDATION_ERROR` 400, `NOT_FOUND` 404, `NO_ACTION_ITEMS` 422, `LLM_BAD_OUTPUT` 502, `LLM_UNAVAILABLE` 502, `LLM_TIMEOUT` 504, `INTERNAL` 500.
- `LLM_UNAVAILABLE` (502) covers provider failures: provider 5xx, network errors and a provider 429. The message says the extraction service is busy or unavailable and to try again.
- A bad or missing API key is a config problem, not the user's fault. The startup env check catches a missing key; if an invalid key still fails at runtime, return `INTERNAL` (500) and log the real cause at `error` level.
- Valid response with zero items → treated as an error: `NO_ACTION_ITEMS` (422), nothing saved. The response carries a human-readable `message` that the UI shows to the user (see the message table below).
- Prose / unusable LLM response → `LLM_BAD_OUTPUT` (502), nothing saved, the UI shows the error banner with the notes kept. The client message stays generic; the details (`reason`, raw response) go only to the log.
- LLM call: a single 30s timeout covering the whole call, implemented as an `AbortController` aborted by a 30s timer (not `AbortSignal.timeout`, which fake timers cannot control in tests). No automatic retries: on a provider 429/5xx the request fails immediately with a clear error, and the user retries with "Try again". Automatic retries are listed in CONCERNS.md as a possible later improvement.
- Rate limiting and bot protection are intentionally not built (see CONCERNS.md).
- Frontend: validates with the same zod schema first. Below the notes minimum (20 chars) the submit button stays disabled and a small hint shows under the textarea ("Add a bit more detail, at least 20 characters"); above the maximum, a hint shows in the same place ("Notes are too long, at most 20000 characters"). While the notes field is empty the hint stays hidden, and the button is simply disabled. This adds one small state to the design.
- Server errors: the response carries a human-readable `message` for every code, and the UI shows that message in the existing error banner. Server-side `VALIDATION_ERROR` (rare, since the client checks first) shows the text from `fields` under the matching field instead. The notes and title always stay in the form.
- Messages live in one lookup table on the server (code -> HTTP status + message), not in `if` chains:

| Code | Message |
|---|---|
| `NO_ACTION_ITEMS` | No action items could be found in these notes. Try adding who needs to do what. |
| `LLM_BAD_OUTPUT` | We couldn't turn these notes into action items. Please try again. |
| `LLM_UNAVAILABLE` | The extraction service is busy or unavailable. Please try again in a moment. |
| `LLM_TIMEOUT` | Extraction took too long. Please try again. |
| `VALIDATION_ERROR` | Please check the highlighted fields. |
| `NOT_FOUND` | Item not found. |
| `INTERNAL` | Something went wrong on our side. Please try again. |

## Logging (pino)
- Request ID per request (reuse `x-request-id` or generate); attach it to every log line (child logger), return it in the response header and error body.
- Every request gets a completion log on success AND on error: `requestId`, `method`, `route` (pattern, e.g. `/api/action-items/:id`), `status`, `durationMs`, `outcome` (`success` | `error`), `errorCode` on failure, and relevant ids (`meetingId`, `itemId`, `newStatus`) where applicable (`status` is always the HTTP status). Log request start at `debug`.
- Extraction events (written by `MeetingService` on `POST /api/meetings`, every outcome: success, prose/unusable response, schema mismatch, no action items found, timeout, provider error) include `provider`, `model`, `latencyMs`, token counts, `outcome`, and for failures the `reason`. Failed extractions ALWAYS also include the raw pasted notes (`rawNotes`) and the complete LLM response (`llmResponse`, verbatim, unparsed and untruncated; if the call failed before a response, `null` plus the provider error), even though the response is discarded and not saved. Successful extractions include `rawNotes` and `llmResponse` only when `LOG_LEVEL` is `debug`, since the result is already saved.
- Other requests (`GET /api/meetings`, `PATCH /api/action-items/:id`) have no raw text or LLM response; log them per the completion fields above, including validation failures and 404s with the zod issue paths (not the values).
- Always redact secrets: API keys, `Authorization`/cookie headers. Never log env vars.
- Note for the README: logging raw notes and responses is intentional for debugging this task. Meeting notes can contain sensitive data, so in a real deployment this needs a retention policy or redaction.
- Levels: `info` for successful requests, `warn` for expected failures (validation, 404, 422, unusable LLM output), `error` with stack for 5xx, timeouts and provider failures.

## LLM integration (swappable)
```ts
interface LlmProvider {
  complete(
    request: { system: string; user: string },
    opts: { signal: AbortSignal },
  ): Promise<{ text: string; usage?: { inputTokens?: number; outputTokens?: number } }>;
}
```
- Implementations (in `integrations/providers/`): `GeminiProvider` and `MockProvider` (tests and offline dev). Another provider is one class implementing `LlmProvider` plus one factory entry.
- A factory picks the provider from env: `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`.
- `LlmIntegrationService` (`integrations/`) wraps the active provider and owns: the prompt, the timeout, JSON parsing and zod validation. Providers only make the HTTP call and return the raw text plus token usage, so the verbatim response can always be logged. The service never throws, logs or touches the database: it returns a success or a failure with a `reason`. `MeetingService` logs the extraction event and maps the reason to an error code with the `LLM_FAILURE_CODES` lookup table in `lib/server/errors.ts` (server-only error mappings, reusable by any service). A valid empty list is a meeting rule, not an LLM failure, so `MeetingService` throws `NO_ACTION_ITEMS` itself.
- A timeout needs no provider error: `LlmIntegrationService` aborts the call and reports `LLM_TIMEOUT`, so a provider just lets the abort propagate. Providers map provider 5xx, network errors and 429 to `LlmUnavailableError` (-> `LLM_UNAVAILABLE`), so API error codes never change when swapping providers. A blocked or empty reply is returned as the raw provider response, which then fails validation (-> `LLM_BAD_OUTPUT`) and is logged verbatim.
- Ask models for plain JSON (JSON/schema mode where available), then validate with zod. Don't depend on provider-specific tool calling.
- Gemini free-tier limits change often; check current quotas in AI Studio.
- Env config: validate once at startup with a single zod schema in `lib/server/env.ts` (about 20 lines, no config library): `LLM_PROVIDER` (enum), `LLM_MODEL` and `LLM_API_KEY` (both required unless the provider is `mock`) and an optional `LOG_LEVEL` (default `info`). A missing or invalid value stops the app with a clear message naming the variable and never printing the key. Everything else imports the parsed `env` object, not `process.env`. Commit a `.env.example` listing every variable; `.env` is gitignored.

## Performance
Target: extraction typically completes in under 2 seconds (p50). This is a target to measure, not a guarantee and not a timeout. Free tiers can queue, so p95 will be higher. The hard timeout stays at 30s; the processing state covers slow calls.
- Model: use a small, fast model by default (Gemini Flash-Lite class). Make it configurable via `LLM_MODEL`; document the fastest known-good value in the README.
- Reasoning/thinking: disable or minimize (for Gemini set the thinking budget to 0). Reasoning tokens are the biggest hidden latency. Not every model supports this setting (some reject it, some always think): when picking the default model, check that it accepts the setting; if not, pick another small model that does, or omit the setting for that model. Record the working model and settings in the README.
- Output size: set `maxOutputTokens` (about 600). Ask only for the short fields (`text`, optional `title`) and use the provider's JSON/schema mode so the model doesn't add prose.
- Temperature: 0 to 0.2.
- Prompt: keep the system prompt short; send notes once, no few-shot examples unless they fix a measured quality problem.
- Retries: none (a retry doubles the wait). The user retries from the error state.
- Connections: providers call the global `fetch`, which keeps a shared connection pool (HTTP keep-alive), so the provider object itself is cheap to build per request. If a provider SDK with its own connection pool is used instead, create that client once and reuse it.
- DB: a single SQLite connection with WAL mode; the transaction runs after the LLM call, so no lock is held while waiting.
- Measure: `latencyMs` is logged on every extraction event, so latency can be checked from the logs. No report script is built.
- Frontend: show the processing state immediately on submit (no waiting on the response to start it). Don't block the list while processing; the rest of the page stays usable.

## Tests (vitest)
- Schema edge cases (empty/short/huge notes, unknown keys, bad status, bad id).
- Every error path through the handlers with a mocked LLM: bad JSON, over-long notes, malformed model output, timeout, zero items, provider unavailable.
- Valid empty list (`{"items": []}`): returns `NO_ACTION_ITEMS` (422) with the human-readable message, writes nothing, and is logged with `rawNotes` and the full `llmResponse`.
- Prose responses (plain sentences, markdown, refusal, wrong-shape JSON, over-long items): each must return `LLM_BAD_OUTPUT`, write NOTHING to the DB (assert row counts), and emit a log event containing `rawNotes` and the full `llmResponse`.
- Logging: assert that failed extractions log `rawNotes` and the full `llmResponse` (covered in the error-path tests), and that secrets never appear in logs.
- Env validation: a missing `LLM_API_KEY` (when the provider is not `mock`) fails with a clear message naming the variable, without printing any secret.
- Timeout: use fake timers to check that a call exceeding 30s returns `LLM_TIMEOUT` (504) and writes nothing.
- Meeting title: a user-typed title wins; a valid model title is used when the user left it blank; a missing or invalid model title falls back to "Untitled meeting".
- Safe rendering: item text and title containing HTML (e.g. `<img onerror=...>`) render as plain text in the component, not as markup.
- Happy path: create meeting → items saved as `open` → change a status.
- Delete: removes the meeting and its items (assert row counts), a missing id returns 404, an invalid id returns 400.

## Suggested build order
Definition of done for every step: the tests for that step pass, `npm run lint` has no errors (review any warnings), and `next build` succeeds. Stop and report before starting the next step.

1. Scaffold Next.js + Tailwind + TS; add zod, drizzle, better-sqlite3, pino, vitest, and the ESLint/Prettier setup from "Linting and formatting" (then run `npm run format` once). Set the dev/start scripts to bind to `127.0.0.1`, and add the security headers and `serverExternalPackages` to `next.config`.
2. Schemas, env validation, DB schema + migration, error classes, `withApi`, logger.
3. `LlmProvider` interface + `MockProvider` + `LlmIntegrationService`; `MeetingService`; endpoints against the mock; tests.
4. Frontend from the design reference; wire optimistic status changes, processing and error states.
5. `GeminiProvider` + env config; try the real flow end to end.
6. README: setup, env vars, how to swap providers, how to run tests, and a pointer to `CONCERNS.md`. Run `npm audit` and fix or note anything serious.
