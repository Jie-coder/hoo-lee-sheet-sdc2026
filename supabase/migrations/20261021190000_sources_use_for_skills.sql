-- Re-runnable: drops and re-adds one check constraint.
--
-- Lets public.sources hold a skills taxonomy (ESCO), the source of
-- occupation_skills.csv (scripts/fetch-esco-skills.ts). Until now use_for only
-- allowed exposure / trend / scenario, so ESCO could not be listed honestly.
-- Mirrors SOURCE_USES in scripts/lib/row-schemas.ts.
--
-- sources_use_for_check is the name Postgres gave the inline column check in
-- migration 20261021150000_seed_sources_exposure.sql.

alter table public.sources drop constraint if exists sources_use_for_check;

alter table public.sources
  add constraint sources_use_for_check
  check (use_for in ('exposure', 'trend', 'scenario', 'skills'));
