# Laluan · user flow (5 screens)

Team Hoo Lee Sheet · SDC Hackathon 2026 · wireframes v1, 19 Oct 2026.
Style: `../laluan-design-system.md` and `../results-reference.html`. All content on every screen is example data for synthetic personas.

```
01 Landing ──Start──▶ 02 Profile ──Continue──▶ 03 Interview (max 5 Qs) ──done──▶ 04 Results ──Choose this role──▶ 05 Pathway
   (consent)          (pick sample CV,          (slot filling,                    (scores, 3 futures,           (week-by-week plan)
                       edit skills)              quick-reply chips)                 3 roles, SDG)                   │
                                                                                     ▲──────────Back to roles───────┘
```

Steps indicator in the header: Profile → Interview → Results → Pathway (landing shows all four as upcoming).
Header course-language pill (EN / BM / 中文) is a **multi-select course-language preference**, not the UI language. UI is English only. No login.

| # | Screen | File |
|---|---|---|
| 1 | Landing + consent | `01-landing.html` / `.png` |
| 2 | Profile (sample CV picker) | `02-profile.html` / `.png` / `-mobile.png` |
| 3 | Interview | `03-interview.html` / `.png` |
| 4 | Results (approved, not redrawn) | `../results-reference.html` / `.png` |
| 5 | Pathway | `04-pathway.html` / `.png` / `-mobile.png` |

---

## 1. Landing (`01-landing.html`)
- **Purpose:** say what Laluan does in one line, set expectations (about 3 min, 4 steps) and get consent before any CV is touched.
- **Key components:** hero line "See how AI changes your work — and the free path forward"; "What you get" example-result card (augmentation, exposure with "Exposure is not job loss", robust role, SDG badges, source chips); 4-step how-it-works strip; privacy/consent card (synthetic data only · nothing stored · delete anytime) with consent checkbox; "Built on dated public data" card with source chips and "Trend signal last refreshed" date; example-data note.
- **Data needed:** none per user. Static copy, plus the latest `signals.as_of` for the refreshed date and the source list (dataset + release date).
- **Main action:** **Start** (enabled after the consent box is ticked). Records `consent_at` in session state only.
- **Must-haves shown:** trailer for all six; the dated source chips preview the **AI-trend signal layer**.

## 2. Profile (`02-profile.html`)
- **Purpose:** skills intake without a real CV. User picks one of three synthetic personas, then checks what was read from it.
- **Key components:** 3 persona cards (Aisyah binti Rahman, Lim Jia Hui, Pravin a/l Murugan) with name, age, job, location, preferred course language and a **View CV** link (opens `cvs/*.pdf`); selected state (sage ring + "Selected"); secondary dropzone "Upload your own (synthetic only)" with the "Do not upload a real CV" warning; parsed-profile panel: editable skill chips (remove ×, "Add a skill", added chips marked as self-reported), roles with years, education, course-language multi-select; ESCO match + parse-date source chips; **Continue to interview**.
- **Data needed:** `ParsedCV` = `{ name, roles[{title, years, tasks[]}], skills[], education[{level, field}], languages[] }` for the chosen persona (DEMO_MODE cache or `/api/cv/parse`), plus ESCO match count per skill (cosine ≥ 0.82 → h_s = 1; user-added → 0.5). Course-language preference initialised from `ParsedCV.languages` / CV line.
- **Main action:** **Continue to interview** (saves edited skills + course languages to `profiles.parsed`/`slots` in session).
- **Must-haves shown:** **Skills profile intake** (upload, chips, editable parsed skill list).

## 3. Interview (`03-interview.html`)
- **Purpose:** fill only the slots the CV can't, in five quick turns max, mostly by tapping chips.
- **Key components:** chat panel with header "Question 2 of 5" + progress dots + time left; bot/user bubbles; current question "Roughly how much of your week goes to each task?" with per-task quick-reply chips (~10% / ~25% / ~40% / 50%+) and a share bar per task, "Add a task", "Split them evenly", running total; "Why we ask" line; free-text composer, Skip, Next question. Side panel **What we know so far**: slot list with filled / answering now / still to ask, incl. course languages (EN + BM) and hours per week (6 h), budget, state + age band, and the pending tools, work status/PERKESO and impact-interest slots.
- **Question plan (5 max):** Q1 hours_per_week + budget · Q2 tasks[] time share · Q3 tools + ai_usage · Q4 employment_status + perkeso_contributor (eligibility) · Q5 impact_interest (SDG nudge). Age band, state and languages come from the CV and are shown as already known.
- **Data needed:** `InterviewTurn` = `{ question, chips[], filled: Partial<Slots>, done }` from `/api/interview/next`; the task list seeded from `ParsedCV.roles[].tasks`.
- **Main action:** **Next question** (after Q5, `done = true` → Results). Edit profile link goes back.
- **Must-haves shown:** **Skills profile intake** (interview half); task shares become the w_i weights for exposure/augmentation.

