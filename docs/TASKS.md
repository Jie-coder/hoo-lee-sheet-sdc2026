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
| Vercel AI SDK + Gemini | CV parsing, interview, pathway ordering, embeddings | `src/lib/ai.ts` |
| Zod | checking AI output and CSV rows | `src/types/contracts.ts` |
| Supabase (Postgres + pgvector) | database and similarity search | project `lrwepzwxoeqbcxfbelee` |
| Google Sheets | Tiffany's and Henry's data collection | team Drive |
| Replit | **main** deployment (required) | replit.com |
| Vercel | backup deployment | vercel.com |
| Vitest | tests | `npm test` |

---

## Priority order, 21–25 Oct (from the mock judging on 21 Oct)
Three mock judges (developer, UI/UX, marketing/SDG) scored the live site and repo at **about 47/100**, which would not advance. The main reason: every result on the site is hand-typed mock data, so the rubric's key feature (**trend data feeding role matching**, Feasibility 25%) is not shown working. The tasks below are ordered by score gained per hour. **P0 must land before the demo is recorded.**

| Priority | Task | Owner | Target day |
|---|---|---|---|
| P0 | T13: importer bug fixes (Windows run, `base_importance`) | Jarvis | 21 Oct |
| P0 | T14: occupation skills from ESCO (`occupation_skills.csv`) | Jarvis, Peter checks | 22 Oct |
| P0 | T15: real scoring on real data, remove invented roles and courses | Jarvis | 22–23 Oct |
| P0 | T16: arXiv fetch script and trend signal fixes | Jarvis, Henry checks | 22 Oct |
| P0 | T10: two-date signal snapshot (needs T16) | Jarvis | 23 Oct |
| P1 | T10b: Future Skills Radar (needs T16) | Jarvis, Grace | 23 Oct |
| P1 | T17: course and source data clean-up, green courses | Tiffany, Henry | 22 Oct |
| P1 | T18: meaningful SDG links | Henry, Jarvis | 23 Oct |
| P1 | T19: UX fixes on results, interview and pathway | Jarvis, Grace | 23–24 Oct |
| P1 | T20: remove starter code and public write route | Jarvis | 22 Oct |
| P1 | T11: deploy on Replit | Bing Jie, Peter | 23 Oct |
| P1 | T12 + T21: README, proposal PDF, positioning, declaration | Emily, whole team | 24 Oct |
| P2 | T06: real Gemini calls (only if P0 and P1 are done) | Jarvis | 24 Oct |

T07 step 3 is replaced by T15 for the preliminary round: scoring runs on `data/*.csv` with no API keys, so the demo can't break. Supabase and pgvector can come back after the deadline.

## T06: real Gemini calls (Jarvis, with Claude Code)
> **P2 since 21 Oct.** The preliminary rubric scores the trend → matching chain (T13–T16), not CV parsing. If T06 doesn't land, the README and declaration must say the ranking is plain maths and no LLM is in the user flow.

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
2. Check first (writes nothing): `npx tsx scripts/import-data.ts`. The report says the row and column of each problem. **On Windows this prints nothing until T13 is merged.**
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

---

## From the mock judging (21 Oct)

