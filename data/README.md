# Laluan data files

Hand-collected seed data. Each file is exported as CSV from the team's Google Sheets and committed by the person who collected it. Every row must be checked against the official page and carry a date. Never guess a value: leave it blank and explain in `notes`.

Lists inside one cell use a comma for codes (`en,ms`) and a semicolon for names and URIs (`skill a; skill b`).

## Tiffany: courses and programmes (due: 30 courses + 5 programmes on 21 Oct, about 60 + 10 on 22 Oct)

### `courses.csv`
| column | values |
|---|---|
| id | c001, c002, ... |
| title, provider, url | as shown on the official course page |
| languages | en, ms, zh (comma-separated if several) |
| hours | number |
| cost_type | free, subsidised, hrdcorp_claimable, paid (free audit with a paid certificate = free, certificate no, note it) |
| certificate | yes / no |
| skills | ESCO skill names, 1 to 4, semicolon-separated |
| skill_uris | ESCO URIs in the same order, semicolon-separated |
| sdg_target | 4.3 or 4.4 |
| sdg_reason | one sentence |
| summary | one sentence in our own words (do not copy the site) |
| last_checked | YYYY-MM-DD |
| notes | anything uncertain |
| mode | online, physical, or hybrid (how the course is delivered) |
| ai_content | ai, digital, or none (ai = teaches AI concepts/tools directly, digital = teaches non-AI digital tools/software, none = neither). See `course_ai_evidence.csv` for the evidence and checked URL behind each value; not shown in the UI. |

Language mix: at least 10 BM courses, at least 5 Chinese courses, the rest English.

### `course_ai_evidence.csv`
Evidence backing each course's `ai_content` value in `courses.csv`. Not part of the import/validation pipeline and not shown in the UI — a paper trail for reviewers only.
| column | values |
|---|---|
| course_id | matches a courses.csv id |
| evidence | quoted module/tool names or skills found on the course page |
| check_url | the URL checked for evidence |

### `programmes.csv`
| column | values |
|---|---|
| id | p001, p002, ... |
| name, agency, url | from the official site only |
| benefits | one sentence |
| cost_type | free, subsidised, hrdcorp_claimable, paid |
| deadline | YYYY-MM-DD or blank |
| age_min, age_max | number or blank |
| citizen | yes / no / blank (not stated) |
| employment | employed, underemployed, unemployed, student, self_employed (comma-separated), or `any` alone |
| perkeso_contributor | yes / no / blank |
| states | johor, kedah, kelantan, melaka, negeri_sembilan, pahang, perak, perlis, pulau_pinang, sabah, sarawak, selangor, terengganu, kuala_lumpur, labuan, putrajaya (comma-separated), or `all` alone |
| last_checked | YYYY-MM-DD |
| notes | anything uncertain |

## Henry: AI-trend signals (due: sources 20 Oct, keywords 21 Oct, exposure 22 Oct)

### `sources.csv`
`name, url, publisher, what_it_measures, update_frequency, last_updated, data_format (API / CSV / PDF only), licence, use_for (exposure / trend / scenario / skills / demand), notes`

Master copy: the **"Laluan – AI Signals" Google Sheet** (sources tab). This CSV is exported from it, so add or fix a source in the sheet first, then export; an edit made only here is lost on the next export.

The licence must be filled in, exactly as the publisher states it. A source with unclear or no-reuse terms can't be used for scoring, with one exception: a report that is "all rights reserved" (WEF) may be **cited**, one published figure at a time with its page, never copied as a dataset (see `scenarios.csv`).

Lands in `public.sources` via `--apply` (migration `20261021150000_seed_sources_exposure.sql`, upserted on its primary key `name`).

### `keywords.csv` (about 25 arXiv keywords)
`keyword, arxiv_query, skills, skill_uris, direction (up / down / flat), count_last_90d, count_prev_90d, checked_on, notes`

**Don't type the counts by hand.** Fill in `keyword`, `arxiv_query`, `skills`
and `skill_uris`, then let the script count arXiv papers and set `direction`
and `checked_on`:

```
npx tsx scripts/fetch-arxiv.ts                      # windows ending today
npx tsx scripts/fetch-arxiv.ts --as-of 2026-09-19   # windows ending on a past date (T10 snapshot)
npx tsx scripts/fetch-arxiv.ts --dry-run            # print the counts, change nothing
```

