-- Re-runnable: every statement is idempotent (if not exists / drop ... if exists).
-- NOT applied to the live project yet: apply it before running
-- scripts/import-data.ts --apply, or the cluster_demand upsert fails (apply.ts
-- says so in its report and carries on with the other tables).
--
-- Adds public.cluster_demand, the home for data/demand.csv: Malaysian
-- labour-market figures (OpenDOSM) per ISCO major group, as they apply to
-- each of our five clusters, copied as published. The cluster demand D that
-- scoring uses is computed from these rows and scenarios.csv
-- (scripts/lib/scenario-demand.ts) and stored in scenarios.demand_by_cluster;
-- this table keeps the source figures so every D can be traced back.
-- Column names mirror DemandRowSchema in scripts/lib/row-schemas.ts.
--
-- Also lets public.sources.use_for say 'demand' (labour-market data), so
-- OpenDOSM can be listed honestly. Mirrors SOURCE_USES in row-schemas.ts.

create table if not exists public.cluster_demand (
  cluster text not null check (
    cluster in ('ai_digital', 'data_analytics', 'green_sustainability', 'human_care', 'routine_clerical')
  ),
  isco_major_group text not null check (isco_major_group ~ '^[0-9]$'),
  metric text not null check (length(btrim(metric)) > 0),
  value numeric not null check (value >= 0),
  period text not null check (period ~ '^\d{4}(-Q[1-4]|-(0[1-9]|1[0-2]))?$'),
  prev_value numeric not null check (prev_value > 0),
  prev_period text not null check (prev_period ~ '^\d{4}(-Q[1-4]|-(0[1-9]|1[0-2]))?$'),
  source_name text not null references public.sources (name),
  source_url text not null check (internal.http_url(source_url)),
  table_or_dataset text not null check (length(btrim(table_or_dataset)) > 0),
  as_of date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (cluster, isco_major_group, metric, period),
  check (prev_period < period)
);

comment on table public.cluster_demand is
  'DemandRow: one published labour-market figure (value, and prev_value one period earlier) for an ISCO major group, in one cluster. Copied as published by scripts/fetch-dosm-demand.ts, never computed.';

alter table public.sources drop constraint if exists sources_use_for_check;

alter table public.sources
  add constraint sources_use_for_check
  check (use_for in ('exposure', 'trend', 'scenario', 'skills', 'demand'));

-- RLS: public read, no client writes. Same pattern as sources / exposure in
-- 20261021150000_seed_sources_exposure.sql.
alter table public.cluster_demand enable row level security;
revoke all on table public.cluster_demand from public, anon, authenticated;
grant select on table public.cluster_demand to anon;
drop policy if exists cluster_demand_anon_select on public.cluster_demand;
create policy cluster_demand_anon_select on public.cluster_demand for select to anon using (true);

comment on policy cluster_demand_anon_select on public.cluster_demand is
  'Reference data. anon may read every row. Writes stay on the service role.';

grant select, insert, update, delete on table public.cluster_demand to service_role;