## T13: importer bug fixes (Jarvis, with Claude Code)
Two bugs stop the import from working, even though all 158 rows pass the check.
1. **Windows run:** `npx tsx scripts/import-data.ts` prints nothing and exits 0 on Windows. The `isMain` check at the bottom of `scripts/import-data.ts` compares `file://${process.argv[1]}` with a `file:///C:/…` URL. Use `import.meta.url === pathToFileURL(process.argv[1]).href` (from `node:url`).
2. **Skill importance is always 0:** `buildSkillRows` in `scripts/lib/apply.ts` writes `base_importance: 0`. Fit divides by the importance total (`src/lib/scoring.ts`, `fit`), so every role would score 0% fit. Use a neutral 1 for every new skill: fit only counts essential skills, and arXiv momentum moves the weight up or down. (PR #23)
3. Add `"typecheck": "next typegen && tsc --noEmit"` to `package.json`: plain `tsc --noEmit` fails on a fresh clone (`layout.tsx`, `LayoutProps` not found).

**Done when** the dry-run prints its report and `would write:` line on the shared Windows computer, a test covers both fixes, and `npm run typecheck` passes on a fresh clone.

## T14: occupation skills from ESCO (Jarvis, Peter checks)
`public.occupation_skills` is empty because no CSV links occupations to skills (see `data/README.md`). Without it, every role has 0% fit and no skills gap, and the arXiv trend can't change any ranking (momentum only boosts essential skills).
1. New script `scripts/fetch-esco-skills.ts`: for each `esco_uri` in `occupations.csv`, read `hasEssentialSkill` and `hasOptionalSkill` from the official ESCO API (`https://ec.europa.eu/esco/api/resource/occupation?uri=…`, licence CC BY 4.0).
2. Write `data/occupation_skills.csv`: `occupation_id, skill_uri, skill_label, relation (essential / optional), source, as_of`. Copy what ESCO says; never add a skill by hand.
3. Add a row schema, mapper and builder the same shape as `exposure.csv`. Skills that aren't in the `skills` table yet get added with their ESCO label.
4. Add ESCO to `sources.csv` with its licence and date.

**Done when** the dry-run shows `occupation_skills` above 0, every occupation has at least 5 essential skills, and Peter has spot-checked 3 occupations against the ESCO website.

## T15: real scoring on real data (Jarvis, with Claude Code)
Today `src/app/results/page.tsx` reads `AISYAH_RESULTS` from `src/mocks/`, and `scoreRoles` is only called in tests. The judges found invented roles (Data Operations Analyst, Customer Experience Specialist, ESG Reporting Associate) and 15 invented courses (`src/mocks/catalogue.ts`). The Domain 1 rules forbid this.
1. Add a server-side loader that reads `data/*.csv` (occupations, occupation skills, exposure, keywords, courses, programmes, sources). Supabase is optional; the CSVs are the fallback.
2. Compute momentum from the keyword signals and run `scoreRoles` for the user's profile, using the skills they edited on the profile page.
3. Build the pathway from courses `c001`–`c036` by ESCO skill URI, using the existing filters in `src/lib/pathway.ts`. Course links are the real course URLs from `courses.csv`.
4. Delete the invented roles in `src/mocks/aisyah.ts` and the invented courses in `src/mocks/catalogue.ts`. Keep the three personas as synthetic profiles only.
5. Results depend on the profile: Aisyah, Jia Hui and Pravin must each get their own results (today everyone sees Aisyah, `results-view.tsx`, `pathway-view.tsx`).
6. Every role card shows its score breakdown: fit F, demand D, exposure E, and the scenario-adjusted rank R. Clamp R to 0–1.
7. Every source chip comes from a real `sources.csv` row, with its `last_updated` date (today the site shows Anthropic Economic Index "Sep 2026" but the sheet says 26 Jun 2026).

**Done when** each persona gets different results, every role is a row in `occupations.csv`, every course is a row in `courses.csv`, the numbers on screen match the formula, and the site works with no API keys set.

## T16: arXiv fetch script and trend signal fixes (Jarvis, Henry checks)
The keyword counts were typed in by hand and some are wrong. For example, `keywords.csv` says 2,215 "robotic process automation" papers in 90 days, but arXiv returns only a handful for that phrase. The direction also comes from one comparison (45 vs 46 is labelled "down").
1. New script `scripts/fetch-arxiv.ts`: for each `arxiv_query`, count papers by `submittedDate` for the last 90 days and the 90 days before. Write the counts and `checked_on` back to `keywords.csv`.
2. Add a "flat" band: a change within ±10% is `flat`, not `up` or `down`. Ignore keywords with fewer than 20 papers in both windows.
3. Store one signal per keyword. Today six keywords map to "manage data" and their counts are summed (`scripts/lib/apply.ts`), so RPA swamps AI governance. Either map each keyword to a more specific ESCO skill, or average the momentum instead of summing counts.
4. Henry re-checks the mapping of each keyword to its ESCO skill.

**Done when** the script reproduces every count in `keywords.csv`, Henry signs off on the mapping, and no skill's signal is dominated by one unrelated keyword.

## T17: course and source data clean-up (Tiffany: courses; Henry: sources)
1. **Wrong summaries:** c016's title is Power Automate RPA but its summary describes a React web bootcamp; c024's title is Azure AI Fundamentals but its summary describes AWS and cybersecurity over 360 hours. Fix the title or the summary to match the real course page.
2. **"Free" that isn't:** add an `eligibility_note` column and fill it in. Known cases:
   - c003 and c011: the exam costs money.
   - c024: Bumiputera only.
   - c027: B40 only.
   - c013: unemployed only.
   - c028: CGPA 3.0 or higher.
   - The 11 courses that rely on the Global Learning Pass (p002): its first 25,000-seat cohort is full, so mark them "waitlist".
3. **Certificate column:** make it consistent. c001 and c002 say `no`, but their notes say a free certificate via p002, the same as c007 (`yes`).
4. **Notes in English only.** Move the Chinese text out of the notes column, or into a separate column if you need it.
5. **c025** links to a general MyFutureJobs listing page. Use the course's own page, or drop the row.
6. **Green and ESG courses:** add 4–6 real ones (carbon accounting, ESG reporting, solar PV, energy auditing). Pravin's persona and the green roles have no courses today.
7. **Sources (Henry):**
   - Add O*NET to `sources.csv`; the site cites it but the sheet doesn't list it.
   - Fix WEF's licence; the row says both CC BY-NC-ND and "all rights reserved".
   - Drop Lightcast unless we have approval for its non-profit tier.
8. **Green keywords (Henry):** add 3 green-skill keywords to `keywords.csv`.

**Done when** the import check passes with the new columns, and Tiffany has opened every changed course URL.

## T18: meaningful SDG links (Henry, Jarvis)
All 36 courses are tagged 4.4 or 4.3, even when the reason names 8.3, 8.5 or 10.2. Judges called the SDG layer "decorative".
1. **Roles carry outcome targets:** for example 7.2 for solar roles, 12.6 for ESG reporting, 3.8 for care roles, 4.c for teachers. Add them to `occupations.csv` with a one-line reason and the UN target URL.
2. **Courses:** keep 4.4 as the learning target, and add the outcome target the reason already names (8.3, 8.5, 10.2).
3. **Remove links we can't defend:** "5.5 women in leadership" on a clerk-to-analyst move, and "8.6 youth not in employment" on an employed persona.
4. **Remove the made-up confidence decimals** (0.92, 0.84…). Use the existing tiers instead (direct / indirect).
5. On results, show what a choice changes: "Choosing this role adds SDG 7.2".

**Done when** every role has at least one outcome target with a reason and a source, and no SDG number appears on screen without its short label.

## T19: UX fixes (Jarvis builds, Grace checks)
From the UI/UX judge's walk-through of the live site.
1. **Score explanation:** "Why this role" should say "You have 7/12 essential skills · demand ×1.1 · exposure 0.49", not repeat the status label (`role-card.tsx`).
2. **Scenario switch:** show the scenario-adjusted score next to fit. Today a 54% card can rank above a 68% card with no number to explain why.
3. **Signal-date toggle:** it must not change "fit with your current skills". Only demand and rank should move.
4. **Refresh:** the button only waits on a timer. Either re-read the signals and show what changed, or remove it.
5. **Interview Q2:** task shares can total 140% and still show a green ✓ (`interview-view.tsx`). Warn when the total isn't 100% and block Next.
6. **Pathway:**
   - `?role=bad` shows a blank page; add a "Role not found → Back to roles" state.
   - "Download plan (PDF)" only shows a toast; use `window.print()` with a print stylesheet.
   - "How this plan was built" must come from the real filter result, e.g. "No 中文 match; English fallback".
7. **Header language switch** (EN/BM/中文, `site-header.tsx`) changes nothing. Bind it to the profile's course languages, or remove it.
8. **Sources:** show one dated source chip inline on every role card (as the design system says), with the rest behind "more".
9. **Accessibility:**
   - Label the name, role, years and education inputs on the profile page.
   - Make chip "×" buttons and the consent checkbox at least 24 px.
   - Raise grey/70 and grey/80 text to 4.5:1 contrast.
   - Make the focus ring visible.
   - Add a skip link.
10. **Landing page:**
    - The hero "Start" button should go straight into the flow, not scroll to the consent box.
    - Fix "Med · 0.48" overflowing its card on mobile.
    - On mobile, the first "Choose this role" button sits 2.3 screens down; move a short summary above it.

**Done when** Grace has re-walked the flow on desktop and mobile with each persona and found none of the above.

## T20: remove starter code and the public write route (Jarvis)
1. Delete `/api/items` and `/demo`. Once Supabase keys are set, `/api/items` lets anyone insert data using the service-role key (`data: z.unknown()`).
2. Remove the starter `SYSTEM_PROMPT` ("REPLACE ON HACKATHON DAY") and the generic `AnalysisResultSchema` from `src/lib/ai.ts`, or replace them in T06.
3. Add a simple per-IP rate limit to any route that calls Gemini.
4. `/status` and `/api/health` return 503 on the live site because no keys are set. Make the health check pass in mock mode, or hide `/status`.
5. `runpod/handler.py` is an echo stub. Either finish it or say in the README that RunPod is not used.

**Done when** no route can write to the database without going through the flow's own checks, and the live `/api/health` returns 200.

## T21: positioning and proposal text (Emily, whole team)
The judges said our strongest idea is hidden: **the role that stays in the top 3 in every AI scenario**. The landing headline "See how AI changes your work" is what every exposure checker says.
1. **Positioning line (draft):** "Laluan shows Malaysian admin and service workers which tasks AI will amplify, the one future role that stays strong in every AI scenario, and a free BM/中文/English course plan they actually qualify for, with every number sourced and dated."
2. **Problem framing:** lead with TalentCorp's Impact Study (Nov 2024), about 620,000 workers (18%) facing significant job change from AI, digital and green within 3–5 years. Check the Hays 56% / 26% figure against the Hays primary source before using it.
3. **Competitor:** name TalentCorp's MyMAHIR and say how Laluan differs (task-level exposure, scenario-robust ranking, eligibility-checked free courses in BM/中文/English).
4. **Template section 4 (draft):**
   - **SDG sub-target:** 4.4 primary, 8.5 secondary.
   - **Baseline:** the TalentCorp 620,000 / 18% figure, with citation.
   - **KPI:** % of test users who reach an eligibility-checked, cited, mostly free pathway within 10 minutes.
   - **Phase 2 target:** ≥80% of at least 20 test sessions meet the KPI, and 100% of recommended roles and courses trace to a catalogue row.
5. **Hardest risk and fallback:** name it in the proposal and README. For example, "arXiv or Supabase is down → we serve the last dated CSV snapshot, shown with its date."
6. **README** (part of T12):
   - Remove "we have not picked our idea yet" and "private while we build".
   - Fill every TBD.
   - Match the member count to the real team.
   - Say which LLM is used, or that none is in the user flow.
7. **Declaration section 6.2:** list ESCO, ILO WP140, Anthropic Economic Index, arXiv, O*NET, WEF and DOSM with their licences, plus Claude Code as an AI tool.
8. **Sponsor proof:** both PDFs in `submission/` still say "EXAMPLE ONLY". Replace them with real Replit (and RunPod, if used) screenshots after T11.

**Done when** someone outside the team can read the landing page and README cold and explain who Laluan is for and what they walk away with.