- It searches `all:(arxiv_query)` in two back-to-back 90-day windows by
  submission date, one request every 3 seconds (arXiv's limit).
- `direction` is `flat` when the two windows differ by 10% or less.
- A keyword with fewer than 20 papers in **both** windows is too small to read
  as a trend: the check warns and scoring ignores it. Use a broader query, or
  drop it.
- In the app, a skill's momentum is the **average** over its keywords, so one
  busy keyword can't drown out the others. (The database `signals` rows below
  still sum counts per skill.)

Lands in `public.signals`, via `--apply` (two rows per ESCO skill URI: the current and preceding 90-day window). This needs migration `20261021150000_seed_sources_exposure.sql` applied first — it adds `signals_reading_key`, the unique constraint on `(skill_id, source, metric, window_end)` the upsert's `onConflict` relies on, since `signals.id` has no natural key of its own. That same migration adds `signals.keywords` (`text[]`): two keywords that map to the same skill with the same `checked_on` collide on that key, and instead of one keyword's reading winning, their `count_last_90d`/`count_prev_90d` are summed into one row, with every contributing keyword recorded in `keywords`. That row's `url` ORs every contributing keyword's `arxiv_query` (each as `all:(...)`).

### `exposure.csv` (the 40 occupations; Peter sends the draft list by 20 Oct)
`occupation, code (ISCO or ESCO), exposure_value (copied as published), scale (e.g. 0-1, %, ILO gradient 1-4), source_name, source_url, table_or_page, as_of, notes`

Never invent a number. If there's no exact match, use the closest occupation and explain the match in `notes`.

Lands in `public.exposure` via `--apply` (migration `20261021150000_seed_sources_exposure.sql`, upserted on its primary key `(occupation, source_name)` — `code` alone repeats across occupations that share one ISCO code). `source_name` must be a row in `sources.csv` (sources are upserted first, since `exposure.source_name` references `sources.name`). `occupation_id` is filled in only when `occupation`/`code` match exactly one row in `occupations.csv` (by `title_en`, or failing that by `code` against `isco_code`/`esco_uri`); it is left `null`, never guessed, when the match is missing or ambiguous.

## `demand.csv` (generated from OpenDOSM: never edit by hand)
`cluster, isco_major_group, metric, value, period, prev_value, prev_period, source_name, source_url, table_or_dataset, as_of, notes`

Master copy: **the script**. Malaysian employees per ISCO major group, for the
latest year and the year before, for every major group our occupations fall in.
It feeds D, the demand term in R = 0.5·F + 0.3·D + 0.2·(1 − θ·E).

```
npx tsx scripts/fetch-dosm-demand.ts            # download and write data/demand.csv
npx tsx scripts/fetch-dosm-demand.ts --dry-run  # print the rows and growth, change nothing
```

