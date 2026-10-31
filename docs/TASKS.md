# Laluan: tasks to do

Each task lists who does it, the tools, the steps, and how we know it's done. Code is written by Jarvis using **Claude Code** on the shared computer, then reviewed and merged by Peter. Every tool used must also be in the Tools & AI declaration (Emily).

## Ground rules (every task)
- **Free plans only** (handbook rule 8.1).
- **Secrets never go in git, chats or docs.** They go in `.env.local` (shared computer, ignored by git), **Replit Secrets**, or Vercel env vars.
- Every change goes through a **pull request** on GitHub: `npm test`, `npm run lint` and `npm run build` must pass before merge.
- Anyone on the team must be able to explain the code to judges (rule 8.5), so keep it simple and commented.

## Tools at a glance
| Tool | Used for | Where |
|---|---|---|
| GitHub (`Jie-coder/hoo-lee-sheet-sdc2026`) | code, PRs, history | github.com |
| Claude Code | writing code | shared computer terminal |
| Node.js 24 + npm | run, test, build | `npm run dev`, `npm test`, `npm run build` |
| Next.js + Tailwind + shadcn/ui | web app and UI | `src/` |
| Vercel AI SDK + Gemini | interview, title mapping, embeddings; CV parse falls back here only when `KRACKEDDEVS_API_KEY` is unset | `src/lib/ai.ts` |

CV parse uses KrackedDevs sponsor OpenAI-compatible credits (LiteLLM); scoring / ranking / pathway stay team formulas.
| Zod | checking AI output and CSV rows | `src/types/contracts.ts` |
| Supabase (Postgres + pgvector) | database and similarity search | project `lrwepzwxoeqbcxfbelee` |
| Google Sheets | Tiffany's and Henry's data collection | team Drive |
| Replit | **main** deployment (required) | replit.com |
| Vercel | backup deployment | vercel.com |
| Vitest | tests | `npm test` |

---

## T06: real Gemini calls (Jarvis, with Claude Code)
1. Use the Vercel AI SDK `generateObject` with the Zod schemas `ParsedCV`, `InterviewTurn` and `PathwayPlan`.
2. Embeddings: `gemini-embedding-001` with `outputDimensionality: 768` (constant `EMBEDDING_DIMENSIONS`).
3. Keep `AI_MOCK=1` working so the demo runs without a key.
4. Add one live test per schema that only runs when `GOOGLE_GENERATIVE_AI_API_KEY` is set.
5. Write the exact model IDs in the PR, for the declaration.

**Done when** a real CV for each of the 3 personas parses, and 5 interview turns stop on their own.

## T07: API routes for the full flow (Jarvis, with Claude Code)
1. `POST /api/profile`: parse the CV and create an anonymous `profiles` row.
2. `POST /api/interview`: next question, or stop after 5.
3. `POST /api/analyze`: pgvector top 30 occupations, then `scoreRoles()`, then save to `results`.
4. `POST /api/pathway`: SQL filters courses and programmes (language overlap, cost, eligibility), then Gemini orders them **by ID only**, so it can't invent courses.
5. `DELETE /api/profile`: "delete my data" (cascades to results and pathways).
6. Swap the mock data in the pages for these routes.

**Done when** the whole flow works end to end for Aisyah with real data.

## T08: import real data (Peter runs it, Tiffany and Henry fix their rows)
1. Tiffany and Henry export their sheets as CSV into `data/` (file names in `data/README.md`).
2. Check first (writes nothing): `npx tsx scripts/import-data.ts`. The report says the row and column of each problem.
3. Fix the sheet, export again, and repeat until there are 0 errors.
4. Write to Supabase: `npx tsx scripts/import-data.ts --apply`. This reads keys only from `.env.local`, so it runs on the shared computer.

**Done when** occupations, skills, courses and programmes have rows and embeddings in Supabase.

