-- Live arXiv trend snapshots written by POST /api/signals/refresh.
-- One row per refresh: the full keyword list (counts, windows, momentum) as
-- JSON, with the fetch time. The app reads the newest row; older rows are the
-- history ("store the fetch date with each snapshot").
-- Only route handlers (service role) read or write it: no anon grant, no policy.
create table if not exists public.trend_snapshots (
  id bigint generated always as identity primary key,
  source text not null default 'arXiv API',
  fetched_at timestamptz not null default now(),
  as_of date not null,
  keywords jsonb not null check (jsonb_typeof(keywords) = 'array'),
  refreshed jsonb not null default '[]'::jsonb check (jsonb_typeof(refreshed) = 'array')
);

create index if not exists trend_snapshots_fetched_at_idx on public.trend_snapshots (fetched_at desc);

alter table public.trend_snapshots enable row level security;
revoke all on public.trend_snapshots from anon, authenticated;
grant select, insert on public.trend_snapshots to service_role;
