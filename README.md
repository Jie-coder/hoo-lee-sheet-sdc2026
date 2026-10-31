# Laluan: Hoo Lee Sheet (SDC Hackathon 2026)

> Laluan reads your CV, asks up to five interview questions, and shows how much AI affects your current work, which future roles fit you under three future scenarios, the skills you are missing, and a learning pathway built from real Malaysian courses and government programmes.

---

## Team Information

| Field | Details |
|---|---|
| **Team Name** | Hoo Lee Sheet |
| **Team Domain** | Domain 1: The AiverseCity Future-Ready Workforce Domain |
| **SDG Track (1–17)** | SDG 8 Decent Work and Economic Growth (primary); SDG 4 Quality Education and SDG 10 Reduced Inequalities (secondary) |
| **Team Leader** | Tan Bing Jie |
| **University** | Xiamen University Malaysia (XMUM) |
| **Number of Members** | 3 |

## Links

| Resource | Link |
|---|---|
| GitHub Repository | https://github.com/Jie-coder/hoo-lee-sheet-sdc2026 |
| Live Demo (primary) | https://hoo-lee-sheet-sdc-2026.replit.app (Replit, Autoscale deployment) |
| Backup | https://laluan.vercel.app (Vercel, use only if Replit is down) |
| RunPod Endpoint | Not used |
| Slide Deck | [Laluan Pitch v3 - Hoo Lee Sheet (Canva)](https://canva.link/wpe6f2b0x79mo0l) |
| Demo Video | https://youtu.be/ZLO1yevPaB8 |
| Backup Demo Video | [https://youtu.be/Gx1NboLjquM?si=L-sEC4tFW2_isk1s] |

---

## Overview

### Problem

Workers hear that AI will change their jobs but have no clear view of *how much*
it touches the tasks they actually do, which roles they could move into, and
what to learn next. Generic career advice also ignores Malaysian demand data and
the courses and programmes that are actually available locally, in the
languages people learn in.

### Solution

Laluan uses AI to parse a CV and run a short interview, then matches skills to ESCO, measures AI exposure of the current role, and ranks future roles with deterministic formulas under three WEF-based scenarios. It ends with a learning pathway from real Malaysian courses and government programmes.

### Key Features

1. **CV parsing**: upload a CV (PDF, parsed with `unpdf`); the AI extracts skills and work history into a Zod-validated structure (`src/lib/parse-cv.ts`, `POST /api/parse-cv`).
2. **Short interview**: at most 5 questions (`MAX_INTERVIEW_TURNS = 5`, `src/types/contracts.ts`).
3. **Skill matching** (`src/lib/skill-match.ts`), cheapest tier first:
   exact match against ESCO labels → hand-written synonym list (`src/data/skill-synonyms.json`) → one Gemini embedding call with cosine match against skill embeddings in Supabase. Unmatched skills stay as the raw CV text, flagged `matched: false`, never invented or dropped. Parsed skills are de-duplicated by ESCO id.
4. **AI exposure**: exposure E = sum over tasks of (share of the week × how much AI can do it). High exposure means AI touches a lot of the work, not that the job disappears. Job titles outside the 40 curated roles are mapped via exact title, an alias table (`src/data/role-aliases.json`), then the chat model choosing one of the 40 ids or "none" (`src/lib/exposure-estimate.ts`); the exposure figure is always the matched catalogue role's real value.
5. **3-scenario ranking** (`src/lib/scoring.ts`, `src/lib/rank-roles.ts`; plain deterministic maths, no AI):
   Rank R = 0.5·rankScore + 0.3·Demand + 0.2·(1 − θ·E), plus an SDG bonus (+0.10) when a role's SDG link matches your chosen impact interest. rankScore = Fit × (1 + 0.3·tanh(adoption × roleMomentum)), so the arXiv trend moves a role's score a little up or down; with momentum 0, rankScore equals Fit. R is computed under each of three scenarios (multipliers in `data/scenarios.csv`, cited from WEF reports). A role in the **top 3 of all three scenarios is marked robust**. Skill momentum from arXiv (`ln((recent+1)/(prev+1))`) can raise a skill's importance by up to 30%. All weights live in `SCORING_PARAMS`.
   - **Finals update:** an **AI adoption-speed slider** (0.5×–2×, default 1×, labelled as an estimate) feeds `adoption` above, so the scenario is driven by a parameter applied to the trend signal (#84).
   - **Finals update:** every role has an explainable **score breakdown** (fit, trend boost, demand, exposure, SDG) and a **what-if** list ("+ this skill" re-runs the full analysis). The card's Fit is calibrated as min(100%, raw fit ÷ 0.30) and the drawer shows the raw fit and the role's skill-match rank (#86).
6. **Tickets**: how the results are chosen:
   - Each of the 3 futures (scenarios) takes its **top 3 roles** by R.
   - A role is **robust** only if it is in the top 3 of **all three** futures.
   - The tickets are the **distinct roles across those three top-3 lists**, so the number of tickets varies by CV (from 3, when all three futures agree, up to 9).
   - Each ticket shows why the role ranked, the top 5 skill gaps, SDG badges and source chips; switching scenario re-ranks them.
7. **Pathway**: a learning pathway that closes the skill gaps using courses and government programmes (`src/lib/pathway.ts`, `/pathway`). Finals update: the pathway shows an **SDG total for this pathway** (`src/lib/sdg-total.ts`, #87), and a stop that directly teaches a gap skill is labelled "Covers" (#93).
8. **Course recommendations in EN / BM / ZH**: courses are tagged with languages `en`, `ms`, `zh`; the user can select several.
9. **SDG preference**: the user picks an impact interest; matching roles get the SDG bonus (`occupation_sdg.csv`). Finals update: skills are also tagged through their ESCO skill group (`data/skill_group_sdg.csv`, one target and a one-line reason per group, #87 and #92). Today 40/40 roles and 379/854 skills (44.4%) carry an SDG target; the other 475 skills sit in generic groups (e.g. teamwork, sales, clerical, management) that we left untagged rather than guess.

10. **Certificate verification** (#103): users can mark pathway courses done and verify a certificate. The AI certificate check (`POST /api/verify-certificate`) fetches the certificate URL the user enters and sends the page text to the model; results are kept only in the browser (localStorage). For product demos, `https://demo.laluan.app/example-certificate` always shows verified, labelled "Demo certificate link (product demonstration only)."; every other link gets the normal check (#105, see [`docs/programme-proof.md`](docs/programme-proof.md)).
11. **Download PDF ticket** (#104): the pathway and role ticket can be saved as a PDF.

Other pages: `/partner`, `/exposure`, `/radar`, `/data-sources`, `/privacy`, `/about`, `/status`.

### Be Our Partner

Be Our Partner (#106) is Laluan's planned business model: training providers pay for clearly labelled visibility on relevant pathways. **Paying buys visibility, not ranking.** Role ranking (fit 50% + demand 30% + AI-exposure resilience 20% + SDG bonus; the arXiv trend only nudges fit) never reads sponsorship data. Sponsored course cards are capped at 3 per pathway and 1 per stop, appear after the free or government course for that stop, show a free alternative, and carry a "Sponsored" / "Ditaja" tag with a "Why am I seeing this?" note. They are excluded from stops, weeks, progress and the certificate, and hidden in the PDF ticket. The [`/partner`](https://hoo-lee-sheet-sdc-2026.replit.app/partner) page lists the tiers (RM 0.80 per click, RM 25 per enrolment, RM 1,500 per month) with a front-end-only enquiry form. Partner names, badges, ratings and prices are fictional, for demonstration only. Skill-gap insights are future work and would be opt-in and anonymised.

### Tech Stack

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

### How AI is used

Provider selection is in [`src/lib/ai.ts`](./src/lib/ai.ts) (`getModel()`):

- **Replit (main):** when `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` are set (Replit AI Integrations), the app uses **Claude Haiku** (`claude-haiku-4-5`).
- **Vercel (backup) / fallback:** **Google Gemini** (default `gemini-3.8-flash`, overridable with `AI_MODEL`).
- **Embeddings:** Gemini `gemini-embedding-001`, 768 dimensions (skill matching and precompute scripts).
- **Mock mode:** `AI_MOCK=true` returns fixtures instead of calling any provider.
- **CV parse:** CV parse uses KrackedDevs sponsor OpenAI-compatible credits (LiteLLM); scoring / ranking / pathway stay team formulas. The AI certificate check uses the same endpoint. Model: **`deepseek-v4.1-flash`** via the KrackedDevs LiteLLM endpoint (sponsor credits). Other chat calls stay on `getModel()`.

The scoring and ranking are not AI: they are deterministic formulas so the same input always gives the same output.

### Data sources

From [`data/sources.csv`](./data/sources.csv) (also shown in the app at `/data-sources`). Licences are copied from that file.

| Source | Publisher | Used for | Licence |
|---|---|---|---|
| ESCO | European Commission | Occupations and skills; skill URIs are the canonical skill ids | Free reuse with acknowledgement |
| Custom `laluan:` skills ([`data/custom_skills.csv`](./data/custom_skills.csv)) | Team Hoo Lee Sheet | Skills not in ESCO (e.g. `laluan:manage-ai-chatbots`), each marked "not an ESCO concept" | Apache 2.0 (part of this repo) |
| Anthropic Economic Index | Anthropic | Task AI exposure | CC-BY |
| ILO GenAI Exposure 2025 | ILO | Occupation AI exposure | CC BY 4.0 |
| WEF Future of Jobs Report 2025 | World Economic Forum | Scenario figures, cited one figure at a time with page | © 2025 WEF, all rights reserved (cited, not copied) |
| WEF Four Futures for Jobs 2030 | World Economic Forum | Scenario framing | © WEF, all rights reserved (cited, not copied) |
| OpenDOSM (Labour Force Survey) | DOSM | Malaysian demand | CC BY 4.0 |
| OpenDOSM Salaries & Wages by Occupation | DOSM | Salary by role | CC BY 4.0 |
| arXiv API | Cornell University | Skill momentum signals | CC0 (metadata) |
| GitHub Innovation Graph | GitHub | Trend signal | CC0 |
| OECD.AI | OECD | Trend signal | CC BY 4.0 |
| Stanford AI Index Report | Stanford HAI | Context | CC BY-ND |
| Lightcast Open Skills | Lightcast | Skills reference | Proprietary, free non-profit tier |
| Courses ([`data/courses.csv`](./data/courses.csv)) and government programmes ([`data/programmes.csv`](./data/programmes.csv)) | Various providers, collected by the team | Pathway and course recommendations | See source terms |

**Live trend refresh.** The arXiv counts can be refreshed while the app runs: the Refresh button on `/radar` and `/data-sources` calls `POST /api/refresh-signals` (`GET /api/signals` returns the snapshot in use; code loads it via `getActiveSignals()` in `src/lib/signals.ts`). Each snapshot stores its fetch time, in Supabase table `trend_snapshots` when configured, else a local file. If arXiv is down the last good snapshot stays in use, then the bundled `data/keywords.csv`. `/data-sources` also has a clearly labelled, browser-only "change the data" test panel. `/radar` shows a 95% count-based uncertainty range on each skill's momentum and labels it "Unclear" when the range crosses 0 (display only, not used in the score; see [`docs/trend-uncertainty-band.md`](docs/trend-uncertainty-band.md), #88).

**Finals freeze.** The trend snapshot used for the finals is the live arXiv run fetched on 29 Oct 2026, 16:05:53 (UTC+8) (25/25 keywords re-counted, window 1 Aug–29 Oct 2026). It is also bundled into `src/data/catalogue.json`, so a host without Supabase shows the same numbers. With `TREND_REFRESH_LOCKED=1`, `POST /api/refresh-signals` returns 423 and the Refresh button reads "Snapshot frozen for finals" (#91).

40 curated occupations are in [`data/occupations.csv`](./data/occupations.csv). See [`data/README.md`](./data/README.md) for the CSV spec and licensing rules. Demo CVs in `demo/cv/` are synthetic and clearly marked.

### Privacy

No login; CV files are not stored. Browsers can only read catalogue tables; user sessions are server-only (Supabase RLS).

---

## Project Structure

```
.
├── data/                 # CSV datasets + spec (data/README.md)
├── demo/cv/              # synthetic demo CVs
├── docs/                 # progress, tasks, personas, design
├── public/               # static assets (brand)
├── runpod/
│   └── handler.py        # unused stub (RunPod not used in the prototype)
├── scripts/              # data import, catalogue build, fetchers, precompute
├── src/
│   ├── app/              # Next.js pages and API routes
│   ├── components/       # UI components (tests alongside as *.test.tsx)
│   ├── data/             # generated catalogue, aliases, synonyms
│   ├── fixtures/         # mock AI responses
│   └── lib/              # ai, parse-cv, skill-match, scoring, rank-roles, pathway, exposure
├── submission/
│   ├── SDC2026_Hoo_Lee_Sheet_Preliminary.pdf
│   ├── SDC2026_Hoo_Lee_Sheet_TechDeclaration.pdf
│   └── SDC2026_Hoo_Lee_Sheet_Replit_POU.pdf
├── supabase/             # migrations (12 tables, pgvector, RLS)
├── .env.example
├── .replit               # Replit run + Autoscale deployment config
├── DECLARATION.md
├── LICENSE
├── package.json
└── README.md
```

### Architecture

```
User ──► Next.js app on Replit (pages + API routes)
              │
              ├──► Replit AI Integrations: Anthropic claude-haiku-4-5 (chat)
              ├──► Google Gemini: gemini-embedding-001 (embeddings)
              ├──► Supabase (Postgres + pgvector, server-side only)
              └──► Deterministic scoring / ranking ──► results + pathway

Backup: same app on Vercel, using Gemini (gemini-3.8-flash) for chat.
```

---

## How to Run

### Option 1: Run on Replit (Recommended)

1. Import this repository via **Create Repl → Import from GitHub**.
2. Add the variables from `.env.example` in the **Secrets** tab (Replit AI Integrations supplies `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`).
3. Click **Run**. `.replit` runs `npm install && npm run dev` on port 3000. Publishing uses the Autoscale deployment (`npm ci && npm run build`, then `npm run start`).

### Option 2: Run Locally

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
| `AI_PROVIDER` | `google` (default); the `runpod` value belongs to the unused RunPod stub |
| `AI_MODEL` | Optional model override |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key |
| `AI_MOCK` | `true` returns fixtures, no AI calls |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key |
| `RUNPOD_BASE_URL`, `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Unused stub (RunPod not used); leave empty |
| `GEMINI_API_KEY` | Used by `scripts/import-data.ts --apply` |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Replit AI Integrations (Claude Haiku) |
| `KRACKEDDEVS_API_KEY` | CV parse only. Set on Replit Secrets (primary demo) and Vercel env (backup). Empty keeps today's `getModel()` fallback. |
| `KRACKEDDEVS_BASE_URL` | Optional OpenAI-compatible base URL for CV parse. Empty uses the KrackedDevs LiteLLM default. |
| `KRACKEDDEVS_MODEL` | Optional model id for CV parse. Empty uses `deepseek-v4.1-flash`. |
| `TREND_SNAPSHOT_FILE` | Optional local file for trend snapshots when Supabase is not configured |
| `TREND_REFRESH_LOCKED`, `TREND_REFRESH_KEY` | Optional. `TREND_REFRESH_LOCKED=1` freezes the trend snapshot (refresh returns 423). `TREND_REFRESH_KEY` would let a refresh through with the `x-refresh-key` header; it is not set in the finals deployments, so there is no bypass during judging. |

Never commit `.env.local` or any key. On Replit, keys go in **Secrets**.

### Scripts

| Command | What it does |
|---|---|
| `npm test` | Run the Vitest suite (`vitest run`) |
| `npm run lint` / `npm run typecheck` / `npm run build` | Checks and production build |
| `npm run import-data` | Validate `data/*.csv`; `--apply` writes to Supabase with embeddings |
| `npm run build-catalogue` | Build `src/data/catalogue.json` from the CSVs |
| `npm run precompute-demo-cvs`, `npm run precompute-role-embeddings` | Precompute demo results and role embeddings |
| `npm run kpi` | Measure the Phase 1 KPIs from the repo's own code and data (no AI, no network); writes [`kpi/kpi-report.md`](kpi/kpi-report.md) and `kpi/kpi-report.json` (#90). The script still leaves KPI4 as a placeholder. The committed KPI4 block is Tiffany's 31 Oct 2026 stopwatch and has to be copied back if the script is re-run. |

### Run Tests

```bash
npm test
```

At `72c1b14` (main), 756 tests pass.

---

## How We Use Replit *(Required)*

- **Hosting:** the main deployment is on Replit at the Live Demo link, as an **Autoscale** deployment configured in `.replit`.
- **AI:** Replit AI Integrations provide Anthropic **`claude-haiku-4-5`** for the chat model in production. CV parse uses KrackedDevs sponsor OpenAI-compatible credits (LiteLLM); scoring / ranking / pathway stay team formulas.
- **Secrets:** keys are stored in Replit Secrets, never in the code.

📄 Proof of use: [`submission/SDC2026_Hoo_Lee_Sheet_Replit_POU.pdf`](submission/SDC2026_Hoo_Lee_Sheet_Replit_POU.pdf)

## How We Use RunPod *(Required)*

RunPod was **not used** in this prototype. Inference uses Replit AI Integrations (Anthropic `claude-haiku-4-5`) on Replit, and Google Gemini (`gemini-3.8-flash` as fallback and on the Vercel backup, `gemini-embedding-001` for embeddings). [`runpod/handler.py`](runpod/handler.py) is an unused stub.

---

## Challenges & Learnings

- **Keeping results explainable:** AI is limited to CV parsing, the interview and title mapping; scoring and ranking are deterministic formulas so the same input always gives the same output.
- **Not inventing data:** unmatched skills stay as raw CV text flagged `matched: false`, and every figure links to a source with its licence.
- **Cost-aware matching:** skill matching tries exact ESCO labels and a synonym list before a single embedding call.

### AI tools used in development

- **Development:** Grok (AI agents), Claude Code, OpenCode and Cursor helped write code and docs. The team reviewed all changes through pull requests.
- **In the product:** Claude Haiku 4.5 (`claude-haiku-4-5`, via Replit AI Integrations on Replit), Gemini (`gemini-3.8-flash`, on Vercel and as default), `gemini-embedding-001` (embeddings) and `deepseek-v4.1-flash` via KrackedDevs LiteLLM (CV parse and certificate check).

### Pre-existing code

This repo starts from our declared starter (`Jie-coder/sdc-starter`, tag `starter-v0`, commit `57171fe`, rule 8.2). See [`DECLARATION.md`](./DECLARATION.md).

## Future Improvements

1. **Live salary and job data**: replace the manually checked JobStreet salaries with scheduled automatic updates, and add newer DOSM releases.
2. **More roles and Bahasa Malaysia**: expand beyond the current 40 roles and add a Bahasa Malaysia interface to reach more users.
3. **Real-user validation**: test with real users to validate pathway gap coverage and SDG mapping accuracy, replacing the three synthetic personas. Time to a finished pathway was measured on 31 Oct 2026 by Tiffany (stopwatch, https://hoo-lee-sheet-sdc-2026.replit.app, upload or start analyze → pathway page ready): Aisyah sample 32.84 s, Jia Hui sample 26.58 s, Pravin sample 28 s, Henry resume upload 48 s, all under 3 minutes. The two-person SDG hand-check is still not measured (`kpi/sdg-handcheck-50.csv`, 0/45 rated). Skill SDG tagging is at 44.4% (379/854), below our 100% target.
4. **Trend uncertainty in the rank score**: the 95% momentum band on /radar could later be propagated through role momentum into the rank score, so the trend part of a score shows a ± range. Today the band is shown on /radar only.

## Team

| Name | Role | GitHub |
|---|---|---|
| Tan Bing Jie | Team Leader & Developer | [@Jie-coder](https://github.com/Jie-coder) |
| Henry Wong Yi Siang | Design Research & Data (Spreadsheet) | [@henrywwawesome-wq](https://github.com/henrywwawesome-wq) |
| Tiffany Yek Sii Chee | Video Production & Course Research | [@Tiffany06yek](https://github.com/Tiffany06yek) |

---

## Submission Checklist

- [x] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [x] Slide deck link added
- [x] Demo video link added
- [x] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [x] Preliminary submission completed (`SDC2026_Hoo_Lee_Sheet_Preliminary.pdf`)
- [x] Technology declaration completed (`SDC2026_Hoo_Lee_Sheet_TechDeclaration.pdf`)
- [x] Submission files renamed with your team name (replace `TeamName`)
- [x] "How to Run" steps verified
- [x] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE). Third-party data keeps its own licence (see Data sources).
