-- Threadline account schema.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste
-- -> Run. It is safe to run again; every statement is guarded.
--
-- Stage one covers accounts only. Wardrobe data still lives on the phone, so
-- there are no item tables here yet.

-- ── profiles ────────────────────────────────────────────────────────────
-- One row per account, keyed to the auth user. Deleting the auth user cascades
-- here, so "delete my account" really removes everything.
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  username      text unique not null,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- 3-20 characters, letters/numbers/underscore, stored lower case so that
  -- "Ingrid" and "ingrid" cannot both be taken.
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint display_name_length check (char_length(display_name) between 1 and 40)
);

-- ── row level security ──────────────────────────────────────────────────
-- Without this every profile would be readable by anyone holding the anon key,
-- which ships inside the app.
alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by their owner" on public.profiles;
create policy "profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "a user may create their own profile" on public.profiles;
create policy "a user may create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "a user may update their own profile" on public.profiles;
create policy "a user may update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── username availability ───────────────────────────────────────────────
-- The sign-up screen needs to check a name before the profile row exists, but
-- row level security correctly hides other people's rows. This function runs
-- with the definer's rights and answers only yes or no — it never exposes who
-- holds the name.
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where username = lower(candidate));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ── keep updated_at honest ──────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
