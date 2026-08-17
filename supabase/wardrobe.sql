-- Threadline wardrobe sync — stage two.
--
-- Run this in the Supabase SQL editor after schema.sql. Safe to run again.
--
-- Design notes:
--   * Every table carries user_id, and row level security restricts each row to
--     its owner. The anon key ships inside the app, so this is the only thing
--     standing between one account's wardrobe and another's.
--   * Ids are text, not sequences. Two phones offline at once must be able to
--     create rows without colliding, which an auto-incrementing integer cannot
--     guarantee.
--   * updated_at drives a last-write-wins merge; deleted_at is a tombstone.
--     Without tombstones a delete on one device is silently undone by the
--     other device pushing the row back.

-- ── items ───────────────────────────────────────────────────────────────
create table if not exists public.items (
  id           text not null,
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  brand        text,
  category     text not null,
  color        text,
  color_name   text,
  material     text,
  seasons      jsonb not null default '[]'::jsonb,
  formality    int  not null default 3,
  tags         jsonb not null default '[]'::jsonb,
  price        numeric not null default 0,
  image_uri    text,
  image_path   text,          -- storage object path, populated in stage three
  source_url   text,
  status       text not null default 'clean',
  wears        int  not null default 0,
  last_worn    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  primary key (user_id, id)
);

-- ── wear log ────────────────────────────────────────────────────────────
create table if not exists public.wear_log (
  id          text not null,
  user_id     uuid not null references auth.users on delete cascade,
  date        text not null,
  occasion    text,
  name        text,
  item_ids    jsonb not null default '[]'::jsonb,
  weather     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

-- ── feedback ────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id          text not null,
  user_id     uuid not null references auth.users on delete cascade,
  ts          text,
  occasion    text,
  verdict     text,
  item_names  jsonb not null default '[]'::jsonb,
  item_ids    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

-- ── saved outfits ───────────────────────────────────────────────────────
create table if not exists public.saved_outfits (
  id          text not null,
  user_id     uuid not null references auth.users on delete cascade,
  ts          text,
  name        text,
  occasion    text,
  item_ids    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

-- ── settings ────────────────────────────────────────────────────────────
-- Key/value, same shape as on the phone: style profile, appearance, defaults.
create table if not exists public.user_settings (
  user_id     uuid not null references auth.users on delete cascade,
  key         text not null,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, key)
);

-- ── row level security ──────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['items', 'wear_log', 'feedback', 'saved_outfits', 'user_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner reads %1$s" on public.%1$I', t);
    execute format(
      'create policy "owner reads %1$s" on public.%1$I for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "owner writes %1$s" on public.%1$I', t);
    execute format(
      'create policy "owner writes %1$s" on public.%1$I for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "owner updates %1$s" on public.%1$I', t);
    execute format(
      'create policy "owner updates %1$s" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "owner deletes %1$s" on public.%1$I', t);
    execute format(
      'create policy "owner deletes %1$s" on public.%1$I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ── pull efficiency ─────────────────────────────────────────────────────
-- Every sync asks "what changed since X", so index that path.
create index if not exists items_user_updated_idx on public.items (user_id, updated_at);
create index if not exists wear_log_user_updated_idx on public.wear_log (user_id, updated_at);
create index if not exists feedback_user_updated_idx on public.feedback (user_id, updated_at);
create index if not exists saved_outfits_user_updated_idx on public.saved_outfits (user_id, updated_at);
create index if not exists user_settings_user_updated_idx on public.user_settings (user_id, updated_at);

-- ── server clock ────────────────────────────────────────────────────────
-- The sync cursor is "everything changed since X". Taking X from the device
-- means a phone with a wrong clock either re-syncs everything forever or
-- silently skips rows, so the value comes from the server instead.
create or replace function public.now_iso()
returns text
language sql
stable
as $$
  select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

grant execute on function public.now_iso() to anon, authenticated;
