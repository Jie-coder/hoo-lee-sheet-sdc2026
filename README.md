# Laluan: Hoo Lee Sheet (SDC Hackathon 2026)

> Laluan reads your CV, asks up to five interview questions, and shows how much AI affects your current work, which future roles fit you under three future scenarios, the skills you are missing, and a learning pathway built from real Malaysian courses and government programmes.

Team **Hoo Lee Sheet** · SDC Hackathon 2026 · **Domain 1: Aiversecity Future-Ready Workforce**

## Links

| Resource | Link |
|---|---|
| Live app (main, Replit) | https://hoo-lee-sheet-sdc-2026.replit.app |
| Backup (Vercel) | https://laluan.vercel.app |
| GitHub repository | https://github.com/Jie-coder/hoo-lee-sheet-sdc2026 |

## The problem

Workers hear that AI will change their jobs but have no clear view of *how much*
it touches the tasks they actually do, which roles they could move into, and
what to learn next. Generic career advice also ignores Malaysian demand data and
the courses and programmes that are actually available locally, in the
languages people learn in.

## What Laluan does

1. **CV parsing**: upload a CV (PDF, parsed with `unpdf`); the AI extracts skills and work history into a Zod-validated structure (`src/lib/parse-cv.ts`, `POST /api/parse-cv`).
2. **Short interview**: at most 5 questions (`MAX_INTERVIEW_TURNS = 5`, `src/types/contracts.ts`).
3. **Skill matching** (`src/lib/skill-match.ts`), cheapest tier first:
   exact match against ESCO labels → hand-written synonym list (`src/data/skill-synonyms.json`) → one Gemini embedding call with cosine match against skill embeddings in Supabase. Unmatched skills stay as the raw CV text, flagged `matched: false`, never invented or dropped. Parsed skills are de-duplicated by ESCO id.
4. **AI exposure**: exposure E = sum over tasks of (share of the week × how much AI can do it). High exposure means AI touches a lot of the work, not that the job disappears. Job titles outside the 40 curated roles are mapped via exact title, an alias table (`src/data/role-aliases.json`), then the chat model choosing one of the 40 ids or "none" (`src/lib/exposure-estimate.ts`); the exposure figure is always the matched catalogue role's real value.
5. **3-scenario ranking** (`src/lib/scoring.ts`, `src/lib/rank-roles.ts`; plain deterministic maths, no AI):
   Rank R = 0.5·Fit + 0.3·Demand + 0.2·(1 − θ·E), plus an SDG bonus when a role's SDG link matches your chosen impact interest. R is computed under each of three scenarios (multipliers in `data/scenarios.csv`, cited from WEF reports). A role in the **top 3 of all three scenarios is marked robust**. Skill momentum from arXiv (`ln((recent+1)/(prev+1))`) can raise a skill's importance by up to 30%. All weights live in `SCORING_PARAMS`.
6. **Tickets**: each recommended role is shown as a "ticket" on the results page, with why it ranked, the skill gaps (top 5), SDG badges and source chips; switching scenario re-ranks the tickets.
7. **Pathway**: a learning pathway that closes the skill gaps using courses and government programmes (`src/lib/pathway.ts`, `/pathway`).
8. **Course recommendations in EN / BM / ZH**: courses are tagged with languages `en`, `ms`, `zh`; the user can select several.
9. **SDG preference**: the user picks an impact interest; matching roles get the SDG bonus (`occupation_sdg.csv`).

