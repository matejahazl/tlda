# TL;DA - known concerns and possible future work

Things deliberately left out of the first version because they are out of scope for a small local app or cost too much effort for what they add. Each entry says what the risk is and what a real fix would look like.

## Data privacy and logging
- **Raw notes and full LLM responses are logged on every extraction event.** This is intentional for debugging, but meeting notes can contain personal, commercial or otherwise sensitive data. Anyone with log access can read all of it.
  - Real fix: log length and a hash by default; keep raw text behind an explicit debug flag with a short retention period; redact obvious identifiers (emails, phone numbers) before logging.
- **Notes and titles are stored in plain text in the SQLite file**, including the original `notes` column. No encryption at rest, no deletion path.
  - Real fix: decide whether to store raw notes at all; add a retention policy (deleting a single meeting by hand is possible); encrypt the database file or use a managed database with encryption.
- **Notes are sent to a third-party LLM provider.** Free tiers may use submitted data to improve their models.
  - Real fix: check the provider's data-use terms, use a paid or zero-retention tier for real data, and tell users that their notes leave the system.
- **No consent or notice in the UI** about the above.

## Access control and abuse
- **No authentication.** Anyone who can reach the app can read every meeting, change any status, and spend LLM quota.
  - Real fix: add auth and scope meetings to a user or workspace.
