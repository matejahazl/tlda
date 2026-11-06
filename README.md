# TL;DA - Too long; do actions.

Paste meeting notes, an LLM pulls out the action items, and they are saved on a meeting. Each item can be open, in progress or done. Runs locally, no login.

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

The default `.env` uses a mock extractor, so it works with no API key. The SQLite file (`data/tlda.db`) is created on the first request.

## Use the real LLM (Gemini)

Get a free key from [Google AI Studio](https://aistudio.google.com/) and set in `.env`:

```
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash-lite
LLM_API_KEY=your-key
```

Restart `npm run dev` after changing `.env`. `gemini-3.5-flash-lite` answers in about 1 second with thinking set to minimal (set in `integrations/providers/GeminiProvider.ts`).

## Other commands

```bash
npm test          # tests (use the mock provider)
npm run test:e2e            # end-to-end screenshot tests (Playwright, Chromium)
npm run test:e2e:update  # regenerate the screenshot baselines
npm run lint      # ESLint
npm run build     # production build, then: npm start
```

## End-to-end tests

`npm run test:e2e` builds the app, starts it on port 3100 with the mock LLM and a throwaway database (`data/e2e.db`, wiped on each run), and compares screenshots in `tests/e2e/` at desktop (1280px) and mobile (390px) widths. The first run needs a browser: `npx playwright install chromium`.

- Baselines are committed next to the specs and are Chromium on macOS only (`*-darwin.png`). On another OS, run `npm run test:e2e:update` first and review the new images.
- After an intended UI change, run `npm run test:e2e:update` and check the changed images before committing.

## Upcoming: ask about your meetings

A question box ("What's still open?", "What did we decide about pricing?") answered by a small agent. The model calls read-only tools (search items, list meetings, get one meeting) in a loop, at most 5 turns within 30 seconds, and answers in plain text with the meetings it used. It can't change anything. The design and the build plan are in [SPEC.md](SPEC.md) under "Ask about your meetings"; its known limits are in [CONCERNS.md](CONCERNS.md) under "Ask agent".

## Notes

- Known gaps and skipped work are listed in [CONCERNS.md](CONCERNS.md). The full spec is in [SPEC.md](SPEC.md).

