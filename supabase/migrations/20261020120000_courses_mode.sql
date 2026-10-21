-- How a course is delivered: online, physical (in person), or hybrid.
-- Mirrors Course.mode / CourseModeSchema in src/types/contracts.ts.
-- Existing rows default to 'online'; the importer always writes the
-- value from courses.csv, so the default only covers rows added before this.

alter table public.courses
  add column mode text not null default 'online';

alter table public.courses
  add constraint courses_mode_check check (mode in ('online', 'physical', 'hybrid'));

comment on column public.courses.mode is
  'Course.mode: online, physical, or hybrid.';

create index courses_mode_idx on public.courses (mode);
