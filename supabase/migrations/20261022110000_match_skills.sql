-- match_skills (T06): nearest ESCO skill(s) by embedding cosine similarity,
-- for CV skills that the exact-label and synonym tiers in
-- src/lib/skill-match.ts could not resolve on their own.
--
-- similarity is 1 - cosine distance, so 1.0 is identical and the app's
-- SCORING_PARAMS.skillMatchCosine (0.82) threshold applies the same way
-- here as it does to the essential-skill match in scoring.ts.

create or replace function public.match_skills(
  query_embedding vector(768),
  match_count int default 1
)
returns table (id text, label_en text, similarity double precision)
language sql
stable
-- pgvector's `<=>` operator lives in the public schema, so search_path must
-- include it (an empty search_path would make `<=>` unresolvable).
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.label_en,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.skills s
  where s.embedding is not null
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

comment on function public.match_skills is
  'Nearest skills.embedding rows by cosine similarity. Used by /api/parse-cv to map unmatched raw CV skills to ESCO labels.';

-- Only the service role calls this (route handlers), same as every other write/RPC path.
grant execute on function public.match_skills(vector(768), int) to service_role;
