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

Language mix: at least 10 BM courses, at least 5 Chinese courses, the rest English.

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
`name, url, publisher, what_it_measures, update_frequency, last_updated, data_format (API / CSV / PDF only), licence, use_for (exposure / trend / scenario / skills), notes`

The licence must be filled in. A source with unclear or no-reuse terms can't be used for scoring.

Lands in `public.sources` via `--apply` (migration `20261021150000_seed_sources_exposure.sql`, upserted on its primary key `name`).

### `keywords.csv` (about 25 arXiv keywords)
`keyword, arxiv_query, skills, skill_uris, direction (up / down), count_last_90d, count_prev_90d, checked_on, notes`

Drop keywords with fewer than 20 papers in the last 90 days, and keywords that are too broad.

Lands in `public.signals`, via `--apply` (two rows per ESCO skill URI: the current and preceding 90-day window). This needs migration `20261021150000_seed_sources_exposure.sql` applied first — it adds `signals_reading_key`, the unique constraint on `(skill_id, source, metric, window_end)` the upsert's `onConflict` relies on, since `signals.id` has no natural key of its own. That same migration adds `signals.keywords` (`text[]`): two keywords that map to the same skill with the same `checked_on` collide on that key, and instead of one keyword's reading winning, their `count_last_90d`/`count_prev_90d` are summed into one row, with every contributing keyword recorded in `keywords`. That row's `url` ORs every contributing keyword's `arxiv_query` (each as `all:(...)`).

### `exposure.csv` (the 40 occupations; Peter sends the draft list by 20 Oct)
`occupation, code (ISCO or ESCO), exposure_value (copied as published), scale (e.g. 0-1, %, ILO gradient 1-4), source_name, source_url, table_or_page, as_of, notes`

Never invent a number. If there's no exact match, use the closest occupation and explain the match in `notes`.

Lands in `public.exposure` via `--apply` (migration `20261021150000_seed_sources_exposure.sql`, upserted on its primary key `(occupation, source_name)` — `code` alone repeats across occupations that share one ISCO code). `source_name` must be a row in `sources.csv` (sources are upserted first, since `exposure.source_name` references `sources.name`). `occupation_id` is filled in only when `occupation`/`code` match exactly one row in `occupations.csv` (by `title_en`, or failing that by `code` against `isco_code`/`esco_uri`); it is left `null`, never guessed, when the match is missing or ambiguous.

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