## 4. Results (`../results-reference.html`, approved, unchanged)
- **Purpose:** show how AI touches the user's current work and three roles they could move into, under three futures.
- **Key components:** augmentation hero card + task bars; exposure card ("Exposure is not job loss"); scenario tabs (Co-Pilot Economy / Age of Displacement / Supercharged Progress) with a plain-words explanation; signal-date switch (30 days ago | Today); Refresh + "Last refreshed"; 3 role cards (status pill e.g. "Robust in all 3 futures", rank, fit %, SDG target badges by tier, top-5 missing skills, source chips, **Choose this role**); SDG legend; fixed estimates footer.
- **Data needed:** `RoleResult[]` = `{ occupationId, title, fit, exposure, augmentation, byScenario{co, dis, sup}, robust, gap[{skillId, label, importance}], sdg: SdgLink[], sources: Source[] }`, plus current-job E and G with sources and `signals.as_of`.
- **Main action:** **Choose this role**: the user picks (Laluan does not pick for them) → Pathway for that occupationId.
- **Must-haves shown:** **AI-trend signal layer** (dated chips, Refresh, signal-date switch), **future-role matching + skills gap**, **SDG mapping** (tiers + legend), **multiple future scenarios** (tabs, re-rank, robust badge).

## 5. Pathway (`04-pathway.html`)
- **Purpose:** turn the chosen role into a week-by-week plan the user can start today, free items first and eligibility explained.
- **Key components:** title with chosen role + "You chose this role on the results page"; **Back to roles** and **Download plan (PDF)** (top and bottom); summary bar: 12 weeks · 6 h/week · mostly free · skills closed 5/5, plus cost-type legend in order Free → Subsidised → HRD Corp claimable → Paid and a catalogue source chip; vertical timeline of 6 steps (AI Untuk Rakyat, e-LATiH Power Query course, Looker Studio course, MYFutureJobs/PERKESO career counselling, Google Data Analytics certificate courses 1–3, an HRD Corp claimable SOP-writing course). Each step: kind (course / government programme), provider + domain, cost tag, language tag(s), hours, certificate yes/no, the skill it closes, an SDG target chip (tiered), one-line why, eligibility line, source chip with **last checked** date, Open source link. One programme (career counselling) is marked **Check eligibility** because `perkeso_contributor` is unknown. Side panel: skill gap → step that closes it, SDG targets this move advances (4.4, 5.5, 8.6) with legend, "How this plan was built" (filters, ordering rule, rules-based eligibility, ID-only links). Delete my data. Fixed estimates footer.
- **Data needed:** `PlanStep[]` = `{ itemId, kind: "course" | "program", weekStart, weekEnd, closesSkillIds[], sdgTarget?, why }` resolved by code to `courses` rows (`title, provider, url, language, hours, cost_type, certificate, last_checked`) or `programs` rows (`name, agency, url, benefits, eligibility, last_checked`), plus an eligibility result per programme (`pass | check | fail`, with the missing slot), the chosen `RoleResult.gap` and `RoleResult.sdg`, and `Slots.hours_per_week / budget / language`.
- **Main action:** **Download plan (PDF)**; secondary **Back to roles** (returns to Results with the same scenario).
- **Must-haves shown:** **Personalised reskilling pathway**, **SDG mapping** (per step + summary), skills gap closed (**role matching + gap** follow-through); the dated "last checked" chips continue the **dated-source** principle.

---

## Must-have → screen map
| Must-have | Where it is visible |
|---|---|
| Skills profile intake | 02 Profile (pick/upload, editable skill chips) · 03 Interview (slot filling, chips) |
| AI-trend signal layer (updatable, dated) | 04 Results (Refresh, Last refreshed, signal-date switch, source chips) · preview on 01 Landing |
| Future-role matching + skills gap | 04 Results (fit %, top-5 missing skills) · 05 Pathway (gap closed 5/5) |
| Personalised reskilling pathway | 05 Pathway |
| SDG mapping | 04 Results (tiered badges per role + per missing skill) · 05 Pathway (per step + summary) |
| More than one future scenario | 04 Results (3 WEF futures, re-rank, robust badge) · robust note on 05 Pathway |

## Open points spotted while drawing
- The results summary says "Based on your CV and **5** interview answers", matching `MAX_INTERVIEW_TURNS`.
- The project brief (sections 03/08) says the interview stops at 8 questions and CVs are kept 24 h in a private bucket; the current decisions are 5 questions and "nothing stored". The wireframes follow the decisions.
- The official logo mark uses `#4F7F64`, which is not the system sage `#2F7D5B`. It sits next to sage UI elements; consider aligning one to the other.
