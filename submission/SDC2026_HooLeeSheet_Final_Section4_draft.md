# DRAFT: Final Report Section 4 (Phase 1 baseline vs Phase 2 measured)

Draft text for Section 4 of the official template "Phase 2: Final Project & Prototype Report" (Finalist Drive > 4. Finalist Guidelines > 2. Template for Document Submission > "1. SDC Hackathon: Submission Template (Finalists)"). Paste into that template; the final file is SDC2026_TeamName_Final.pdf (team exports). All numbers come from `kpi/kpi-report.md` (`npm run kpi`, snapshot asOf 2026-10-29) and the Phase 1 PDF (`submission/SDC2026_HooLeeSheet_Preliminary.pdf`, section 4). [TBC] = not measured or needs the team.

# 4. Environmental & SDG Impact Verification

| Metric Category | Your Response |
|---|---|
| **Target SDG Metric Achievement** — Direct comparison between your Phase 1 baseline and your Phase 2 finalized prototype numbers | **SDG targets (unchanged from Phase 1):** 8.5 primary; 4.4 and 10.2 secondary. **Phase 1 baseline (context):** 47.1% of diploma holders underemployed; 66.0% of graduates aged ≤24 work below their qualification; 4.2M workers (28%) highly exposed to GenAI; 56% use AI at work but 26% trained; no reviewed tool had all six Domain 1 must-haves. **Phase 1 target → Phase 2 measured:**<br>• Pathway gap coverage (primary KPI; % of the chosen role's top-5 missing skills closed by free / subsidised / HRD Corp-claimable items): target ≥80% per persona, ≥90% mean → **mean 100%, min 100% — met.** Aisyah → Data scientist 5/5; Jia Hui → Data scientist 5/5; Pravin → Environmental scientist 5/5. (Before PR #92 it was mean 86.7%, min 60%: Jia Hui 3/5.) Sensitivity: ranks 2–3 are 80–100%.<br>• (a) Dated sources: target 100% → **105/105 (100%) — met.**<br>• (b) SDG tagging: target 100% of roles and skills → roles **40/40 (100%) — met**; skills **379/854 (44.4%) — not met** (was 220/854, 25.8%). The other 475 are generic skills (teamwork, sales, clerical, management) whose group we left unlinked rather than guess.<br>• (c) Time to a finished pathway: target <3 min → **[TBC: not measured]**.<br>• (d) Hand-check agreement on role–SDG pairs: target ≥80% overall, ≥90% direct, κ≥0.6 → **[TBC: not measured; 0 of 45 pairs rated]** (the catalogue has 45 pairs, not 50). |
| **Verification Evidence Method** | `npm run kpi` (scripts/kpi.ts, PR #90) recomputes the KPIs from the app's own code and bundled data, with no AI and no network, and writes `kpi/kpi-report.md` / `.json` with the git SHA (7cfbae6) and snapshot date. KPI1 runs each synthetic persona through the real ranking (Co-Pilot, adoption 1×) and pathway builder. Course→skill links added in #92 are backed by syllabus quotes in `data/course_skill_evidence.csv`. Trend data: live arXiv snapshot fetched 29 Oct 2026, 16:05:53 (UTC+8), 25/25 keywords, frozen for finals (#91). Hand-check template: `kpi/sdg-handcheck-50.csv`. [TBC: link to the public repo path in the PDF] |
| **Socio-Economic / Civic Value** | [TBC: team to write; out of scope of this draft] |
| **Deployment & Commercial Feasibility** | [TBC: team to write; out of scope of this draft] |

## 4.1. Mathematical Proof / Code Logic Snippet (Optional - Bonus Marks)

Pathway gap coverage, as computed by `scripts/kpi.ts`:

```
gap    = role.gap                       // top-5 missing skills of the persona's #1 role (Co-Pilot)
plan   = buildPathwayPlan(gap, persona course languages, 6 h/week)
closed = { s in gap : some step in plan is free, subsidised or HRD Corp-claimable and teaches s }
coverage = |closed| / |gap|             // target: each ≥ 0.8, mean ≥ 0.9
```

Role rank used to pick the #1 role (PR #86): `R = 0.5·rankScore + 0.3·Demand + 0.2·(1 − θ·E) (+0.10 SDG bonus)`, with `rankScore = fit × (1 + 0.3·tanh(adoption × roleMomentum))`. [TBC: team to confirm 4.1 wording is new, not copied from Phase 1, and check the `closed` rule against scripts/kpi.ts before pasting]
