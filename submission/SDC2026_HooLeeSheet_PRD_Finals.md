# Updated PRD (Phase 2 Upgrading Round, 28–30 Oct 2026)

Handbook 6.6.4.1: "A revised version of the original PRD reflecting any refinements made during the Phase 2 Upgrading Round (28–30 October 2026). Should highlight what changed since the preliminary submission and why, based on judge/mentor feedback."

Our original PRD is the Phase 1 proposal (`submission/SDC2026_HooLeeSheet_Preliminary.pdf`). This revision keeps its sections and wording, and marks every change inline as **Changed in Phase 2** with the PR and the reason. Sections with no change say so. [TBC: the judge/mentor feedback behind each change; the reasons below are the rubric criteria quoted in each PR, not recorded feedback.] Not a PDF; the team exports. Build: `main` at `72c1b14`, 756 tests passing. Live demo: Replit (primary), Vercel (backup).

## 1. Team & Project Overview

No change. Team Hoo Lee Sheet; Domain 1; SDG 8 primary (8.5), SDG 4 (4.4) and SDG 10 (10.2) secondary; solution Laluan; leader Tan Bing Jie; XMUM; 3 members.

## 2. Executive Summary & Problem Statement

### 2.1 The Problem Context
No change.

### 2.2 The Proposed AI Solution
Item 1 keeps its Phase 1 wording; changes below. Scores, explanations and pathways stay team formulas; AI only reads CVs, job titles and certificate pages.

- **Item 2, Future Skills Radar (PR #85, #88, #91).** Refresh now re-counts arXiv live, stores dated snapshots in Supabase and falls back to the last good snapshot. `/radar` shows a 95% range per skill ("Unclear" if it crosses 0). The 29 Oct 2026 snapshot is frozen for the finals. Why: the trend source must be updatable.
- **Item 4, Scenarios (PR #84, #86).** An AI adoption-speed slider (0.5×–2×) drives rankScore = fit × (1 + 0.3·tanh(adoption × roleMomentum)). Why: scenarios must come from explicit parameters.
- **Item 3, Explainable matching (PR #86).** Each role shows a score breakdown (fit 50% + demand 30% + AI-exposure resilience 20% + SDG bonus) and a what-if list.
- **Item 5, SDG mapping (PR #87, #92).** Skills are tagged via ESCO skill groups: roles 40/40, skills 379/854 (44.4%), short of "every skill".
- **Item 6, Pathway (PR #92, #93, #103, #104).** Stops are labelled "Covers"; users can verify certificates (including an AI check of a certificate page) and download a PDF ticket; a labelled demo link always verifies for product demos (#105). Why: KPI1 for Jia Hui was 60%.
- **CV parsing (PR #100).** Uses KrackedDevs sponsor credits (LiteLLM, `deepseek-v4.1-flash`).

**Business model: Be Our Partner (PR #106).** Training providers pay for labelled visibility, not ranking. Sponsored cards are capped at 3 per pathway and 1 per stop, sit after the free or government course, show a free alternative, and are excluded from progress, the certificate and the PDF ticket. Partner names, badges, ratings and prices are fictional, for demonstration only. [Business plan](https://docs.google.com/document/d/11MN9UpsEGrSq6OzrSbLIBjtfxHKiL1pHxkFy55hHIug/edit).

## 3. Technical Architecture & Implementation Plan

### 3.1 Conceptual Tech Stack
- **AI-trend signal row. Changed in Phase 2 (PR #85, #91).** Was: "arXiv API, fetched by a script (scripts/fetch-arxiv.ts) run manually; the in-app Refresh button re-reads the stored snapshot". Now: `POST /api/refresh-signals` re-counts arXiv in the app; snapshots go to Supabase `trend_snapshots` (or a local file); `TREND_REFRESH_LOCKED=1` freezes the finals snapshot.
- **Scoring engine row. Changed in Phase 2 (PR #84, #86, #90).** Adds rankScore with trendBeta 0.3, adoption speed, score breakdown and `npm run kpi` (deterministic KPI report, `kpi/kpi-report.md`).
- Block diagram: the "arXiv fetch script (manual)" box becomes "Refresh → /api/refresh-signals → trend_snapshots (Supabase) → fallback last good → bundled". [TBC: redraw for the PDF]
- Sponsor use: Replit (hosting, Claude Haiku via Replit AI Integrations), KrackedDevs LiteLLM (`deepseek-v4.1-flash`, CV parsing and certificate check, PR #100, #103); RunPod not used. Other rows and must-haves 1 and 4: no change. Must-haves 2, 3, 5 and 6 change as in 2.2 above.
- Live links: https://hoo-lee-sheet-sdc-2026.replit.app (primary), https://laluan.vercel.app (backup). Repo: https://github.com/Jie-coder/hoo-lee-sheet-sdc2026.

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
No change to 6.1 and 6.3. 6.2 changed in Phase 2: one new model, `deepseek-v4.1-flash` via the KrackedDevs LiteLLM endpoint (sponsor credits), used for CV parsing (PR #100) and the AI certificate check (PR #103). One new library, `qrcode` (MIT), draws the course QR codes on the PDF ticket (PR #110). No new datasets.

## 7. Declaration
By submitting this proposal, the team leader confirms that the information provided is accurate to the best of the team’s knowledge and that the project will be original work created during the SDC 2026 hackathon period.

Signature: Tan Bing Jie (team leader)

Date: 31/10/2026
