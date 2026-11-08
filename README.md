# TL;DA - Too long; do actions.

Paste meeting notes, an LLM pulls out the action items, and they are saved on a meeting. Each item can be open, in progress or done. Then ask about your meetings ("What's still open?", "What did we decide about pricing?") and get a short answer with the meetings it came from. Runs locally, no login.

## How it works

- **Extracting action items.** One LLM call in JSON mode. The reply is validated with zod and saved only if it is a clean list of items; prose, bad JSON or an empty list is rejected and nothing is written.
- **Asking.** A small read-only agent: the model calls tools (`search_items`, `list_meetings`, `get_meeting`) in a loop, at most 5 turns within 30 seconds, then answers in plain text. No tool writes anything and raw notes never reach the model, so a confused or prompt-injected model can at worst give a wrong answer. The "Based on" meetings are collected by the server from the tool results, not taken from the model's text. Questions that aren't about the meetings are declined (prompt guidance, not a guarantee).
- **Logging.** Every extraction and ask is logged with latency, tokens and, on failure, the raw input and LLM response.

## How it was built

Built with Claude Code. I wrote [SPEC.md](SPEC.md) (product, architecture, validation and test plan) and [CLAUDE.md](CLAUDE.md) (code rules the agent follows) first, then built it step by step against them. [CONCERNS.md](CONCERNS.md) lists known concerns and possible future work.

## Run it

Needs Node 22.12 or newer (built on Node 24).

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:3000.

The default `.env` uses a mock LLM (it extracts lines that sound like tasks and gives a fixed answer to questions), so it works with no API key. The SQLite file (`data/tlda.db`) is created on the first request.

## Use the real LLM (Gemini)

Get a free key from [Google AI Studio](https://aistudio.google.com/) and set in `.env`:

```
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash-lite
LLM_API_KEY=your-key
```

Restart `npm run dev` after changing `.env`. With thinking set to minimal (in `integrations/providers/GeminiProvider.ts`), `gemini-3.5-flash-lite` extracts in about 1 second; a question takes several seconds, since it needs 2 to 3 model turns.

## Use Claude instead

Get a key from the [Claude Console](https://platform.claude.com/) and set in `.env`:

```
LLM_PROVIDER=claude
LLM_MODEL=claude-opus-5-5
LLM_API_KEY=your-key
```

`claude-haiku-5-5` is the faster, cheaper option. Current Claude models can't turn thinking off, so `integrations/providers/ClaudeProvider.ts` sends effort `low` and no temperature (both rejected or replaced on these models). It uses the official `@anthropic-ai/sdk` with retries off.

## Swap providers

A provider is one class extending `LlmProvider` in `integrations/providers/`, one entry in `PROVIDER_FACTORIES` (`integrations/index.ts`) and one value in `LLM_PROVIDERS` (`lib/server/env.ts`).

## Other commands

```bash
npm test                     # tests (use the mock provider)
npm run test:browser         # browser tests: screenshots, axe and UI behavior (Playwright, Chromium)
npm run test:browser:update  # regenerate the screenshot baselines
npm run lint                 # ESLint
npm run build                # production build, then: npm start
```

## Browser tests

`npm run test:browser` builds the app, starts it on port 3100 with the mock LLM and a throwaway database (`data/browser.db`, wiped on each run), and runs the Playwright specs in `tests/browser/` at desktop (1280px) and mobile (390px) widths: screenshot comparisons, axe scans, keyboard checks and UI behavior. Some specs stub API responses to reach error and pending states. The first run needs a browser: `npx playwright install chromium`.

- Baselines are committed next to the specs and are Chromium on macOS only (`*-darwin.png`). On another OS, run `npm run test:browser:update` first and review the new images.
- After an intended UI change, run `npm run test:browser:update` and check the changed images before committing.

## Notes

- Known gaps and skipped work are listed in [CONCERNS.md](CONCERNS.md). The full spec is in [SPEC.md](SPEC.md).

