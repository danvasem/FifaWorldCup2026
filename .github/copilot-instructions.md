# Copilot Instructions

## Commands

```bash
npm run dev       # Dev server at http://127.0.0.1:5173
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm run test      # Run all Vitest tests (node environment)
```

To run a single test file:
```bash
npx vitest run src/utils/matches.test.js
```

## Architecture

Single-page React 18 app (Vite) that fetches FIFA World Cup 2026 match data from FIFA's public API and displays the last 5 results and next 5 upcoming fixtures.

**Data flow:**
1. `src/services/fifaApi.js` — fetches raw matches from the FIFA API, reads/writes a localStorage cache (`world-cup-2026-match-cache`), and calls `normalizeMatch` to map the raw FIFA response shape to the internal match shape.
2. `src/utils/matches.js` — pure utility functions that operate exclusively on the normalized match shape: `splitMatches` (last 5 completed / next 5 upcoming), date formatters, `formatScore`.
3. `src/App.jsx` — all components live here (`App`, `MatchSection`, `MatchRow`, `Team`). No separate component files.

**Cache strategy:** On load, cached data is shown immediately while a silent background fetch runs. On fetch failure, cached data is kept and a notice is shown. Status values: `"loading"`, `"ready"`, `"cached"`, `"error"`.

## Key Conventions

**Normalized match shape** — `normalizeMatch()` is the single adapter between raw FIFA API data and everything else. Never read raw `IdMatch`, `HomeTeamScore`, etc. outside of `fifaApi.js`. All consumer code (components, utils, tests) works with the normalized shape:
```js
{ id, matchNumber, stage, group, kickoffUtc, venueLocalKickoff, status, isCompleted,
  home: { name, code, flagUrl }, away: { name, code, flagUrl },
  score: { home, away, homePenalty, awayPenalty }, city, stadium }
```

**Match status constants** — `MATCH_STATUS.COMPLETED = 0`, `MATCH_STATUS.SCHEDULED = 1` (numeric values from FIFA API).

**Venue local time** — FIFA's `LocalDate` field sometimes has a trailing `Z` that must be stripped before formatting, or the browser interprets it as UTC. See `formatVenueDateTime` in `matches.js`.

**Flag URLs** — the FIFA API returns template URLs with `{format}-{size}` placeholders; `normalizeFlagUrl` resolves them to `png-s`.

**Tests** — tests live in `src/utils/` alongside the util they test. Only pure utility functions are tested; components are not. Use the `makeMatch` helper pattern from `matches.test.js` when writing new match-related tests (builds a valid normalized match from a minimal fixture via `normalizeMatch`).

**Styling** — single global `src/styles.css` with BEM-like class naming (`.block`, `.block--modifier`, `.block__element`). CSS custom properties for colors are defined on `:root` (e.g., `--pitch`, `--ink`, `--muted`). No CSS modules or CSS-in-JS.

**Icons** — use `lucide-react` exclusively. Always pass `aria-hidden="true"` on decorative icons.

**No TypeScript** — project uses plain `.js`/`.jsx`.
