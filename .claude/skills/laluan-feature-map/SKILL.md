---
name: laluan-feature-map
description: Map of every Laluan page, how a user reaches it, which elements to click (data-testid), keyboard shortcuts and expected results, plus Playwright scripts to drive the app. Use before reproducing a UI bug, verifying a UI change, writing an end-to-end test, or answering "where is feature X / how do I get to page Y" in this repo.
---

# Laluan feature map (agent skill)

This folder is "materialized memory" for agents: instead of re-reading every
component each time, read the map first, then drive the real app.

## Files

| File | Who writes it | What it is |
| --- | --- | --- |
| `feature-map.md` | humans | Every page: route, steps to reach it, selectors, keys, expected result |
| `routes.generated.json` | `generate.ts` | Routes, `data-testid`s and links found in `src/app` + `src/components` |
| `feature-map.mmd` / `feature-map.png` | `generate.ts` | Mermaid navigation graph and its picture |

## When to use

- You need to know which page or component owns a feature: search `feature-map.md`.
- You must reproduce a bug or prove a UI change works: run a flow (below) and
  look at the screenshots / trace.
- You added or renamed a page or a `data-testid`: update `feature-map.md`,
  then `npm run feature-map:render`. CI runs `npm run feature-map:check`.

## How to drive the app

```bash
npm run build && npm start              # app on http://localhost:3000 (or use npm run dev)
npm run feature-map:drive -- --list     # list flows (scripts/feature-map/flows.ts)
npm run feature-map:drive -- full-journey
npm run feature-map:drive -- radar --url https://laluan.vercel.app --headed
npx playwright show-trace artifacts/feature-map/<run>/trace.zip
```

Output (screenshots, `FAILED.png` on failure, `trace.zip`) goes to
`artifacts/feature-map/` which is git-ignored. First time only:
`npx playwright install chromium`.

Selector rules: prefer `page.getByTestId("...")`; otherwise
`getByRole(role, { name })`. Ids ending in `*` are families,
e.g. `persona-card-aisyah`.

Flow state (consent, profile, answers) lives in the browser, so run a whole
flow in one page; deep-linking straight to `/results` without a profile shows
an empty/redirect state.
