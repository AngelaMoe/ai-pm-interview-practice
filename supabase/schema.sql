-- supabase/schema.sql
-- Learn mode: anonymous progress and per-concept mastery.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent.
--
-- Access model: only the Express server reads and writes these tables, using the
-- secret (service role) key, which bypasses row-level security. RLS is enabled
-- with NO policies, and table privileges are granted explicitly to service_role
-- only, so the browser-facing anon/publishable key can't read or write anything.
--
-- Written for a project with "Automatically expose new tables" OFF: new tables
-- get no grants for the API roles, so service_role must be granted here.
-- Without these grants the server gets "permission denied" (RLS bypass doesn't
-- skip table privileges).

create table if not exists public.learners (
  anon_id      uuid primary key,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.concept_mastery (
  anon_id     uuid not null references public.learners (anon_id) on delete cascade,
  concept_id  text not null,
  score       integer not null default 0 check (score between 0 and 100),
  -- true once the concept has been met in the fix-a-weak-answer or voice step
  applied_met boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (anon_id, concept_id),
  -- A concept can't reach mastery (70+) from quiz answers alone
  constraint mastery_requires_applied_step check (applied_met or score <= 69)
);

create table if not exists public.lesson_progress (
  anon_id      uuid not null references public.learners (anon_id) on delete cascade,
  lesson_id    text not null,
  status       text not null check (status in ('started', 'completed')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  primary key (anon_id, lesson_id)
);

alter table public.learners        enable row level security;
alter table public.concept_mastery enable row level security;
alter table public.lesson_progress enable row level security;

-- Public API roles: no access at all (also undoes any grants from defaults)
revoke all on table public.learners        from anon, authenticated;
revoke all on table public.concept_mastery from anon, authenticated;
revoke all on table public.lesson_progress from anon, authenticated;

-- Server only: exactly what the routes use (reads and upserts). No DELETE:
-- nothing deletes rows yet, and ON DELETE CASCADE runs with the owner's rights.
revoke all on table public.learners        from service_role;
revoke all on table public.concept_mastery from service_role;
revoke all on table public.lesson_progress from service_role;
grant select, insert, update on table public.learners        to service_role;
grant select, insert, update on table public.concept_mastery to service_role;
grant select, insert, update on table public.lesson_progress to service_role;

-- Check after running (expect only service_role rows, with SELECT/INSERT/UPDATE):
-- select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('learners', 'concept_mastery', 'lesson_progress')
--   and grantee in ('anon', 'authenticated', 'service_role')
-- group by table_name, grantee order by table_name, grantee;

-- Unit completion rate (PRD success metric). Run ad hoc in the SQL Editor.
-- Deliberately not a view: views run with their owner's rights by default and
-- could expose data through the Data API.
--
-- select count(*) filter (where completed = 5)::float
--        / nullif(count(*) filter (where started_lesson_1), 0) as unit_completion_rate
-- from (
--   select anon_id,
--          count(*) filter (where status = 'completed') as completed,
--          bool_or(lesson_id = 'metrics-1')             as started_lesson_1
--   from public.lesson_progress
--   group by anon_id
-- ) per_learner;
