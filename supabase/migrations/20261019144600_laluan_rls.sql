-- Row Level Security for every Laluan table.
--
-- Grants and policies are both required. Supabase's default privileges hand
-- anon and authenticated select/insert/update/delete on new public tables.
-- A policy does not remove that grant. This migration revokes those grants,
-- then grants anon select on the catalogue only.
--
-- There is no login, so there is no auth.uid() policy. The anon key is the
-- public catalogue key. profiles, results, and pathways have no anon grant
-- and no policy, so the Data API cannot read or write them. Route handlers
-- use the service role, which bypasses RLS and still needs the grants below.
-- authenticated is revoked everywhere because this product does not sign
-- anyone in.

-- Catalogue: public read, no client writes.
do $$
declare
  catalogue_table text;
begin
  foreach catalogue_table in array array[
    'occupations',
    'skills',
    'occupation_skills',
    'tasks',
    'signals',
    'scenarios',
    'sdg_links',
    'courses',
    'programs'
  ]
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

comment on policy occupations_anon_select on public.occupations is
  'Reference data. anon may read every row. No insert, update, or delete policy, and those grants are revoked.';
comment on policy skills_anon_select on public.skills is
  'Reference data. anon may read every row. Writes stay on the service role.';
comment on policy occupation_skills_anon_select on public.occupation_skills is
  'Reference data. anon may read every row. Writes stay on the service role.';
comment on policy tasks_anon_select on public.tasks is
  'Reference data. anon may read every row. Writes stay on the service role.';
comment on policy signals_anon_select on public.signals is
  'Dated arXiv snapshots. anon may read them for the refresh view. Writes stay on the service role.';
comment on policy scenarios_anon_select on public.scenarios is
  'Scenario parameters. anon may read them. Writes stay on the service role.';
comment on policy sdg_links_anon_select on public.sdg_links is
  'Occupation and skill SDG claims. anon may read them. Writes stay on the service role.';
comment on policy courses_anon_select on public.courses is
  'Course catalogue. anon may read it. Writes stay on the service role.';
comment on policy programs_anon_select on public.programs is
  'Programme catalogue. anon may read it. Writes stay on the service role.';

-- Session data: the browser never queries these. Service role only.
alter table public.profiles enable row level security;
alter table public.results enable row level security;
alter table public.pathways enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.results from public, anon, authenticated;
revoke all on table public.pathways from public, anon, authenticated;

comment on table public.profiles is
  'Anonymous session. No user_id and no cv_path. parsed is ParsedCV. slots is PartialSlots, with languages as a list. RLS is on and anon has no grant: route handlers use the service role, which bypasses RLS.';

-- Identity sequences. anon must not mint ids; the service role inserts rows.
revoke all on sequence public.tasks_id_seq from anon, authenticated;
revoke all on sequence public.signals_id_seq from anon, authenticated;
revoke all on sequence public.sdg_links_id_seq from anon, authenticated;
revoke all on sequence public.results_id_seq from anon, authenticated;
revoke all on sequence public.pathways_id_seq from anon, authenticated;

grant usage, select on sequence public.tasks_id_seq to service_role;
grant usage, select on sequence public.signals_id_seq to service_role;
grant usage, select on sequence public.sdg_links_id_seq to service_role;
grant usage, select on sequence public.results_id_seq to service_role;
grant usage, select on sequence public.pathways_id_seq to service_role;

grant select, insert, update, delete on table
  public.occupations,
  public.skills,
  public.occupation_skills,
  public.tasks,
  public.signals,
  public.scenarios,
  public.sdg_links,
  public.courses,
  public.programs,
  public.profiles,
  public.results,
  public.pathways
to service_role;

-- Checks run as the inserting role. The service role is the inserter.
grant usage on schema internal to service_role;
grant execute on all functions in schema internal to service_role;