- **No rate limiting.** Deliberately not built for this task: the app runs locally on a free-tier key, and a simple in-memory limiter is weak (it resets on restart, doesn't work across several processes, is bypassed by changing IP, and treats everyone behind one proxy as one client). Today anyone who can reach the endpoint can spam extractions and burn LLM quota. There is no cap on total spend either. A provider 429 already returns a clean `LLM_UNAVAILABLE` error.
  - Real fix: a shared store (Redis or the database), limits per user and per IP, a global daily budget with a kill switch, a `RATE_LIMITED` (429) error with a `Retry-After` header and its own user-facing message.
- **No CSRF or CORS hardening** beyond same-origin defaults. Fine while there is no auth; revisit when cookies or sessions are added.
- **No Content Security Policy.** Only basic security headers are set. A strict CSP is fiddly with Next.js (it needs nonces or `unsafe-inline` for inline scripts and styles) and was left out for scope. Real fix: nonce-based CSP via middleware, tightened until nothing breaks.
- **No TLS and no HSTS.** The app runs over plain HTTP locally. In any real deployment, terminate TLS and send HSTS.
- **No automated dependency or secret scanning** beyond a manual `npm audit` (no Dependabot, no CI scanning, no pre-commit secret checks).
- **No bot protection (CAPTCHA) on the extraction endpoint.** A CAPTCHA (e.g. Cloudflare Turnstile or hCaptcha, verified server-side before the LLM call) is the most effective single improvement against automated abuse when there is no login, and pairs well with rate limiting. Not built here to keep the flow friction-free and the scope small.

## LLM behavior
- **Prompt injection is only partly mitigated.** Delimiters plus strict output validation limit the damage, but notes can still steer which items the model extracts (for example, adding fake items or hiding real ones).
  - Real fix: an evaluation set of adversarial notes, plus a human-review step for high-stakes use.
- **Extraction quality is not measured.** There is no test set of notes with expected action items, so prompt or model changes can silently make results worse.
  - Real fix: a small labeled dataset and an eval script that reports precision and recall per model.
- **Strict all-or-nothing validation of LLM output.** One over-long or multi-line item makes the whole response unusable, and more than 30 items is rejected instead of truncated. This is simple and safe, but it discards a mostly good extraction on a single flaw and can frustrate users with long meetings.
  - Real fix: keep valid items and drop or shorten the bad ones (log what was dropped), truncate to 30 with a visible "more items were found" notice, or split long notes into chunks and merge the results.
- **Model-suggested titles are unchecked beyond length.** A title can be generic or misleading, and it falls back to "Untitled meeting" silently when invalid.
- **Long notes are rejected rather than chunked.** The 20,000 character limit is a hard cut, not a map-reduce over sections.
- **No fallback provider.** If the chosen provider is down or rate-limited, extraction fails. Free tiers change quotas and models without notice.
  - Real fix: ordered provider fallback in `LlmIntegrationService`, with circuit-breaking.
- **Only one real provider.** Gemini is the only real provider; the OpenAI-compatible one (Groq / OpenRouter / Ollama) was planned but dropped to keep scope small.
  - Real fix: add one class implementing `LlmProvider` plus a factory entry and its env vars (for example `LLM_BASE_URL`). Nothing else changes.
- **No language handling.** Notes in other languages are sent as-is; quality and the prose check were only designed with English in mind.

## Data and consistency
- **Duplicate submissions.** The UI disables the button, but the server has no idempotency key, so a double click, a retry or two tabs can create duplicate meetings.
  - Real fix: client-generated idempotency key stored with the meeting.
- **No pagination or limit on `GET /api/meetings`.** The list grows without bound.
  - Real fix: cursor pagination and a "load more" control.
- **No edit of meetings or items, and no delete of single items.** There is no way to correct a wrong extraction (edit text, add a missed item, remove a bad one). Only whole meetings can be deleted.
- **Deleting a meeting is permanent.** No undo, soft delete or trash. The confirm dialog is the only safeguard.
- **No concurrent-edit protection** on status changes (last write wins).
- **SQLite is single-writer and file-based.** Fine locally; not suited to several app instances.
  - Real fix: Postgres, with migrations run as a deploy step.
- **Migrations are not tested** against an existing database with data.

## Reliability and operations
- **No automatic retries.** A provider 429 or 5xx fails the request at once and the user retries manually. Real fix: retry 429/5xx up to twice with short backoff inside one overall deadline, and skip a retry when too little time remains.
- **No queue for long-running extractions.** A slow call keeps the HTTP request open until the deadline. If notes or models get slower, the right design is to save the meeting as `processing` and finish in the background.
- **No health check, metrics or alerting.** Logs exist, but nobody is watching them. No latency histograms, error-rate dashboards or tracing.
- **No log shipping or rotation** for the JSON logs.
- **Secrets handling is minimal:** an `.env` file only. No rotation, no secret manager.
- **Deployment, CI and dependency scanning** are out of scope: no pipeline, no lockfile audit, no container image.

## Frontend and quality
- **No end-to-end tests against the real LLM** (the Playwright suite in `e2e/` uses the mock provider and stubs some API responses), and no frontend unit tests beyond what the build-order steps mention.
- **Accessibility is only partly tested.** `e2e/a11y.spec.ts` runs axe (WCAG 2.0/2.1 A and AA) on the main states and checks tab order and focus in the delete dialog, but nobody has done a screen reader pass (VoiceOver, NVDA), and axe finds only a fraction of real problems. Not yet covered, most valuable first:
  - **Focus after a delete or a create.** The deleted card (and its trash button) is removed, so focus probably drops to `<body>` and a keyboard or screen-reader user loses their place. Not verified. Real fix: assert where focus lands, then move it somewhere sensible (the list heading or the next card). The same question applies after a successful create, when the form clears.
  - **Live-region announcements.** Tests only check that the text is visible. Assert that the `aria-live="polite"` region receives "Added ... with N action items.", "Deleted {title}." and the processing message, and that error banners are `role="alert"`.
  - **ARIA snapshots** (`toMatchAriaSnapshot`) of the list, a card and the dialog, to catch a renamed button or a lost `aria-pressed`, which axe cannot see.
  - **Reduced motion.** Emulate `prefers-reduced-motion: reduce` and assert the dialog fades instead of popping and the leave animation is skipped or shortened.
  - **Reflow and zoom.** Check 320px width (the WCAG reflow minimum) and 200% zoom for horizontal scroll, ideally with worst-case content: a 120-character title, a 300-character item, an unbroken string, 30 items.
  - **Focus visibility.** Axe does not check that a focus ring exists (WCAG 2.4.7). Add screenshots of the focused input, button, status segment and dialog buttons.
  - **Form wiring.** After an error, `aria-invalid` is true, `aria-describedby` points at the hint, and the banner is exposed to assistive technology.
  - **Smaller checks:** touch targets of at least 24px (WCAG 2.5.8), one `h1` per page, and axe scans of `app/error.tsx` and the 404 page.
- **Internationalization:** all copy is hardcoded English; dates use a fixed format.
- **Optimistic status changes** roll back on failure but give no toast or message explaining why.
- **No offline handling or retry UI** for network failures between the browser and the API.

## Added scope (features beyond the brief)
Useful, but not asked for, so deliberately not built. Anything here is a separate decision, not a gap in the current spec.
- Edit, add and delete action items; rename a meeting; undo a delete.
- Search, filter (by status) and sort across meetings.
- Due dates, priorities, assignees linked to real people, reminders.
- Pagination or infinite scroll for the meeting list.
- Re-run extraction on a saved meeting, or compare results across models.
- Export (CSV, Markdown) or sharing a meeting by link.
- Realtime updates when several people use the app, and comments on items.
- Importing notes from files, calendar events or transcripts.
- Accounts, workspaces and permissions (see Access control).

## Documentation
- **The design is simulated in a private artifact.** If it moves or is deleted, the written design summary in the spec is the only record. Consider adding screenshots to the repo.
