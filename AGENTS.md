# AGENTS.md — Laluan (Hoo Lee Sheet, SDC Hackathon 2026)

## What it is
Laluan reads a CV, asks up to five interview questions, and shows AI exposure of the current job, future-fit roles under three scenarios, skill gaps and a local course plan. SDC Hackathon 2026, Domain 1, SDG 8 (primary).

## Stack
- Next.js 16.4.2 (App Router, TypeScript, `src/`), React 19.3, Tailwind + shadcn/ui (`components.json`), Node >= 24 (`.nvmrc`)
- Vercel AI SDK (`ai` 7, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`)
- Supabase (`@supabase/supabase-js`; schema + migrations in `supabase/`)
- Tests: Vitest (`npm test`); KPI script `npm run kpi`

## Run locally
```
npm ci                      # needed in every new worktree
cp .env.example .env.local  # fill values; never commit
npm run dev                 # http://localhost:3000
npm run lint && npm run typecheck && npm test && npm run build
```
Env var names: AI_PROVIDER, AI_MODEL, GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY, AI_MOCK, SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RUNPOD_BASE_URL, RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID, AI_INTEGRATIONS_ANTHROPIC_API_KEY, AI_INTEGRATIONS_ANTHROPIC_BASE_URL, KRACKEDDEVS_API_KEY, KRACKEDDEVS_BASE_URL, KRACKEDDEVS_MODEL, ARXIV_REFRESH_BUDGET_MS, TREND_SNAPSHOT_FILE. Prod also sets TREND_REFRESH_LOCKED=1.

## Deploy
- Replit (official submission, primary): Autoscale per `.replit` (`npm ci && npm run build`, then `npm run start` on 0.0.0.0:3000). Keys live in Replit Secrets.
- Vercel (backup): project `laluan`, team "Hoo Lee Sheet". NOT git-linked; deploy manually (TODO: confirm exact command, e.g. `vercel deploy --prod --scope hoo-lee-sheet`). Send Bing Jie the runnable link after each merged update.
- Supabase: org "Hoo Lee Sheet" (TODO: confirm project ref).

## Live URLs
- https://hoo-lee-sheet-sdc-2026.replit.app (primary, used for finals verification)
- https://laluan.vercel.app (backup)

## Gotchas
- Never POST /api/refresh-signals in prod; don't edit trend fields in `data/keywords.csv` or `src/data/catalogue.json`.
- `tsc` shows a LayoutProps error until `npm run build` has run once.
- `src/lib/signals.ts` is server-only; scripts use `src/lib/kpi-signals.ts`.
- UI text EN/BM only; tests fail on Chinese characters and on EN/BM mismatch.
- Never change demo numbers (Pravin, Aisyah, Jia Hui personas). KPI rules: real course data only, no loosening definitions.
- One branch + one PR per task, with before/after screenshots; merges need Tiffany's or Henry's Approve, and Bing Jie confirms. Force-push/history rewrite only with Bing Jie's own approval.
- README is partly out of date on scoring; trust code.
- Git author: Bing Jie Tan <tanbingjie99@gmail.com>.

## Owner
Peter · SWE (coding bot) for Bing Jie Tan. Progress: /home/box/shared-rules/tasks/sdc-finals-upgrade.md

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