- Source: OpenDOSM [`wages_occupation`](https://open.dosm.gov.my/data-catalogue/wages_occupation)
  (Annual Salaries & Wages by Occupation & Sex, CC BY 4.0), file
  `https://storage.dosm.gov.my/labour/wages_occupation.csv`. It is the only
  OpenDOSM dataset split by occupation group. `value` is the number of
  **employees who are Malaysian citizens** (thousands), so employers,
  own-account workers and non-citizens are not counted.
- `value` and `prev_value` are copied as published. `as_of` is the dataset
  page's "last updated" date.
- Cluster → major group: the first digit of each occupation's `isco_code` in
  `occupations.csv` (MASCO-2020 uses ISCO-08's major groups). A cluster's
  growth is the growth of its groups, weighted by how many of its occupations
  are in each. `ai_digital` and `data_analytics` are both entirely group 2
  (Professionals), so DOSM data alone cannot tell them apart; `scenarios.csv` does.
- Rerun after `occupations.csv` changes, or when DOSM publishes a new year.

Lands in `public.cluster_demand` via `--apply` (migration
`20261022090000_cluster_demand.sql`, **not yet applied to the live project**;
upserted on `(cluster, isco_major_group, metric, period)`).

## `scenarios.csv` (cited WEF figures: Henry checks each row)
`scenario_id, cluster, demand_multiplier, theta, source_name, source_url, page_or_figure, quote_or_figure, as_of, notes`

Master copy: **this repo** (WEF's licence allows citing figures, not
re-publishing them in a shared sheet). One row per scenario (`co`, `dis`,
`sup`) and cluster: 15 rows.

- Every figure is a role's **Global net growth (%, 2025-2030)** printed in a
  WEF Future of Jobs Report 2025 profile's "Key roles for business
  transformation" table. `page_or_figure` is the PDF page; `quote_or_figure`
  quotes the role title and figure. WEF Figures 2.2-2.5 draw bars without
  numbers, so they are not used for figures (never read a number off a bar).
- Each of our occupations is matched by hand to the closest WEF role that has
  a printed figure (the match is in `notes`; unmatched occupations are named).
  Then **Co-Pilot** = the occupation-weighted mean of those figures,
  **Supercharged** = the highest, **Displacement** = the lowest.
  `demand_multiplier` = 1 + figure / 100.
- `theta` is the brief's illustrative exposure penalty (co 1, dis 1.4, sup
  1.2), unchanged; one value per scenario (the check enforces it).
- Our three scenarios are those of WEF *Four Futures for Jobs in the New
  Economy: AI and Talent in 2030* (January 2026), which gives directions only,
  no numbers.

How D is computed from `demand.csv` and this file
(`scripts/lib/scenario-demand.ts`): index = (1 + Malaysian growth) ×
`demand_multiplier`, divided by the largest index in any scenario, so D is
between 0 and 1 and the three scenarios share one scale. This is our model,
not a published statistic. Lands in `public.scenarios` (`theta`,
`demand_by_cluster`) via `--apply`, upserted on `id`.

## Peter: occupations.csv (proposed — not finalised yet)

`data/README.md` does not define this file yet; `scripts/import-data.ts` proposes the
format below so Peter's draft occupation list has somewhere to land, and so
`exposure.csv` rows can be checked against it. It mirrors the
`public.occupations` table in `supabase/migrations/` and the `ClusterId` enum
in `src/types/contracts.ts`. Open a PR against this section if the shape
should change before Peter starts filling it in.

### `occupations.csv` (proposed)
| column | values |
|---|---|
| id | o001, o002, ... |
| esco_uri | `https://data.europa.eu/esco/occupation/<uuid>`, or blank if no match yet |
| isco_code | ISCO-08 code, or blank |
| title_en, title_ms | as shown on the official ESCO/ISCO page |
| description | one or two sentences in our own words |
| cluster | ai_digital, data_analytics, green_sustainability, human_care, routine_clerical |
| is_emerging | yes / no |
| last_checked | YYYY-MM-DD |
| notes | anything uncertain, including how a fuzzy exposure.csv match was chosen |

## `occupation_skills.csv` (generated from ESCO: never edit by hand)
`occupation_id, skill_uri, skill_label, relation (essential / optional), source_name, as_of`

The skills ESCO lists for each occupation in `occupations.csv`. Scoring needs
it: fit and the skills gap are computed over a role's **essential** skills,
and the arXiv trend can only change a ranking through them.

Regenerate it whenever `occupations.csv` changes:

```
npx tsx scripts/fetch-esco-skills.ts                    # essential skills, ESCO v1.2.1
npx tsx scripts/fetch-esco-skills.ts --include-optional # also optional skills
```

- It reads the official ESCO API (`selectedVersion=v1.2.1`, pinned so the file
  can be rebuilt exactly; the API's unversioned default returns a slightly
  different list).
- An occupation with a blank `esco_uri` is skipped and named in the output.
- If any occupation fails to load, nothing is written.
- Every row cites `ESCO` in `sources.csv` (`use_for: skills`, which needs
  migration `20261021190000_sources_use_for_skills.sql` on the live database).
- Lands in `public.occupation_skills` via `--apply`, upserted on
  `(occupation_id, skill_id)`. ESCO skills that no course or keyword mentions
  are added to `public.skills` first, with their ESCO label.

## `skill_groups.csv` (generated from ESCO: never edit by hand)
`skill_uri, group_uri, group_label, source_name, as_of`

Each skill's group in ESCO's own skills hierarchy (`broaderHierarchyConcept`).
Scoring gives **half credit** when a user's skill is in the same ESCO group as
a role's essential skill (for example "use spreadsheets software" and "perform
data analysis" are both in "managing, gathering and storing digital data").
The pathway also uses it to suggest a related course when no course teaches a
gap skill. Rerun after `fetch-esco-skills.ts`:

```
npx tsx scripts/fetch-esco-skill-groups.ts
```

## `occupation_sdg.csv` (drafted by the team: Henry reviews in T18)
`occupation_id, target, target_label, tier (direct / supporting), reason, source_url, checked_on`

One to three UN SDG targets per occupation, each with a one-line reason and the
UN goal page. `direct` means the work itself delivers the target (solar
installer → 7.2); `supporting` means it contributes. A clerical job with no
stronger link gets 8.5 (decent work), and the reason says so.

## `persona_skills.csv` (demo only)
`persona_id, cv_skill, esco_uri, esco_label, note`

The three synthetic sample CVs' skills, matched to ESCO skills by hand (ESCO
search candidates, checked by a person). A CV skill with no fitting ESCO skill
has no row and shows as unmatched on the profile page. Replaced by Gemini
matching once T06 lands.

