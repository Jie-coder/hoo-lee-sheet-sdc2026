# Laluan: progress

Last updated: 21 Oct 2026 (Malaysia time). Team Hoo Lee Sheet, SDC Hackathon 2026, Domain 1 (Aiversecity: future-ready workforce).

Laluan reads a CV and asks a 5-question interview. It then shows how much AI affects the user's current work, which future roles fit them under three future scenarios, the skills they're missing, and a learning pathway built from real Malaysian courses and government programmes.

## Done

### Repo and setup
| What | Where | PR |
|---|---|---|
| Starter code (declared as pre-existing, tag `starter-v0`), Apache 2.0 licence, README | repo root | setup commits |
| Replit config (Node 24, Run button, Autoscale deploy on port 3000) | `.replit` | setup commits |
| Optional RunPod provider (off unless `AI_PROVIDER=runpod`) | `runpod/`, `src/lib/ai.ts` | setup commits |
| Official SDC template merged in | `DECLARATION.md`, `submission/` | #1 |

### Shared rules for the code (contracts)
| What | Where | PR |
|---|---|---|
| Data shapes every part of the app agrees on (CV, interview, role card, course, programme, pathway), checked with Zod | `src/types/contracts.ts` | #2, #6, #10 |
| Interview has at most 5 questions (`MAX_INTERVIEW_TURNS = 5`) | same | #6 |
| Course languages are a list of `en`, `ms`, `zh` (user can pick several) | same | #6 |
| Five job clusters (`ai_digital`, `data_analytics`, `green_sustainability`, `human_care`, `routine_clerical`) | same | #10 |
| Embeddings: `gemini-embedding-001`, 768 dimensions | same | #10 |

### Scoring engine (plain maths, no AI)
`src/lib/scoring.ts` (PR #6). Same input always gives the same output.
1. **Exposure E**: for each task, its share of the week × how much AI can do it, added up. High exposure means AI touches a lot of the work. It does not mean the job disappears.
2. **Skill momentum**: arXiv papers in the last 90 days vs the 90 days before, `ln((recent+1)/(prev+1))`. A rising skill gets up to 30% more importance.
3. **Fit F**: the importance-weighted share of a role's essential skills the user already has. Missing skills become the gap list (top 5).
4. **Rank R** = 0.5·F + 0.3·demand + 0.2·(1 − θ·E), plus 0.05 if the role matches the user's chosen SDG interest. It's computed for each of the three scenarios. A role in the top 3 of all three is marked **robust**.

All weights are in `SCORING_PARAMS` and labelled as demo values.

### Database (Supabase)
| What | Where | PR |
|---|---|---|
| 12 tables: occupations, skills, occupation_skills, tasks, signals, scenarios, sdg_links, courses, programs, profiles, results, pathways | `supabase/migrations/` | #7, #10 |
| pgvector (similarity search) with 768-dim HNSW indexes | same | #7 |
| Security: browsers can only read the catalogue tables; user sessions are server-only; no login, no CV file stored | `..._laluan_rls.sql` | #7 |
| **Applied to the live project** `lrwepzwxoeqbcxfbelee` (tables exist, still empty) | Supabase | (20 Oct) |

### Data pipeline
| What | Where | PR |
|---|---|---|
| Spreadsheet spec for Tiffany (courses, programmes) and Henry (sources, keywords, exposure) | `data/README.md` | #5 |
| Import script: checks every CSV row and reports the row and column of each error; `--apply` writes to Supabase and creates embeddings | `scripts/import-data.ts` | #12 |
| Real CSVs in `data/`: 158/158 rows valid, 0 errors | `data/` | #15, #18, #20 |
| `--apply` now writes sources and exposure; dry-run prints per-table counts (`occupation_skills` is 0: no source yet, see T14) | `scripts/lib/apply.ts` | #21 |

### Design and pages
| What | Where | PR |
|---|---|---|
| 3 synthetic CVs (Aisyah, Jia Hui, Pravin), clearly marked SYNTHETIC | `public/samples/`, `docs/personas.md` | #3 |
| Laluan logo, favicon, design system, results reference | `public/brand/`, `docs/design/` | #4 |
| Wireframes for landing, profile, interview, pathway + user flow | `docs/design/wireframes/` | #8 |
| Results page (mock data: Aisyah), scenario tabs, signal-date toggle, SDG badges, source chips | `src/app/results/`, `src/components/` | #9, #11 |
| Landing, profile, interview, pathway pages (mock data); decluttered results and pathway | `src/app/`, `src/components/` | #13, #19 |

Tests: 242 passing on `main` (Vitest). Lint and build are clean.

## Mock judging (21 Oct)
Three mock judges scored the live site and repo at **about 47/100** (Innovation 16.5/30, Fit 11.7/25, Feasibility 8.8/25, Clarity 10.3/20). Main gap: every result is hand-typed mock data, so trend data → role matching is not shown working, and the mocks include invented roles and courses. The fixes are tasks T13–T21 in `docs/TASKS.md`, with a priority table at the top.

## In progress
| What | Who | Status |
|---|---|---|
| Courses + programmes sheet | Tiffany | 36 courses + 8 programmes in `data/`; clean-up and green courses in T17 |
| AI signal sources / keywords / exposure | Henry | 9 sources, 25 keywords, 40 exposure rows in `data/`; fixes in T16 and T17 |
| 40-occupation list with ISCO/ESCO codes and cluster | Peter | 40 rows in `data/occupations.csv`; skills per occupation in T14 |
| Replit import and deploy | Bing Jie + Peter | Replit account created; import not finished yet |
| Tools & AI declaration | Emily | draft in the Team Hub; usage amounts still TBC |

## Not started
See the priority table in `docs/TASKS.md`. In short:
- P0: T13 importer bugs, T14 occupation skills from ESCO, T15 real scoring on real data, T16 arXiv fetch script, T10 two-date snapshot.
- P1: T10b radar, T17 data clean-up, T18 SDG links, T19 UX fixes, T20 starter code removal, T21 positioning and proposal.
- P2: T06 real Gemini calls (moved down: the preliminary rubric scores trend → matching, not CV parsing).
- Running `--apply` against Supabase (after T13 and T14).
- Deploy on Replit (main) and keep Vercel as backup.
- Pitch slides, demo video, final declaration, and making the repo public before submission (25 Oct).

## Waiting on others
- Committee (Discord): final deadline details, which accounts to add as collaborators, whether RunPod is required.
- Tiffany06yek and henrywwawesome-wq still need to accept their repo invites.
- Logo colour: Grace suggests changing `#4F7F64` to sage `#2F7D5B`; needs Bing Jie's decision.