Other pages: `/exposure`, `/radar`, `/data-sources`, `/privacy`, `/about`, `/status`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Base UI, framer-motion, lucide-react, sonner |
| Backend | Next.js API routes (server-only): `analyze`, `parse-cv`, `exposure-estimate`, `roles`, `health`, `items` |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`) |
| Validation | Zod |
| Database | Supabase (Postgres + pgvector, 768-dim HNSW indexes), server-side only |
| PDF | unpdf |
| Tests | Vitest, Testing Library, jsdom |
| Hosting | Replit (main, Autoscale) and Vercel (backup) |
| Runtime | Node.js ≥ 24 |

## How AI is used

Provider selection is in [`src/lib/ai.ts`](./src/lib/ai.ts) (`getModel()`):

- **Replit (main):** when `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` are set (Replit AI Integrations), the app uses **Claude Haiku** (`claude-haiku-4-5`), regardless of `AI_PROVIDER`.
- **Vercel (backup) / default:** **Google Gemini** (default `gemini-3.8-flash`, overridable with `AI_MODEL`).
- **Optional:** a self-hosted model on RunPod (vLLM, OpenAI-compatible) when `AI_PROVIDER=runpod`.
- **Embeddings:** always Gemini `gemini-embedding-001`, 768 dimensions (skill matching and precompute scripts).
- **Mock mode:** `AI_MOCK=true` returns fixtures instead of calling any provider.

The scoring and ranking are not AI: they are deterministic formulas so the same input always gives the same output.

## Data sources

Listed in [`data/sources.csv`](./data/sources.csv) and shown in the app at `/data-sources`:

- **ESCO** (European Commission): occupations and skills; skill URIs are the canonical skill ids.
- **Custom `laluan:` skills** ([`data/custom_skills.csv`](./data/custom_skills.csv)): skills not in ESCO (e.g. `laluan:manage-ai-chatbots`), each marked "Laluan custom skill, not an ESCO concept".
- **Anthropic Economic Index** and **ILO GenAI Exposure 2025**: task exposure.
- **WEF Future of Jobs Report 2025** and **WEF Four Futures for Jobs 2030**: scenario figures, cited one figure at a time with page.
- **OpenDOSM** (labour force, and Salaries & Wages by Occupation): Malaysian demand and salary.
- **arXiv API**: skill momentum signals.
- Also listed: Stanford AI Index, OECD.AI, GitHub Innovation Graph, Lightcast Open Skills.
- Courses (`data/courses.csv`) and government programmes (`data/programmes.csv`), collected by the team; 40 curated occupations (`data/occupations.csv`).

See [`data/README.md`](./data/README.md) for the CSV spec and licensing rules. Demo CVs in `demo/cv/` are synthetic and clearly marked.

## Run locally

Prerequisites: Node.js 24 (see `.nvmrc`) and git.

```bash
git clone https://github.com/Jie-coder/hoo-lee-sheet-sdc2026.git
cd hoo-lee-sheet-sdc2026
npm ci
cp .env.example .env.local   # fill in your own values; set AI_MOCK=true if you have no keys
npm run dev                  # http://localhost:3000
```

### Environment variables (names only; see `.env.example`)

| Name | Purpose |
|---|---|
| `AI_PROVIDER` | `google` (default) or `runpod` |
| `AI_MODEL` | Optional model override (required for RunPod) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key |
| `AI_MOCK` | `true` returns fixtures, no AI calls |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key |
| `RUNPOD_BASE_URL`, `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Optional RunPod |
| `GEMINI_API_KEY` | Used by `scripts/import-data.ts --apply` |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Replit AI Integrations (Claude Haiku) |

Never commit `.env.local` or any key. On Replit, keys go in **Secrets**.

### Scripts

| Command | What it does |
|---|---|
| `npm test` | Run the Vitest suite (`vitest run`) |
| `npm run lint` / `npm run typecheck` / `npm run build` | Checks and production build |
| `npm run import-data` | Validate `data/*.csv`; `--apply` writes to Supabase with embeddings |
| `npm run build-catalogue` | Build `src/data/catalogue.json` from the CSVs |
| `npm run precompute-demo-cvs`, `npm run precompute-role-embeddings` | Precompute demo results and role embeddings |

### Deploy

- **Replit:** the repo's `.replit` runs `next dev` on port 3000 and deploys as Autoscale (`npm ci && npm run build`, then `npm run start`).
- **Vercel:** standard Next.js deployment, Gemini provider.

## Project structure

```
data/          CSV datasets + spec (data/README.md)
demo/cv/       synthetic demo CVs
docs/          progress, tasks, personas, design
runpod/        optional RunPod handler
scripts/       data import, catalogue build, fetchers, precompute
src/app/       pages and API routes
src/components UI components
src/lib/       ai, parse-cv, skill-match, scoring, rank-roles, pathway, exposure
src/data/      generated catalogue, aliases, synonyms
supabase/      migrations (12 tables, pgvector, RLS)
submission/    official submission documents
```

## Privacy

No login; CV files are not stored. Browsers can only read catalogue tables; user sessions are server-only (Supabase RLS).

## Pre-existing code

This repo starts from our declared starter (`Jie-coder/sdc-starter`, tag `starter-v0`, commit `57171fe`, rule 8.2). See [`DECLARATION.md`](./DECLARATION.md).

## Team: Hoo Lee Sheet

| Name | GitHub |
|---|---|
| Bing Jie Tan | [@Jie-coder](https://github.com/Jie-coder) |
| Henry | [@henrywwawesome-wq](https://github.com/henrywwawesome-wq) |
| Tiffany | [@Tiffany06yek](https://github.com/Tiffany06yek) |

## License

[Apache License 2.0](LICENSE).
