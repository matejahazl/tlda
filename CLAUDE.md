# TL;DA - "Too long; do actions."

Meeting notes go in, an LLM extracts action items, and they're stored on a meeting with a status (open / in progress / done). Keep it simple, correct and well-validated.

The product and architecture spec is imported below. Known concerns and deliberately skipped work are in `CONCERNS.md`.

@SPEC.md

## Code rules
Apply these from the start, without waiting to be asked.

Accessibility and markup
- Always keep accessibility in mind, proactively. Any link with `target="_blank"` must have an `aria-label` (or equivalent accessible name) that describes what it does and states that it opens in a new tab.
- Avoid `z-index`; use correct HTML source order instead.
- Avoid `absolute` positioning except as a last resort, where nothing else (flex/grid, gap, source order) achieves the result.
- Don't wrap an element in extra `div`s just to carry styling/positioning/animation classes when those can go on the element itself or an existing ancestor. Each wrapper must earn its place (for example, it needs its own stacking or positioning context).
- Never hardcode uppercase text (e.g. `"GITHUB"`) for visual styling. Write copy in natural case and apply `uppercase` through a CSS class, so semantics, screen readers and copy-paste stay correct.

Tailwind and CSS
- Prefer `size-` over separate `w-`/`h-` classes when width and height are equal (`size-[64px]`, not `w-[64px] h-[64px]`).
- Write spacing and sizing as explicit px values, not Tailwind's numeric scale: `p-[24px]`, `gap-[12px]`, `min-h-[48px]`, `size-[16px]`, `rounded-[12px]`, `border-[2px]`, `translate-y-[2px]`. This covers padding, margin, gap, width, height, min/max sizes, border width, border radius and translate offsets, so the markup matches the design's pixel values. Keywords, zero and fractions (`w-full`, `size-full`, `min-w-0`, `w-1/2`, `rounded-full`), named text styles and theme tokens (`max-w-page`) stay as they are.
- Prefer `gap-` on the parent flex/grid container over `mt-`/`mb-` on a child when the margin only spaces two siblings apart.
- Never use arbitrary text-size/tracking values (e.g. `text-[11px]`, `tracking-[0.08em]`) in markup. Use a named text style defined in `globals.css`; if none fits, add a new named style there and apply that class. Map the design's sizes to named styles (e.g. display title 72px serif, tagline 22px serif, body). Heading elements (`h1`, `h2`, ...) get their default text style in `@layer base`; every other named text style is a plain class in `@layer components`. Don't use `@utility` or `--text-*` theme variables for text styles.
- Never use arbitrary or hardcoded color values (e.g. `text-[#9AA3AD]`, inline hex) in markup. Define the design's colors as tokens in `globals.css` (`@theme`), e.g. `bg`, `card`, `ink`, `muted`, `line`, `accent`, and the status colors for open / in progress / done, and use those.
- Don't add a class to `globals.css` for styling that will reasonably be used in only one place; apply the utilities in that component's `className`. Reserve `globals.css` classes for things shared across components, plus the named text styles, color tokens and keyframe animations required above.
- Animations: register keyframe animations as real Tailwind utilities (`--animate-<name>: <name> <duration> <timing> <iteration>;` in `@theme`, with a plain `@keyframes <name> {...}`) and apply them via `animate-<name>` instead of hand-written `animation: ...`. For conditional styling prefer a flat `@apply` with an inline variant (e.g. `group-hover:opacity-70`) over a nested `@variant` block. Use `@variant` nesting only when a raw non-utility property (e.g. a `calc()`-based `transform`) must share the same condition as a Tailwind utility.
- Follow the motion rules in the design summary in `SPEC.md` (durations, easing, reduced motion).

React and file structure
- Never write an inline `<svg>` in a component's markup. Every icon is its own component file in `app/components/icons/` (PascalCase, e.g. `WarningIcon.tsx`), re-exported from `icons/index.ts`. An icon takes an optional `className` for size and color, draws with `currentColor`, and sets `aria-hidden="true"` itself when it is decorative.
- Name custom component files in PascalCase matching the exported component (e.g. `StatusButtons.tsx` exporting `StatusButtons`).
- Component folders always have an `index.ts` re-exporting their members, so consumers import from the folder.
- In a file with a main exported component and local child components, put the main component at the top and the children below it. Plain helper functions and top-level consts may go above the main component.
- Always type a component's props with a named `type <Component>Props = {...}` above the component, even when it has a single prop. Never type props inline in the function signature. Icons are the one shared exception: they all use `IconProps` from `icons/IconProps.ts`.
- Keep code organized by concern from the start, even while the project is small: types in `types/`, code shared by client and server (zod schemas, error table) in `lib/`, server-only helpers (`withApi`, logger, env, request validation) in `lib/server/`, client-only helpers (`apiClient`, formatting) in `app/lib/`, business logic in `services/` (`MeetingService`), the LLM integration in `integrations/` (interface, providers, `LlmIntegrationService`), DB schema in `lib/server/db/` (queries live in the service that uses them), pure formatting helpers separate from logic, standalone config/data in its own file. Don't wait for clutter or a second consumer before splitting.

Formatting and linting (config in `SPEC.md`)
- Prettier: 4 spaces, no semicolons, double quotes, trailing commas everywhere. Don't hand-format; run `npm run format`.
- Always use braces for `if`/`else`/loops (`curly`), even for one-line bodies.
- Use `import type` for type-only imports. Imports are sorted by `simple-import-sort`; run `npm run lint:fix` rather than reordering by hand.
- Prefix intentionally unused arguments with `_`. Don't shadow variables.
- Tailwind lint rules enforce shorthand (e.g. `size-4` instead of `w-4 h-4`) and forbid contradicting classes; fix the warning rather than silencing it.
- Never silence a rule with `eslint-disable` unless there is no alternative, and then add a short comment saying why.
- Run `npm run lint` before finishing any task.
- Also run the e2e and visual tests (`npm run test:e2e`, Playwright screenshots in `tests/e2e/`) before finishing any task that touches the UI, API or styles. If a screenshot changes on purpose, look at the new image, then run `npm run test:e2e:update` and say which baselines changed. Never update baselines just to make a failing test pass.

General code style
- Module-level constants use `SCREAMING_SNAKE_CASE`, are declared at the top of the file directly after imports, and have a short trailing comment explaining the value, e.g. `const MAX_NOTES_LENGTH = 20000 // max characters accepted for pasted notes`. This covers the validation limits and timeouts in the spec.
- Prefer a data lookup (object/array keyed by the input) over an `if`/`else if` chain when mapping a fixed set of known keys to values (e.g. error code to HTTP status and client message, status to label and color). Keep `if`/`else if` for real conditional logic.
- Never use `dangerouslySetInnerHTML`, and never inject LLM or user text as HTML. Render it as plain React text.
- Never use em dashes anywhere in content or code (copy, aria-labels, comments, docs). Use a hyphen (-) instead.
