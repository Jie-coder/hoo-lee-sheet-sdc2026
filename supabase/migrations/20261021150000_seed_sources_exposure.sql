-- Adds a home for the two Henry-collected CSVs that have nowhere to land
-- yet: sources.csv (reusable dataset metadata) and exposure.csv (published
-- exposure figures, copied as-is). Column names and nullability mirror
-- SourceRowSchema / ExposureRowSchema in scripts/lib/row-schemas.ts.
--
-- sources.csv and exposure.csv are still not applied by
-- scripts/import-data.ts: see APPLY_SKIPPED_FILES in scripts/lib/apply.ts.
--
-- Also adds signals_reading_key, the unique constraint scripts/lib/apply.ts's
-- keywords.csv -> public.signals upsert relies on (onConflict
-- "skill_id,source,metric,window_end"). Until this migration is applied,
-- that upsert fails against the live DB, and apply.ts reports the failure
-- clearly instead of aborting the rest of the run.

create table public.sources (
  name text primary key check (length(btrim(name)) > 0),
  url text not null check (internal.http_url(url)),
  publisher text not null check (length(btrim(publisher)) > 0),
  what_it_measures text not null check (length(btrim(what_it_measures)) > 0),
  update_frequency text not null check (length(btrim(update_frequency)) > 0),
  last_updated date not null,
  data_format text not null check (data_format in ('API', 'CSV', 'PDF')),
  licence text not null check (length(btrim(licence)) > 0),
  use_for text not null check (use_for in ('exposure', 'trend', 'scenario')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.sources is
  'SourceRow: a reusable dataset, with a licence that allows reuse. name is the natural key sources.csv and exposure.csv both use.';

create table public.exposure (
  occupation_id text references public.occupations (id) on delete set null,
  occupation text not null check (length(btrim(occupation)) > 0),
  code text not null check (length(btrim(code)) > 0),
  exposure_value numeric not null,
  scale text not null check (length(btrim(scale)) > 0),
  source_name text not null references public.sources (name),
  source_url text not null check (internal.http_url(source_url)),
  table_or_page text not null default '',
  as_of date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (occupation, source_name)
);

comment on table public.exposure is
  'ExposureRow: one published exposure figure for one occupation, copied as published (never computed). occupation_id is filled in once a matching occupations row exists; code/occupation are kept as collected so a fuzzy match can still be audited. Primary key is (occupation, source_name): code+source_name has duplicates in real data (several occupations share one ISCO/ESCO code), occupation+source_name does not.';

comment on column public.exposure.occupation_id is
  'Nullable: exposure.csv is collected from Peter''s draft occupation list and may cite a code/title with no occupations row yet.';

alter table public.signals
  add constraint signals_reading_key unique (skill_id, source, metric, window_end);

comment on constraint signals_reading_key on public.signals is
  'Makes a signals row upsertable without inventing an id (signals.id has no natural key otherwise): one reading per skill, source, metric, and window_end.';

-- RLS: public read, no client writes. Same pattern as the catalogue tables
-- in 20261019144600_laluan_rls.sql.
do $$
declare
  catalogue_table text;
begin
  foreach catalogue_table in array array['sources', 'exposure']
  loop
    execute format('alter table public.%I enable row level security', catalogue_table);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      catalogue_table
    );
    execute format('grant select on table public.%I to anon', catalogue_table);
    execute format(
      'create policy %I on public.%I for select to anon using (true)',
      catalogue_table || '_anon_select',
      catalogue_table
    );
  end loop;
end
$$;

comment on policy sources_anon_select on public.sources is
  'Reference data. anon may read every row. Writes stay on the service role.';
comment on policy exposure_anon_select on public.exposure is
  'Reference data. anon may read every row. Writes stay on the service role.';

grant select, insert, update, delete on table public.sources, public.exposure to service_role;