## The app reads `src/data/catalogue.json`, not these CSVs

After changing anything in `data/`, rebuild it (a test fails if you forget):

```
npm run build-catalogue
```

It runs the same checks as `import-data.ts` and refuses to write if any file has
an error. The app needs no database or API key to rank roles.

## Checking your file before you hand it in

`scripts/import-data.ts` reads every file above and tells you exactly which
row and column is wrong — row 1 is the header, so "row 2" means your first
data row. It never touches Supabase or Gemini unless you pass `--apply`, so
it is always safe to run.

1. Export your sheet as CSV and save it under `data/`, using the exact
   filename from the table above (for example `data/courses.csv`).
2. Once per checkout: `npm ci`.
3. Run the check, scoped to your file:
   ```
   npm run import-data -- --only courses       # Tiffany: courses.csv
   npm run import-data -- --only programmes     # Tiffany: programmes.csv
   npm run import-data -- --only sources         # Henry: sources.csv
   npm run import-data -- --only keywords         # Henry: keywords.csv
   npm run import-data -- --only exposure         # Henry: exposure.csv
   npm run import-data -- --only occupations      # Peter: occupations.csv
   npm run import-data -- --only demand,scenarios  # demand.csv and scenarios.csv
   ```
   (Leave off `--only` to check every file in `data/` at once.)
4. Read the report top to bottom. Each `[ERROR]` line names the row, the
   column, the value it read, and a one-line fix. `[WARNING]` lines (for
   example a keyword under 20 papers, or an `exposure.csv` row that doesn't
   match anything in `sources.csv`/`occupations.csv`) are worth a look but
   don't block anything. Fix the CSV, not the script, and re-run.
5. The command exits with a non-zero status when there are any `[ERROR]`s —
   if you're scripting this, check the exit code; otherwise the totals line
   at the end ("N error(s)") says the same thing.
6. `--apply` (writes the valid rows to Supabase, and calls Gemini to embed
   occupations and skills) is for whoever holds the Supabase service-role
   key and Gemini key in their own `.env.local` — not needed for the checks
   above, and it refuses to run at all while any file has an `[ERROR]`. It
   reads those three secrets only from `.env.local` in the repo root (never
   from an already-exported shell variable), so copy `.env.example` to
   `.env.local` and fill it in first.

   For `skills` specifically, `--apply` only ever sets `id`, `esco_uri`,
   `label_en`, and `embedding` for a skill that already exists in Supabase —
   it never overwrites `label_ms`, `is_green`, or `base_importance` once
   someone has curated them. Those three columns are only seeded (with a
   placeholder) the first time a skill is created.

   Every table is written before any embedding is computed, and embeddings
   are sent to Gemini in batches of 100, each batch's vectors saved right
   away. If Gemini's quota runs out partway through (the free tier allows
   only 100 embedding requests a minute, and also has a daily cap), the run
   exits **3** — distinct from 0 (fully done) and 1 (an error) — after
   printing how many skills/occupations embeddings are done vs. remaining.
   Every non-embedding table is already written by then; just re-run the
   same `--apply` command later to resume — reruns skip rows that already
   have a stored vector for unchanged text, so most rows aren't re-embedded.
