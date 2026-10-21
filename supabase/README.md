# Supabase schema

Migrations in `migrations/` are the Laluan Postgres schema. Apply them in filename order in the Supabase SQL editor, or with `psql`. They are not linked to a project and contain no secrets. `schema.sql` is the older `items` scratch table; these migrations do not create or change it.

`src/types/contracts.ts` is the source of truth for JSON shapes. Columns use snake_case. JSON keeps the contract's own key casing so a route handler can Zod-parse it.

There is no login and no CV file. Profiles are anonymous sessions: no `user_id`, no `auth.users` foreign key, no `cv_path`, no storage bucket.

## Tables

| Table | One line | Contract |
|---|---|---|
| `occupations` | ESCO occupation, cluster (`ClusterId`), and a Gemini `vector(768)` embedding. | `RoleResult.occupationId` |
| `skills` | ESCO skill, green flag, base importance, and a `vector(768)` embedding. | `GapSkill.skillId`, `Course.skillIds` |
| `occupation_skills` | Essential or optional skill on an occupation. Not wired into `--apply`: no `data/*.csv` supplies an occupation->skill link yet (see `data/README.md`). | Gap uses `relation = 'essential'` |
| `tasks` | Task text plus automation and augmentation shares, with `source` and `as_of`. | Exposure inputs in section 05 |
| `signals` | One arXiv reading (`window_start`, `window_end`, `as_of`) so two dates can be stored. | `SignalReading` inside `SignalSnapshot` |
| `scenarios` | `co`, `dis`, `sup`, assumptions, `theta`, and `demand_by_cluster`. | `ScenarioId` |
| `sdg_links` | One SDG claim. `subject_kind` is `occupation` or `skill`, with exactly one of those foreign keys set. | `SdgLink` (`subject`, `kind`, `tier`, `target`, `Source`) |
| `courses` | Curated course. `languages` is a non-empty list of `en`, `ms`, `zh`. `mode` is `online`, `physical`, or `hybrid`. | `Course` |
| `programs` | Government programme. `eligibility` is the section 07 object and `cost_type` is shared with courses. | `Programme` (`PlanStep.kind` is `program`) |
| `profiles` | Anonymous session: consent, `parsed`, `slots`. UI is English only, so there is no `locale` column. | `ParsedCV`, `PartialSlots` |
| `results` | One row per profile, scenario, and occupation. `exposure`/`augmentation`/`fit`/`demand`/`ranking` are the brief's E/G/F/D/R. | `RoleResult` (three rows make `byScenario`) |
| `pathways` | Saved steps for one profile and occupation. | `PathwayPlan` / `PlanStep` |
| `sources` | Reusable dataset metadata, with a licence that allows reuse. `name` is the natural key. Added in `20261021150000_seed_sources_exposure.sql`. | `SourceRow` (`scripts/lib/row-schemas.ts`) |
| `exposure` | One published exposure figure for one occupation, copied as published. Primary key `(occupation, source_name)`. Added in `20261021150000_seed_sources_exposure.sql`. | `ExposureRow` (`scripts/lib/row-schemas.ts`) |

## Notes the contracts file does not show yet

- Study languages live in `courses.languages` and `profiles.slots.languages`: `en`, `ms`, and `zh`, at least one when the slot is present. There is no `both`. The UI itself is English only, so there is no separate UI locale anywhere in the schema.
- `sdg_links` is one table, not two. `SdgLink.subject` is a single discriminator (`occupation` or `skill`), and the other columns (`target`, `kind`, `tier`, `confidence`, `reason`, source) are the same for both. A check constraint requires the matching foreign key and forbids the other. `kind` is still `role` or `transition`.
- `signals` rows are unique per skill, source, metric, and `window_end` — `signals_reading_key` (added in `20261021150000_seed_sources_exposure.sql`) enforces it, and `scripts/lib/apply.ts` upserts keywords.csv onto it since `signals.id` has no natural key of its own. `value` may be negative.
- `occupations.cluster` is `not null` with a check constraint restricting it to the five `ClusterId` values: `ai_digital`, `data_analytics`, `green_sustainability`, `human_care`, `routine_clerical`.
- `courses.skill_ids` is a text array, matching `Course.skillIds`. Postgres cannot foreign-key an array; the importer must use `skills.id`.
- Deleting a profile cascades to `results` and `pathways` (the delete-my-data path). There is no CV object to remove.
- Catalogue tables are world-readable by the `anon` key and not writable by it. `profiles`, `results`, and `pathways` have RLS on and no `anon` grant, so the Data API cannot touch them. Server route handlers use the service role, which bypasses RLS.

HNSW indexes use cosine (`vector_cosine_ops`) on `occupations.embedding` and `skills.embedding`. Both columns are `vector(768)`, matching `EMBEDDING_DIMENSIONS` in `contracts.ts`. Calls to the Gemini embedding model (`EMBEDDING_MODEL`, `gemini-embedding-001`) must set `outputDimensionality: 768` so the returned vector fits the column.
