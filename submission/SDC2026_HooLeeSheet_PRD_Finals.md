# DRAFT: Updated PRD (Phase 2 Upgrading Round, 28–30 Oct 2026)

Handbook 6.6.4.1: "A revised version of the original PRD reflecting any refinements made during the Phase 2 Upgrading Round (28–30 October 2026). Should highlight what changed since the preliminary submission and why, based on judge/mentor feedback."

Our original PRD is the Phase 1 proposal (`submission/SDC2026_HooLeeSheet_Preliminary.pdf`). This revision keeps its sections and wording, and marks every change inline as **Changed in Phase 2** with the PR and the reason. Sections with no change say so. [TBC: the judge/mentor feedback behind each change; the reasons below are the rubric criteria quoted in each PR, not recorded feedback.] Not a PDF; the team exports.

## 1. Team & Project Overview

No change. Team Hoo Lee Sheet; Domain 1; SDG 8 primary (8.5), SDG 4 (4.4) and SDG 10 (10.2) secondary; solution Laluan; leader Tan Bing Jie; XMUM; 3 members.

## 2. Executive Summary & Problem Statement

### 2.1 The Problem Context
No change.

### 2.2 The Proposed AI Solution
Items 1, 3, 4 and 6 and the AI-use rule are unchanged ("AI only parses CVs and job titles; code handles scores, explanations and pathways").

- **Item 2, Future Skills Radar. Changed in Phase 2 (PR #85, #88, #91).** Was: "an arXiv fetch script (run manually)". Now: the in-app Refresh re-counts arXiv live (`POST /api/refresh-signals`), stores each dated snapshot in Supabase `trend_snapshots`, and falls back to the last good snapshot and then the bundled data if arXiv is down. `/radar` shows a 95% uncertainty range per skill and marks it "Unclear" when the range crosses 0. For the finals the snapshot fetched on 29 Oct 2026, 16:05:53 (UTC+8) is frozen. Why: the Domain 1 guide asks that the trend source can be updated and results follow the data.
- **Item 4, Scenarios. Changed in Phase 2 (PR #84, #86).** An AI adoption-speed slider (0.5×–2×) is applied to the trend signal: rankScore = fit × (1 + 0.3·tanh(adoption × roleMomentum)). Why: technical expectation "drive scenarios from explicit parameters, such as the speed of AI adoption, applied to the trend signals".
- **Item 3, Explainable matching. Changed in Phase 2 (PR #86).** Each role has a score breakdown (fit, trend boost, demand, exposure, SDG) and a what-if list; Fit is calibrated as min(100%, raw fit ÷ 0.30). Why: rubric "ranked roles with an explainable score and skills gap".
- **Item 5, SDG mapping. Changed in Phase 2 (PR #87, #92).** Skills are tagged through their ESCO skill group (`data/skill_group_sdg.csv`, 67 group rows) and the pathway shows an SDG total. Measured: roles 40/40, skills 379/854 (44.4%); the Phase 1 promise "every role and skill" is not met for skills.
- **Item 6, Pathway. Changed in Phase 2 (PR #92, #93).** One course (c040) gained two syllabus-backed skill links (`data/course_skill_evidence.csv`); pathway stops are labelled "Covers". Why: KPI1 for Jia Hui was 60%.

## 3. Technical Architecture & Implementation Plan

### 3.1 Conceptual Tech Stack
- **AI-trend signal row. Changed in Phase 2 (PR #85, #91).** Was: "arXiv API, fetched by a script (scripts/fetch-arxiv.ts) run manually; the in-app Refresh button re-reads the stored snapshot". Now: `POST /api/refresh-signals` re-counts arXiv in the app; snapshots go to Supabase `trend_snapshots` (or a local file); `TREND_REFRESH_LOCKED=1` freezes the finals snapshot.
- **Scoring engine row. Changed in Phase 2 (PR #84, #86, #90).** Adds rankScore with trendBeta 0.3, adoption speed, score breakdown and `npm run kpi` (deterministic KPI report, `kpi/kpi-report.md`).
- Block diagram: the "arXiv fetch script (manual)" box becomes "Refresh → /api/refresh-signals → trend_snapshots (Supabase) → fallback last good → bundled". [TBC: redraw for the PDF]
- Other rows, sponsor use (Replit, Claude Haiku via Replit AI Integrations; RunPod not used) and must-haves 1 and 4: no change. Must-haves 2, 3, 5 and 6 change as in 2.2 above.
- Live links: https://hoo-lee-sheet-sdc-2026.replit.app (main), https://laluan.vercel.app (backup). Repo: https://github.com/Jie-coder/hoo-lee-sheet-sdc2026.

### 3.2 Design-Thinking & Deployment Strategy
- **Test. Changed in Phase 2 (PR #90, #92).** The KPIs are now measured by script on the three synthetic personas (see section 4). [TBC: real user sessions, if any.]
- **Deploy. Changed in Phase 2 (PR #91).** The trend snapshot is frozen and bundled, so Replit and Vercel show the same numbers during judging.

## 4. Preliminary Environmental & SDG Impact Framework

Targets, baseline and KPI definitions: no change. **Changed in Phase 2: measured results added** (`npm run kpi`, snapshot asOf 2026-10-29; time to pathway timed by hand on 31 Oct 2026):

| KPI | Phase 2 target | Measured | Status |
|---|---|---|---|
| Pathway gap coverage | ≥80% each, ≥90% mean | mean 100%, min 100% | Met |
| (a) Dated sources | 100% | 105/105 | Met |
| (b) SDG tagging | 100% roles and skills | roles 40/40; skills 379/854 (44.4%) | Roles met; skills not met |
| (c) Time to pathway | <3 min | Aisyah sample 32.84 s; Jia Hui sample 26.58 s; Pravin sample 28 s; Henry resume upload 48 s. Tiffany stopwatch, 31 Oct 2026 (Asia/Kuala_Lumpur, UTC+8), https://hoo-lee-sheet-sdc-2026.replit.app; upload or start analyze → pathway page ready | Met |
| (d) Hand-check agreement | ≥80% overall, ≥90% direct, κ≥0.6 | [TBC: 0 of 45 rated] | — |

The Phase 1 "[TBC]" pathway target is now set at ≥80% each and ≥90% mean, and hand-check at ≥80% / ≥90% / κ≥0.6. Source [9] (arXiv API) is now called live.

## 5. Eligibility & Readiness Checklist
No change.

## 6. IP & Originality Declaration
No change to 6.1 and 6.3. 6.2: no new third-party libraries, datasets or models were added in Phase 2. [TBC: confirm against the updated Technical & Tools Declaration and DECLARATION.md (#83).]

## 7. Declaration
[TBC: leader to re-sign and date for the final submission.]