## T09: 40-occupation list (Peter, then Henry adds exposure)
1. Pick 40 occupations across the 5 clusters, with ESCO URI and ISCO code.
2. Henry fills `exposure.csv` from the Anthropic Economic Index / ILO, copying the published values exactly.

**Done when** `occupations.csv` and `exposure.csv` pass the import check.

## T10: two-date signal snapshot (Jarvis, with Claude Code)
Store two arXiv readings per keyword (30 days ago and today) in `signals`. The "30 days ago / today" toggle then re-ranks the cards.

**Done when** switching the toggle visibly changes at least one ranking, and the date is shown.

## T10b: Future Skills Radar page (Jarvis, with Claude Code; Grace designs)
The Domain 1 brief (journey step 2) asks for a view of which skills and roles are **rising or declining**, based on dated signals.
1. Read the `signals` table: momentum per skill, with the arXiv source and date shown.
2. Show the top rising and declining skills and roles, labelled as estimates.
3. Use the same "30 days ago / today" toggle as the results page, so judges can see the output change when the data changes.

**Done when** the radar loads from real signals and every item shows its source and date.

## T19: sourced demand and scenarios (Jarvis with Claude Code; Henry checks the citations)
The brief asks for identifiable AI-trend **and** job-market signals with source and date, and no invented statistics. Until now cluster demand D and the scenario values were typed in by hand.
1. Malaysian demand: `npx tsx scripts/fetch-dosm-demand.ts` writes `data/demand.csv` from OpenDOSM `wages_occupation` (employees per ISCO major group, latest year and the year before). Rerun when `occupations.csv` changes.
2. Scenario multipliers: `data/scenarios.csv`, one cited WEF Future of Jobs Report 2025 figure (role, %, page) per scenario and cluster. Henry checks every row against the PDF page.
3. Henry adds the new and corrected rows of `data/sources.csv` (OpenDOSM Salaries & Wages by Occupation, WEF Four Futures for Jobs 2030, and the WEF Future of Jobs licence fix) to the "Laluan – AI Signals" sheet, so the next export keeps them.
4. Check: `npx tsx scripts/import-data.ts --only demand,scenarios,sources,occupations` reports 0 errors.
5. Peter applies migration `20261022090000_cluster_demand.sql` to the live project before the next `--apply`.
6. Done: the app's scoring (`SCORING_PARAMS.demandByCluster`, `src/lib/scoring.ts`) uses these values. After changing `demand.csv` or `scenarios.csv`, copy the new values in; `scripts/lib/scenario-demand.test.ts` fails until you do.
7. Later, if time allows: a second exposure figure per occupation from the Anthropic Economic Index (check the dataset card's licence first).

**Done when** every cluster's demand traces to a DOSM table and period, and every scenario multiplier to a WEF page and figure.

## T11: deploy on Replit (Bing Jie with Peter guiding, in DM)
1. Replit: Import → GitHub → `Jie-coder/hoo-lee-sheet-sdc2026` (allow Replit to see this private repo).
2. Open **Secrets** and add: `GOOGLE_GENERATIVE_AI_API_KEY`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `AI_MODEL` if needed. Peter will say exactly which values to use.
3. Press **Run** to check it works in the preview (`.replit` runs `npm install` and `npm run dev` on port 3000).
4. **Deploy / Publish** as **Autoscale** (already set in `.replit`). Save the public URL and a screenshot for the declaration.

**Done when** the public Replit URL loads and the sample-CV flow works.
Keep Vercel (`vercel --prod` via CLI) as the backup with the same env vars.

## T12: submission (whole team, Emily coordinates)
- Pitch slides (Jarvis + Grace), 2–3 minute demo video, final Tools & AI declaration with real usage amounts.
- README: how to run, architecture diagram, data sources and licences.
- Make the repo **public** and add the committee accounts before **25 Oct**.
- After the hackathon: delete the Vercel token `sdc-starter`.
