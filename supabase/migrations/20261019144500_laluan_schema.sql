-- Laluan schema (T05).
--
-- No logins and no CV storage: profiles are anonymous sessions, with no
-- user_id, no auth.users foreign key, and no cv_path. Catalogue reads go
-- through the anon key; route handlers write with the service role.
--
-- JSON stored for the API keeps the key casing in src/types/contracts.ts
-- (snake_case slots and eligibility, camelCase scores, gaps, sources, and
-- plan steps) so a handler can Zod-parse a row without renaming keys.
--
-- contracts.ts (src/types/contracts.ts) matches this migration: `languages`
-- is a list of en|ms|zh (no singular `language`, no `both`), and
-- MAX_INTERVIEW_TURNS is 5.

create extension if not exists vector;

-- Supabase hosts these roles. Create them only on a bare Postgres so this
-- file also applies in local validation. Do not alter them when they exist.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists internal;

comment on schema internal is
  'Check helpers for Laluan. Not a Data API schema.';

revoke all on schema internal from public;

-- ---------------------------------------------------------------------------
-- Check helpers. Argument-only, so they are safe inside CHECK constraints.
-- ---------------------------------------------------------------------------

create function internal.language_list_valid(codes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    codes is not null
    and cardinality(codes) >= 1
    and cardinality(codes) = (
      select count(*)
      from unnest(codes) as lang
      where lang in ('en', 'ms', 'zh')
    )
    and cardinality(codes) = (
      select count(distinct lang)
      from unnest(codes) as lang
    );
$$;

create function internal.jsonb_string_list_valid(items jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
begin
  if jsonb_typeof(items) is distinct from 'array' then
    return false;
  end if;
  for item in select value from jsonb_array_elements(items) as element(value)
  loop
    if jsonb_typeof(item) is distinct from 'string' or length(item #>> '{}') < 1 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function internal.jsonb_language_list_valid(codes jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  texts text[] := '{}';
begin
  if jsonb_typeof(codes) is distinct from 'array' then
    return false;
  end if;
  for item in select value from jsonb_array_elements(codes) as element(value)
  loop
    if jsonb_typeof(item) is distinct from 'string' then
      return false;
    end if;
    texts := texts || (item #>> '{}');
  end loop;
  return internal.language_list_valid(texts);
end;
$$;

create function internal.http_url(url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select url ~ '^https://[^[:space:]]+$';
$$;

create function internal.iso_date_text(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  perform value::date;
  return true;
exception
  when others then
    return false;
end;
$$;

create function internal.sdg_target_text(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^([1-9]|1[0-7])\.([1-9]|1[0-9]|[a-z])$';
$$;

create function internal.text_id_list_valid(ids text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    ids is not null
    and not exists (
      select 1
      from unnest(ids) as id
      where id is null or length(btrim(id)) = 0
    );
$$;

create function internal.demand_by_cluster_valid(demand jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  entry record;
begin
  if demand is null or jsonb_typeof(demand) is distinct from 'object' then
    return false;
  end if;
  for entry in select key, value from jsonb_each(demand)
  loop
    if length(entry.key) < 1 or jsonb_typeof(entry.value) is distinct from 'number' then
      return false;
    end if;
    if (entry.value #>> '{}')::numeric < 0 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Section 07 eligibility. Null turns a rule off. "any" and "all" stand alone.
create function internal.programme_eligibility_valid(rules jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  key text;
  item jsonb;
  employment_count integer;
  state_count integer;
  has_any boolean := false;
  has_all boolean := false;
  allowed text[] := array[
    'age_min', 'age_max', 'citizen', 'employment', 'perkeso_contributor', 'states'
  ];
  statuses text[] := array[
    'employed', 'underemployed', 'unemployed', 'student', 'self_employed', 'any'
  ];
  states text[] := array[
    'johor', 'kedah', 'kelantan', 'melaka', 'negeri_sembilan', 'pahang', 'perak',
    'perlis', 'pulau_pinang', 'sabah', 'sarawak', 'selangor', 'terengganu',
    'kuala_lumpur', 'labuan', 'putrajaya', 'all'
  ];
begin
  if rules is null or jsonb_typeof(rules) is distinct from 'object' then
    return false;
  end if;

  for key in select object_key from jsonb_object_keys(rules) as object_key
  loop
    if not (key = any (allowed)) then
      return false;
    end if;
  end loop;

  if not (rules ?& allowed) then
    return false;
  end if;

  if jsonb_typeof(rules -> 'age_min') = 'number' then
    if (rules ->> 'age_min') !~ '^(0|[1-9][0-9]*)$' then
      return false;
    end if;
  elsif jsonb_typeof(rules -> 'age_min') is distinct from 'null' then
    return false;
  end if;

  if jsonb_typeof(rules -> 'age_max') = 'number' then
    if (rules ->> 'age_max') !~ '^(0|[1-9][0-9]*)$' then
      return false;
    end if;
  elsif jsonb_typeof(rules -> 'age_max') is distinct from 'null' then
    return false;
  end if;

  if jsonb_typeof(rules -> 'age_min') = 'number'
     and jsonb_typeof(rules -> 'age_max') = 'number'
     and (rules ->> 'age_min')::numeric > (rules ->> 'age_max')::numeric then
    return false;
  end if;

  if jsonb_typeof(rules -> 'citizen') not in ('boolean', 'null') then
    return false;
  end if;
  if jsonb_typeof(rules -> 'perkeso_contributor') not in ('boolean', 'null') then
    return false;
  end if;

  if jsonb_typeof(rules -> 'employment') is distinct from 'array'
     or jsonb_array_length(rules -> 'employment') < 1 then
    return false;
  end if;
  employment_count := jsonb_array_length(rules -> 'employment');
  for item in
    select value from jsonb_array_elements(rules -> 'employment') as element(value)
  loop
    if jsonb_typeof(item) is distinct from 'string' or not ((item #>> '{}') = any (statuses)) then
      return false;
    end if;
    if (item #>> '{}') = 'any' then
      has_any := true;
    end if;
  end loop;
  if has_any and employment_count > 1 then
    return false;
  end if;

  if jsonb_typeof(rules -> 'states') is distinct from 'array'
     or jsonb_array_length(rules -> 'states') < 1 then
    return false;
  end if;
  state_count := jsonb_array_length(rules -> 'states');
  for item in
    select value from jsonb_array_elements(rules -> 'states') as element(value)
  loop
    if jsonb_typeof(item) is distinct from 'string' or not ((item #>> '{}') = any (states)) then
      return false;
    end if;
    if (item #>> '{}') = 'all' then
      has_all := true;
    end if;
  end loop;
  if has_all and state_count > 1 then
    return false;
  end if;

  return true;
end;
$$;

-- PartialSlots. `languages` is a list of en|ms|zh. The old singular `language`
-- key (and "both") is rejected. Omitted keys stay unknown.
create function internal.profile_slots_valid(slots jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  key text;
  item jsonb;
  allowed text[] := array[
    'tasks', 'tools', 'ai_usage', 'hours_per_week', 'budget', 'languages',
    'age_band', 'state', 'employment_status', 'perkeso_contributor', 'impact_interest'
  ];
begin
  if slots is null then
    return true;
  end if;
  if jsonb_typeof(slots) is distinct from 'object' then
    return false;
  end if;
  if slots ? 'language' or slots ? 'user_id' or slots ? 'cv_path' then
    return false;
  end if;

  for key in select object_key from jsonb_object_keys(slots) as object_key
  loop
    if not (key = any (allowed)) then
      return false;
    end if;
  end loop;

  if slots ? 'languages' and not internal.jsonb_language_list_valid(slots -> 'languages') then
    return false;
  end if;

  if slots ? 'ai_usage' and (
    jsonb_typeof(slots -> 'ai_usage') is distinct from 'string'
    or (slots ->> 'ai_usage') not in ('none', 'tried', 'occasional', 'regular')
  ) then
    return false;
  end if;

  if slots ? 'hours_per_week' and (
    jsonb_typeof(slots -> 'hours_per_week') is distinct from 'number'
    or (slots ->> 'hours_per_week')::numeric < 0
    or (slots ->> 'hours_per_week')::numeric > 168
  ) then
    return false;
  end if;

  if slots ? 'budget' and (
    jsonb_typeof(slots -> 'budget') is distinct from 'number'
    or (slots ->> 'budget')::numeric < 0
  ) then
    return false;
  end if;

  if slots ? 'age_band' and (
    jsonb_typeof(slots -> 'age_band') is distinct from 'string'
    or (slots ->> 'age_band') not in ('18-24', '25-29', '30-34', '35-44', '45-54', '55+')
  ) then
    return false;
  end if;

  if slots ? 'state' and (
    jsonb_typeof(slots -> 'state') is distinct from 'string'
    or (slots ->> 'state') not in (
      'johor', 'kedah', 'kelantan', 'melaka', 'negeri_sembilan', 'pahang', 'perak',
      'perlis', 'pulau_pinang', 'sabah', 'sarawak', 'selangor', 'terengganu',
      'kuala_lumpur', 'labuan', 'putrajaya'
    )
  ) then
    return false;
  end if;

  if slots ? 'employment_status' and (
    jsonb_typeof(slots -> 'employment_status') is distinct from 'string'
    or (slots ->> 'employment_status') not in (
      'employed', 'underemployed', 'unemployed', 'student', 'self_employed'
    )
  ) then
    return false;
  end if;

  if slots ? 'perkeso_contributor'
     and jsonb_typeof(slots -> 'perkeso_contributor') is distinct from 'boolean' then
    return false;
  end if;

  if slots ? 'impact_interest' and (
    jsonb_typeof(slots -> 'impact_interest') is distinct from 'string'
    or (slots ->> 'impact_interest') not in (
      'environment', 'education', 'health', 'community', 'none'
    )
  ) then
    return false;
  end if;

  if slots ? 'tools' then
    if not internal.jsonb_string_list_valid(slots -> 'tools') then
      return false;
    end if;
  end if;

  if slots ? 'tasks' then
    if jsonb_typeof(slots -> 'tasks') is distinct from 'array' then
      return false;
    end if;
    for item in select value from jsonb_array_elements(slots -> 'tasks') as element(value)
    loop
      if jsonb_typeof(item) is distinct from 'object' then
        return false;
      end if;
      if exists (
        select 1
        from jsonb_object_keys(item) as object_key
        where object_key not in ('text', 'share')
      ) or not (item ? 'text' and item ? 'share') then
        return false;
      end if;
      if jsonb_typeof(item -> 'text') is distinct from 'string' or length(item ->> 'text') < 1 then
        return false;
      end if;
      if jsonb_typeof(item -> 'share') is distinct from 'number'
         or (item ->> 'share')::numeric < 0
         or (item ->> 'share')::numeric > 1 then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

create function internal.parsed_cv_valid(parsed jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  key text;
  item jsonb;
  allowed text[] := array['name', 'roles', 'skills', 'education', 'languages'];
begin
  if parsed is null then
    return true;
  end if;
  if jsonb_typeof(parsed) is distinct from 'object' then
    return false;
  end if;
  if parsed ? 'cv_path' or parsed ? 'user_id' then
    return false;
  end if;

  for key in select object_key from jsonb_object_keys(parsed) as object_key
  loop
    if not (key = any (allowed)) then
      return false;
    end if;
  end loop;

  if not (parsed ?& array['roles', 'skills', 'education', 'languages']) then
    return false;
  end if;

  if parsed ? 'name' and (
    jsonb_typeof(parsed -> 'name') is distinct from 'string' or length(parsed ->> 'name') < 1
  ) then
    return false;
  end if;

  if not internal.jsonb_string_list_valid(parsed -> 'skills')
     or not internal.jsonb_string_list_valid(parsed -> 'languages') then
    return false;
  end if;

  if jsonb_typeof(parsed -> 'roles') is distinct from 'array'
     or jsonb_typeof(parsed -> 'education') is distinct from 'array' then
    return false;
  end if;

  for item in select value from jsonb_array_elements(parsed -> 'roles') as element(value)
  loop
    if jsonb_typeof(item) is distinct from 'object' then
      return false;
    end if;
    if exists (
      select 1
      from jsonb_object_keys(item) as object_key
      where object_key not in ('title', 'years', 'tasks')
    ) or not (item ?& array['title', 'years', 'tasks']) then
      return false;
    end if;
    if jsonb_typeof(item -> 'title') is distinct from 'string' or length(item ->> 'title') < 1 then
      return false;
    end if;
    if jsonb_typeof(item -> 'years') is distinct from 'number' or (item ->> 'years')::numeric < 0 then
      return false;
    end if;
    if not internal.jsonb_string_list_valid(item -> 'tasks') then
      return false;
    end if;
  end loop;

  for item in select value from jsonb_array_elements(parsed -> 'education') as element(value)
  loop
    if jsonb_typeof(item) is distinct from 'object' then
      return false;
    end if;
    if exists (
      select 1
      from jsonb_object_keys(item) as object_key
      where object_key not in ('level', 'field')
    ) or not (item ?& array['level', 'field']) then
      return false;
    end if;
    if jsonb_typeof(item -> 'level') is distinct from 'string' or length(item ->> 'level') < 1 then
      return false;
    end if;
    if jsonb_typeof(item -> 'field') is distinct from 'string' or length(item ->> 'field') < 1 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create function internal.gap_list_valid(gap jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
begin
  if jsonb_typeof(gap) is distinct from 'array' or jsonb_array_length(gap) > 5 then
    return false;
  end if;
  for item in select value from jsonb_array_elements(gap) as element(value)
  loop
    if jsonb_typeof(item) is distinct from 'object' then
      return false;
    end if;
    if exists (
      select 1
      from jsonb_object_keys(item) as object_key
      where object_key not in ('skillId', 'label', 'importance')
    ) or not (item ?& array['skillId', 'label', 'importance']) then
      return false;
    end if;
    if jsonb_typeof(item -> 'skillId') is distinct from 'string' or length(item ->> 'skillId') < 1 then
      return false;
    end if;
    if jsonb_typeof(item -> 'label') is distinct from 'string' or length(item ->> 'label') < 1 then
      return false;
    end if;
    if jsonb_typeof(item -> 'importance') is distinct from 'number'
       or (item ->> 'importance')::numeric < 0 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function internal.source_list_valid(sources jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
begin
  if jsonb_typeof(sources) is distinct from 'array' or jsonb_array_length(sources) < 1 then
    return false;
  end if;
  for item in select value from jsonb_array_elements(sources) as element(value)
  loop
    if jsonb_typeof(item) is distinct from 'object' then
      return false;
    end if;
    if exists (
      select 1
      from jsonb_object_keys(item) as object_key
      where object_key not in ('dataset', 'releaseDate', 'url', 'asOf')
    ) or not (item ?& array['dataset', 'releaseDate', 'url', 'asOf']) then
      return false;
    end if;
    if jsonb_typeof(item -> 'dataset') is distinct from 'string' or length(item ->> 'dataset') < 1 then
      return false;
    end if;
    if not internal.iso_date_text(item ->> 'releaseDate') or not internal.iso_date_text(item ->> 'asOf') then
      return false;
    end if;
    if not internal.http_url(item ->> 'url') then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function internal.pathway_steps_valid(steps jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  step jsonb;
  skill jsonb;
begin
  if jsonb_typeof(steps) is distinct from 'array' then
    return false;
  end if;
  for step in select value from jsonb_array_elements(steps) as element(value)
  loop
    if jsonb_typeof(step) is distinct from 'object' then
      return false;
    end if;
    if exists (
      select 1
      from jsonb_object_keys(step) as object_key
      where object_key not in (
        'itemId', 'kind', 'weekStart', 'weekEnd', 'closesSkillIds', 'sdgTarget', 'why'
      )
    ) or not (
      step ?& array['itemId', 'kind', 'weekStart', 'weekEnd', 'closesSkillIds', 'why']
    ) then
      return false;
    end if;
    if jsonb_typeof(step -> 'itemId') is distinct from 'string' or length(step ->> 'itemId') < 1 then
      return false;
    end if;
    if jsonb_typeof(step -> 'kind') is distinct from 'string'
       or (step ->> 'kind') not in ('course', 'program') then
      return false;
    end if;
    if jsonb_typeof(step -> 'weekStart') is distinct from 'number'
       or (step ->> 'weekStart') !~ '^[1-9][0-9]*$'
       or jsonb_typeof(step -> 'weekEnd') is distinct from 'number'
       or (step ->> 'weekEnd') !~ '^[1-9][0-9]*$'
       or (step ->> 'weekEnd')::numeric < (step ->> 'weekStart')::numeric then
      return false;
    end if;
    if jsonb_typeof(step -> 'closesSkillIds') is distinct from 'array' then
      return false;
    end if;
    for skill in
      select value from jsonb_array_elements(step -> 'closesSkillIds') as element(value)
    loop
      if jsonb_typeof(skill) is distinct from 'string' or length(skill #>> '{}') < 1 then
        return false;
      end if;
    end loop;
    if step ? 'sdgTarget' and (
      jsonb_typeof(step -> 'sdgTarget') is distinct from 'string'
      or not internal.sdg_target_text(step ->> 'sdgTarget')
    ) then
      return false;
    end if;
    if jsonb_typeof(step -> 'why') is distinct from 'string' or length(step ->> 'why') < 1 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on all functions in schema internal from public;

-- ---------------------------------------------------------------------------
-- Catalogue. Public read (see the RLS migration). Text ids match the
-- contract ids the API already uses (occupationId, skillId, course id).
-- ---------------------------------------------------------------------------

create table public.occupations (
  id text primary key check (length(btrim(id)) > 0),
  esco_uri text unique,
  isco_code text,
  title_en text not null check (length(btrim(title_en)) > 0),
  title_ms text not null check (length(btrim(title_ms)) > 0),
  description text not null default '',
  cluster text not null check (
    cluster in (
      'ai_digital', 'data_analytics', 'green_sustainability', 'human_care', 'routine_clerical'
    )
  ),
  is_emerging boolean not null default false,
  embedding vector(768),
  created_at timestamptz not null default now()
);

comment on table public.occupations is
  'ESCO occupation. id is RoleResult.occupationId. embedding is Gemini 768-d.';

comment on column public.occupations.cluster is
  'Key into scenarios.demand_by_cluster. One of ai_digital, data_analytics, green_sustainability, human_care, routine_clerical (contracts.ts ClusterId).';

create table public.skills (
  id text primary key check (length(btrim(id)) > 0),
  esco_uri text unique,
  label_en text not null check (length(btrim(label_en)) > 0),
  label_ms text not null check (length(btrim(label_ms)) > 0),
  is_green boolean not null default false,
  base_importance numeric not null check (base_importance >= 0),
  embedding vector(768),
  created_at timestamptz not null default now()
);

comment on table public.skills is
  'ESCO skill. id is GapSkill.skillId and Course.skillIds.';

create table public.occupation_skills (
  occupation_id text not null references public.occupations (id) on delete cascade,
  skill_id text not null references public.skills (id) on delete cascade,
  relation text not null check (relation in ('essential', 'optional')),
  created_at timestamptz not null default now(),
  primary key (occupation_id, skill_id)
);

comment on table public.occupation_skills is
  'Essential or optional ESCO skill for an occupation. Essential skills feed the gap.';

create table public.tasks (
  id bigint generated always as identity primary key,
  occupation_id text not null references public.occupations (id) on delete cascade,
  text text not null check (length(btrim(text)) > 0),
  onet_task_id text,
  automation numeric check (automation is null or (automation >= 0 and automation <= 1)),
  augmentation numeric check (augmentation is null or (augmentation >= 0 and augmentation <= 1)),
  source text not null check (length(btrim(source)) > 0),
  as_of date not null,
  created_at timestamptz not null default now()
);

comment on table public.tasks is
  'O*NET task with Economic Index automation/augmentation shares, or an ILO fallback.';

create table public.signals (
  id bigint generated always as identity primary key,
  skill_id text not null references public.skills (id) on delete cascade,
  source text not null check (source = 'arXiv'),
  metric text not null check (length(btrim(metric)) > 0),
  value numeric not null,
  window_start date not null,
  window_end date not null,
  as_of date not null,
  url text not null check (internal.http_url(url)),
  created_at timestamptz not null default now(),
  check (window_start <= window_end),
  unique (skill_id, source, metric, window_start, window_end, as_of)
);

comment on table public.signals is
  'SignalReading plus as_of, so two snapshots (for example today and 30 days ago) can both be stored. Source is arXiv only for now.';

create table public.scenarios (
  id text primary key check (id in ('co', 'dis', 'sup')),
  name text not null check (length(btrim(name)) > 0),
  assumptions_en text not null,
  assumptions_ms text not null,
  theta numeric not null check (theta >= 0),
  demand_by_cluster jsonb not null check (internal.demand_by_cluster_valid(demand_by_cluster)),
  created_at timestamptz not null default now()
);

comment on table public.scenarios is
  'ScenarioId co | dis | sup. theta is the exposure penalty. demand_by_cluster feeds D.';

-- One table for SdgLink. subject_kind is SdgLink.subject.kind (occupation | skill).
-- kind is the other axis: role (the work) or transition (the move).
create table public.sdg_links (
  id bigint generated always as identity primary key,
  subject_kind text not null check (subject_kind in ('occupation', 'skill')),
  occupation_id text references public.occupations (id) on delete cascade,
  skill_id text references public.skills (id) on delete cascade,
  target text not null check (internal.sdg_target_text(target)),
  kind text not null check (kind in ('role', 'transition')),
  tier text not null check (tier in ('direct', 'supporting', 'inferred')),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  reason text not null check (length(btrim(reason)) > 0),
  source_dataset text not null check (length(btrim(source_dataset)) > 0),
  source_release_date date not null,
  source_url text not null check (internal.http_url(source_url)),
  source_as_of date not null,
  created_at timestamptz not null default now(),
  check (
    (
      subject_kind = 'occupation'
      and occupation_id is not null
      and skill_id is null
    )
    or (
      subject_kind = 'skill'
      and skill_id is not null
      and occupation_id is null
    )
  )
);

comment on table public.sdg_links is
  'SdgLink for an occupation or a skill. source_* maps to Source (dataset, releaseDate, url, asOf).';

create table public.courses (
  id text primary key check (length(btrim(id)) > 0),
  title text not null check (length(btrim(title)) > 0),
  provider text not null check (length(btrim(provider)) > 0),
  url text not null check (internal.http_url(url)),
  languages text[] not null check (internal.language_list_valid(languages)),
  hours numeric not null check (hours > 0),
  cost_type text not null check (cost_type in ('free', 'subsidised', 'hrdcorp_claimable', 'paid')),
  certificate boolean not null,
  skill_ids text[] not null default '{}' check (internal.text_id_list_valid(skill_ids)),
  last_checked date not null,
  created_at timestamptz not null default now()
);

comment on table public.courses is
  'Course. languages is en|ms|zh (at least one). skill_ids are skills.id values. cost_type is CostType.';

comment on column public.courses.skill_ids is
  'Course.skillIds. A text array cannot reference skills(id); the importer checks each id.';

create table public.programs (
  id text primary key check (length(btrim(id)) > 0),
  name text not null check (length(btrim(name)) > 0),
  agency text not null check (length(btrim(agency)) > 0),
  url text not null check (internal.http_url(url)),
  benefits text not null check (length(btrim(benefits)) > 0),
  eligibility jsonb not null check (internal.programme_eligibility_valid(eligibility)),
  cost_type text not null check (cost_type in ('free', 'subsidised', 'hrdcorp_claimable', 'paid')),
  deadline date,
  last_checked date not null,
  created_at timestamptz not null default now()
);

comment on table public.programs is
  'Programme (table name matches the brief). eligibility is ProgrammeEligibility. PlanStep.kind for a row here is "program".';

-- ---------------------------------------------------------------------------
-- Anonymous session data. No anon policies: only the service role touches these.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  consent_at timestamptz,
  parsed jsonb check (internal.parsed_cv_valid(parsed)),
  slots jsonb check (internal.profile_slots_valid(slots)),
  created_at timestamptz not null default now(),
  check (parsed is null or consent_at is not null)
);

comment on table public.profiles is
  'Anonymous session. No user_id and no cv_path. parsed is ParsedCV. slots is PartialSlots, with languages as a list.';

comment on column public.profiles.slots is
  'PartialSlots. languages, when present, is a non-empty list of en, ms, zh. The singular language key is not stored.';

create table public.results (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  scenario_id text not null references public.scenarios (id),
  occupation_id text not null references public.occupations (id),
  exposure numeric not null check (exposure >= 0 and exposure <= 1),
  augmentation numeric not null check (augmentation >= 0 and augmentation <= 1),
  fit numeric not null check (fit >= 0 and fit <= 1),
  demand numeric not null,
  ranking numeric not null,
  gap jsonb not null check (internal.gap_list_valid(gap)),
  robust boolean not null,
  sources jsonb not null check (internal.source_list_valid(sources)),
  signals_as_of date not null,
  explanation text check (explanation is null or length(explanation) > 0),
  created_at timestamptz not null default now(),
  unique (profile_id, scenario_id, occupation_id)
);

comment on table public.results is
  'One scenario row of a role card. exposure/augmentation/fit/demand/ranking are the brief E/G/F/D/R. Group three rows into RoleResult.byScenario.';

comment on column public.results.exposure is 'Brief column E. RoleResult.exposure.';
comment on column public.results.augmentation is 'Brief column G. RoleResult.augmentation.';
comment on column public.results.fit is 'Brief column F. RoleResult.fit.';
comment on column public.results.demand is 'Brief column D. Cluster demand in this scenario.';
comment on column public.results.ranking is 'Brief column R. RoleResult.byScenario for this scenario_id. Not clamped.';
comment on column public.results.signals_as_of is 'RoleResult.signalsAsOf. The snapshot date this ranking used.';

create table public.pathways (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  occupation_id text not null references public.occupations (id),
  steps jsonb not null check (internal.pathway_steps_valid(steps)),
  created_at timestamptz not null default now()
);

comment on table public.pathways is
  'Saved PathwayPlan for one profile. steps are PlanStep objects (kind course | program). URLs are not stored.';

-- ---------------------------------------------------------------------------
-- Indexes. Postgres does not index foreign keys on its own.
-- HNSW cosine matches the Gemini embedding distance used at match time.
-- ---------------------------------------------------------------------------

create index occupations_cluster_idx on public.occupations (cluster);
create index occupations_embedding_hnsw_idx
  on public.occupations
  using hnsw (embedding vector_cosine_ops);

create index skills_embedding_hnsw_idx
  on public.skills
  using hnsw (embedding vector_cosine_ops);

create index occupation_skills_skill_id_idx on public.occupation_skills (skill_id);

create index tasks_occupation_id_idx on public.tasks (occupation_id);

create index signals_skill_id_idx on public.signals (skill_id);
create index signals_as_of_idx on public.signals (as_of);

create index sdg_links_occupation_id_idx
  on public.sdg_links (occupation_id)
  where occupation_id is not null;
create index sdg_links_skill_id_idx
  on public.sdg_links (skill_id)
  where skill_id is not null;
create index sdg_links_target_idx on public.sdg_links (target);

create index courses_languages_gin_idx on public.courses using gin (languages);
create index courses_skill_ids_gin_idx on public.courses using gin (skill_ids);
create index courses_cost_type_idx on public.courses (cost_type);

create index programs_cost_type_idx on public.programs (cost_type);

create index results_profile_id_idx on public.results (profile_id);
create index results_occupation_id_idx on public.results (occupation_id);
create index results_signals_as_of_idx on public.results (signals_as_of);

create index pathways_profile_id_idx on public.pathways (profile_id, created_at desc);
create index pathways_occupation_id_idx on public.pathways (occupation_id);
