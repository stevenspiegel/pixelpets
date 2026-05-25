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

-- Table-level privileges (required IN ADDITION to RLS — without these the
-- client gets "permission denied for table"). RLS still restricts which rows
-- each user can touch; these grants just allow the operations.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.pets     to anon, authenticated;

-- drop-if-exists guards make this whole script safe to re-run
drop policy if exists "profiles: own row read"   on public.profiles;
drop policy if exists "profiles: own row insert" on public.profiles;
drop policy if exists "profiles: own row update" on public.profiles;
drop policy if exists "pets: own read"   on public.pets;
drop policy if exists "pets: own insert" on public.pets;
drop policy if exists "pets: own update" on public.pets;
drop policy if exists "pets: own delete" on public.pets;

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

-- ── PvP (asynchronous) ────────────────────────────────────────────────────────
-- Run this block if you set up the project before PvP existed.

-- Win/loss record on each profile.
alter table public.profiles add column if not exists pvp_wins   integer not null default 0;
alter table public.profiles add column if not exists pvp_losses integer not null default 0;

-- Return a random opponent pet that isn't the caller's. SECURITY DEFINER so it
-- can read across users without exposing the whole pets table via RLS; it only
-- returns battle-relevant fields plus the owner's username.
create or replace function public.get_random_opponent()
returns table (
  pet_id text, name text, species text, rarity text,
  stats jsonb, level integer, stage text, ascended boolean, owner_username text
)
language sql security definer set search_path = public as $$
  select p.id, p.name, p.species, p.rarity, p.stats, p.level, p.stage,
         coalesce(p.ascended, false), pr.username
  from public.pets p
  join public.profiles pr on pr.id = p.owner
  where p.owner <> auth.uid()
    and p.stage <> 'egg'
    and p.stage <> 'dead'
  order by random()
  limit 1;
$$;
grant execute on function public.get_random_opponent() to authenticated;

-- Record a PvP result for the caller (atomic increment).
create or replace function public.record_pvp_result(won boolean)
returns void
language sql security definer set search_path = public as $$
  update public.profiles
  set pvp_wins   = pvp_wins   + (case when won then 1 else 0 end),
      pvp_losses = pvp_losses + (case when won then 0 else 1 end)
  where id = auth.uid();
$$;
grant execute on function public.record_pvp_result(boolean) to authenticated;

-- Top PvP players.
create or replace function public.pvp_leaderboard()
returns table (username text, pvp_wins integer, pvp_losses integer)
language sql security definer set search_path = public as $$
  select username, pvp_wins, pvp_losses
  from public.profiles
  where pvp_wins > 0 or pvp_losses > 0
  order by pvp_wins desc, pvp_losses asc
  limit 20;
$$;
grant execute on function public.pvp_leaderboard() to authenticated;

-- ── Friends (mutual, request-based) ───────────────────────────────────────────
-- You send a request; when the other player accepts, BOTH are added to each
-- other's friend list (the friends table stores both directions). Run this
-- block if you set up the project before friends.

create table if not exists public.friends (
  owner      uuid not null references public.profiles (id) on delete cascade,
  friend     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, friend)
);

create table if not exists public.friend_requests (
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);

alter table public.friends         enable row level security;
alter table public.friend_requests enable row level security;
grant select on public.friends         to anon, authenticated;
grant select on public.friend_requests to anon, authenticated;

drop policy if exists "friends: own select" on public.friends;
create policy "friends: own select" on public.friends for select using (auth.uid() = owner);

drop policy if exists "reqs: mine select" on public.friend_requests;
create policy "reqs: mine select" on public.friend_requests
  for select using (auth.uid() = from_id or auth.uid() = to_id);

-- Send a request by username. If the target already requested you, it's
-- accepted immediately (mutual). Returns 'requested' or 'accepted'.
create or replace function public.send_friend_request(target text)
returns text
language plpgsql security definer set search_path = public as $$
declare tid uuid; me uuid := auth.uid();
begin
  select id into tid from public.profiles where lower(username) = lower(trim(target));
  if tid is null then raise exception 'No player named %', target; end if;
  if tid = me then raise exception 'You cannot add yourself'; end if;
  if exists (select 1 from public.friends where owner = me and friend = tid) then
    raise exception 'Already friends';
  end if;
  if exists (select 1 from public.friend_requests where from_id = tid and to_id = me) then
    delete from public.friend_requests
      where (from_id = tid and to_id = me) or (from_id = me and to_id = tid);
    insert into public.friends (owner, friend) values (me, tid), (tid, me)
      on conflict do nothing;
    return 'accepted';
  end if;
  insert into public.friend_requests (from_id, to_id) values (me, tid)
    on conflict do nothing;
  return 'requested';
end; $$;
grant execute on function public.send_friend_request(text) to authenticated;

-- Accept or decline an incoming request from a given username.
create or replace function public.respond_friend_request(from_user text, accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid; me uuid := auth.uid();
begin
  select id into fid from public.profiles where lower(username) = lower(trim(from_user));
  if fid is null then return; end if;
  delete from public.friend_requests where from_id = fid and to_id = me;
  if accept then
    insert into public.friends (owner, friend) values (me, fid), (fid, me)
      on conflict do nothing;
  end if;
end; $$;
grant execute on function public.respond_friend_request(text, boolean) to authenticated;

-- Incoming pending requests for the caller.
create or replace function public.list_friend_requests()
returns table (username text)
language sql security definer set search_path = public as $$
  select p.username
  from public.friend_requests r
  join public.profiles p on p.id = r.from_id
  where r.to_id = auth.uid()
  order by r.created_at;
$$;
grant execute on function public.list_friend_requests() to authenticated;

-- The caller's friends, with profile summary + pet count.
create or replace function public.list_friends()
returns table (username text, pvp_wins integer, pvp_losses integer, pet_count bigint)
language sql security definer set search_path = public as $$
  select p.username, p.pvp_wins, p.pvp_losses,
         (select count(*) from public.pets pt where pt.owner = p.id) as pet_count
  from public.friends f
  join public.profiles p on p.id = f.friend
  where f.owner = auth.uid()
  order by p.username;
$$;
grant execute on function public.list_friends() to authenticated;

-- Remove a friend: drop both directions and any pending requests.
create or replace function public.remove_friend(target text)
returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid; me uuid := auth.uid();
begin
  select id into fid from public.profiles where lower(username) = lower(trim(target));
  if fid is null then return; end if;
  delete from public.friends
    where (owner = me and friend = fid) or (owner = fid and friend = me);
  delete from public.friend_requests
    where (from_id = me and to_id = fid) or (from_id = fid and to_id = me);
end; $$;
grant execute on function public.remove_friend(text) to authenticated;

-- A friend's pets (battle fields). Only returns rows if target is your friend.
create or replace function public.get_friend_pets(target text)
returns table (
  pet_id text, name text, species text, rarity text,
  stats jsonb, level integer, stage text, ascended boolean
)
language sql security definer set search_path = public as $$
  select pt.id, pt.name, pt.species, pt.rarity, pt.stats, pt.level, pt.stage,
         coalesce(pt.ascended, false)
  from public.pets pt
  join public.profiles p on p.id = pt.owner
  join public.friends f on f.friend = p.id and f.owner = auth.uid()
  where lower(p.username) = lower(trim(target))
  order by pt.created_at;
$$;
grant execute on function public.get_friend_pets(text) to authenticated;
