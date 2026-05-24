-- Pixel Pets — Supabase schema (Phase 1 of the cloud migration)
--
-- Paste this into the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- It creates the profile + pet tables, locks them down with Row Level Security
-- so each user can only touch their own rows, and auto-creates a profile row
-- when a new auth user signs up (username comes from signup metadata).
--
-- Login model: username + password. The client maps each username to a
-- synthetic internal email (e.g. "<username>@pixelpets.local") for Supabase
-- Auth, and stores the real username in profiles.username + user metadata.

-- ── profiles: one row per auth user (account-level wallet lives here) ──────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null,
  tokens        integer not null default 25,
  earn_date     text    not null default '',
  earned_today  integer not null default 0,
  active_pet_id text,
  created_at    timestamptz not null default now()
);

-- ── pets: mirrors the client PetState; one owner per pet ──────────────────────
create table if not exists public.pets (
  id          text primary key,
  owner       uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  species     text not null,
  rarity      text not null,
  stats       jsonb not null,          -- { attack, defense, speed, maxHp }
  level       integer not null default 1,
  stage       text not null,
  hunger      real not null,
  happiness   real not null,
  cleanliness real not null,
  energy      real not null,
  health      real not null,
  age         real not null,
  born_at     bigint not null,
  last_tick   bigint not null,
  asleep      boolean not null default false,
  poops       real not null default 0,
  sick        boolean not null default false,
  ascended    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists pets_owner_idx on public.pets (owner);

-- ── Row Level Security: a user may only read/write their own data ─────────────
alter table public.profiles enable row level security;
alter table public.pets     enable row level security;

create policy "profiles: own row read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own row insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own row update" on public.profiles for update using (auth.uid() = id);

create policy "pets: own read"   on public.pets for select using (auth.uid() = owner);
create policy "pets: own insert" on public.pets for insert with check (auth.uid() = owner);
create policy "pets: own update" on public.pets for update using (auth.uid() = owner);
create policy "pets: own delete" on public.pets for delete using (auth.uid() = owner);

-- ── Auto-create a profile when a new auth user signs up ───────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
