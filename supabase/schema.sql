-- Run once in the Supabase SQL Editor. Re-running is safe.
create table if not exists public.learner_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"cards":[],"dismissed":[],"read":[],"feedback":{}}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.lessons (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_date date not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_date)
);
alter table public.learner_state enable row level security;
alter table public.lessons enable row level security;
drop policy if exists "Own progress" on public.learner_state;
create policy "Own progress" on public.learner_state for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Read own lessons" on public.lessons;
create policy "Read own lessons" on public.lessons for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learner_state, public.lessons from anon;
grant select, insert, update, delete on public.learner_state to authenticated;
drop policy if exists "Insert own lessons" on public.lessons;
create policy "Insert own lessons" on public.lessons for insert to authenticated with check ((select auth.uid()) = user_id);
grant select, insert on public.lessons to authenticated;
