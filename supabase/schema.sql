-- Documents the test table used by /api/items. The team Supabase project already has it;
-- run this once in the Supabase SQL editor only when setting up a new project.
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  data jsonb
);

-- Turn on Row Level Security with no policies: the public (anon) key cannot read
-- or write this table. Our API routes use the service role key on the server,
-- which bypasses RLS, so the app still works.
alter table items enable row level security;
