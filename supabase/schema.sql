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

-- Server-only access used by the passcode app. Existing learner UUIDs are retained.
grant select, insert, update, delete on public.lessons, public.learner_state to service_role;

-- Durable attempt limits shared by all serverless instances.
create table if not exists public.passcode_attempts (
  bucket_key text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table public.passcode_attempts enable row level security;
revoke all on public.passcode_attempts from public, anon, authenticated;

create or replace function public.register_unlock_attempt(client_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  attempt_time timestamptz := clock_timestamp();
  current_bucket text;
  attempt_count integer;
begin
  if client_key is null or client_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  -- Lock the global bucket first to serialize concurrent claims consistently.
  foreach current_bucket in array array['global', 'client:' || client_key] loop
    insert into public.passcode_attempts as stored (bucket_key, window_start, attempts)
      values (current_bucket, attempt_time, 1)
    on conflict (bucket_key) do update set
      window_start = case when stored.window_start <= attempt_time - interval '15 minutes'
        then attempt_time else stored.window_start end,
      attempts = case when stored.window_start <= attempt_time - interval '15 minutes'
        then 1 else stored.attempts + 1 end
    returning attempts into attempt_count;
    if attempt_count > (case when current_bucket = 'global' then 100 else 5 end) then
      return false;
    end if;
  end loop;
  delete from public.passcode_attempts where window_start < attempt_time - interval '1 day';
  return true;
end;
$function$;
revoke all on function public.register_unlock_attempt(text) from public, anon, authenticated;
grant execute on function public.register_unlock_attempt(text) to service_role;
