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
  tokens        integer not null default 150,  -- one egg's worth (EGG_COST)
  earn_date     text    not null default '',
  earned_today  integer not null default 0,
  active_pet_id text,
  created_at    timestamptz not null default now()
);

-- `create table if not exists` never changes an existing table's column default,
-- and the live table was first created with `default 25` — so set it explicitly
-- here (idempotent) to fix new-signup starting tokens.
alter table public.profiles alter column tokens set default 150;

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
  insert into public.profiles (id, username, tokens)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    150  -- EGG_COST: enough to hatch the first egg
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

-- ── Daily quests + care streak ────────────────────────────────────────────────
-- Per-day activity counters (reset when the UTC day rolls over) drive the daily
-- quests; a streak rewards consecutive check-ins. Counters are bumped only from
-- server-verified actions (earn_play_tokens / train_pet / battle_turn), so quest
-- completion can't be forged. Reward amounts here mirror src/state/daily.ts.
alter table public.profiles add column if not exists daily_date        text    not null default '';
alter table public.profiles add column if not exists daily_played      integer not null default 0;
alter table public.profiles add column if not exists daily_trained     integer not null default 0;
alter table public.profiles add column if not exists daily_battles_won integer not null default 0;
alter table public.profiles add column if not exists daily_claimed     text[]  not null default '{}';
alter table public.profiles add column if not exists streak            integer not null default 0;
alter table public.profiles add column if not exists streak_date       text    not null default '';

-- Roll the day (reset counters when the UTC date changes) and increment one
-- activity counter, in a single statement. INTERNAL ONLY — execute is revoked
-- from clients so the per-action counters can't be inflated to forge quests.
create or replace function public._daily_bump(p_field text)
returns void
language plpgsql security definer set search_path = public as $$
declare today text := to_char((now() at time zone 'utc'), 'YYYY-MM-DD');
begin
  update public.profiles set
    daily_played      = (case when daily_date = today then daily_played      else 0 end)
                        + (case when p_field = 'played'  then 1 else 0 end),
    daily_trained     = (case when daily_date = today then daily_trained     else 0 end)
                        + (case when p_field = 'trained' then 1 else 0 end),
    daily_battles_won = (case when daily_date = today then daily_battles_won else 0 end)
                        + (case when p_field = 'won'     then 1 else 0 end),
    daily_claimed     = (case when daily_date = today then daily_claimed else '{}'::text[] end),
    daily_date        = today
  where id = auth.uid();
end; $$;
revoke execute on function public._daily_bump(text) from public, anon, authenticated;

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

-- ── Marketplace: public, token-priced pet adoption ────────────────────────────
-- Players list a pet for a token price; anyone can adopt it. Ownership transfer
-- and token movement happen atomically inside adopt_pet (SECURITY DEFINER) so
-- the economy can't be tampered with from the client. Run this block if you set
-- up the project before the marketplace.

create table if not exists public.adoption_listings (
  pet_id     text primary key references public.pets (id) on delete cascade,
  seller     uuid not null references public.profiles (id) on delete cascade,
  price      integer not null check (price >= 0),
  created_at timestamptz not null default now()
);
create index if not exists adoption_seller_idx on public.adoption_listings (seller);

-- Locked down: all access goes through the SECURITY DEFINER RPCs below, which
-- run as the table owner and bypass RLS. No direct table grants are given.
alter table public.adoption_listings enable row level security;

-- Cap mirrored from the client (MAX_PETS). Keep in sync if you change it there.
create or replace function public.market_max_pets() returns integer
language sql immutable as $$ select 8 $$;

-- Put one of your own pets up for adoption (or update its price). Rejects your
-- active pet, your last remaining pet, and eggs/dead pets.
create or replace function public.list_pet_for_adoption(target_pet text, price integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  pet public.pets%rowtype;
  active text;
  owned  integer;
begin
  if price < 0 then raise exception 'Price must be zero or more'; end if;
  select * into pet from public.pets where id = target_pet;
  if pet.id is null or pet.owner <> me then
    raise exception 'That pet is not yours';
  end if;
  if pet.stage in ('egg', 'dead') then
    raise exception 'That pet cannot be listed';
  end if;
  select active_pet_id into active from public.profiles where id = me;
  if active = target_pet then
    raise exception 'You cannot list your active pet — switch to another first';
  end if;
  select count(*) into owned from public.pets where owner = me;
  if owned <= 1 then
    raise exception 'You cannot give away your only pet';
  end if;
  insert into public.adoption_listings (pet_id, seller, price)
  values (target_pet, me, price)
  on conflict (pet_id) do update set price = excluded.price;
end; $$;
grant execute on function public.list_pet_for_adoption(text, integer) to authenticated;

-- Remove your own listing.
create or replace function public.cancel_listing(target_pet text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.adoption_listings
  where pet_id = target_pet and seller = auth.uid();
end; $$;
grant execute on function public.cancel_listing(text) to authenticated;

-- Browse every open listing with the display fields needed to render the pet.
create or replace function public.list_adoptions()
returns table (
  pet_id text, seller_username text, price integer,
  name text, species text, rarity text,
  level integer, stage text, ascended boolean, stats jsonb
)
language sql security definer set search_path = public as $$
  select l.pet_id, s.username, l.price,
         p.name, p.species, p.rarity,
         p.level, p.stage, coalesce(p.ascended, false), p.stats
  from public.adoption_listings l
  join public.pets p     on p.id = l.pet_id
  join public.profiles s on s.id = l.seller
  order by l.created_at desc;
$$;
grant execute on function public.list_adoptions() to authenticated;

-- Adopt a listed pet: atomically verify the listing, move tokens from adopter
-- to seller, reassign ownership, and remove the listing. Returns 'ok'.
create or replace function public.adopt_pet(target_pet text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me        uuid := auth.uid();
  seller_id uuid;
  cost      integer;
  bal       integer;
  owned     integer;
begin
  -- Lock the listing so two adopters can't race for the same pet.
  select l.seller, l.price into seller_id, cost
  from public.adoption_listings l where l.pet_id = target_pet for update;
  if seller_id is null then
    raise exception 'This pet is no longer available';
  end if;
  if seller_id = me then
    raise exception 'You are already this pet''s owner';
  end if;
  select count(*) into owned from public.pets where owner = me;
  if owned >= public.market_max_pets() then
    raise exception 'Your collection is full';
  end if;
  select tokens into bal from public.profiles where id = me for update;
  if bal < cost then
    raise exception 'Not enough tokens';
  end if;
  update public.profiles set tokens = tokens - cost where id = me;
  update public.profiles set tokens = tokens + cost where id = seller_id;
  update public.pets set owner = me where id = target_pet;
  -- If it was the seller's active pet (shouldn't be, but be safe), clear it.
  update public.profiles set active_pet_id = null
    where id = seller_id and active_pet_id = target_pet;
  delete from public.adoption_listings where pet_id = target_pet;
  return 'ok';
end; $$;
grant execute on function public.adopt_pet(text) to authenticated;

-- ── Server-authoritative wallet (anti-cheat, step 1) ──────────────────────────
-- Previously the client wrote its own token balance and could set it to
-- anything. These RPCs make the SERVER the only thing that can change tokens:
-- every way to earn (play, battle) or spend (hatch, train) goes through a
-- SECURITY DEFINER function, and the client's direct write access to
-- profiles.tokens is revoked at the bottom of this block.
--
-- Scope: this closes "give myself tokens" and "hatch for free". Pet stats and
-- rarity are still trusted from the client at hatch (deriving/validating them
-- server-side is the next step). Constants below mirror src/state/usePet.ts —
-- keep them in sync if you change them there (EGG_COST, PLAY_REWARD,
-- DAILY_EARN_CAP, MAX_PETS, train costs, stage level caps, battleReward).

-- Spend tokens to hatch: insert the (client-built) pet and deduct the egg cost
-- atomically. Returns the new token balance.
create or replace function public.hatch_pet(p_pet jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  me    uuid := auth.uid();
  cost  integer := 150;          -- EGG_COST
  bal   integer;
  owned integer;
  pid   text := p_pet->>'id';
begin
  if pid is null then raise exception 'Invalid pet'; end if;
  select count(*) into owned from public.pets where owner = me;
  if owned >= 8 then raise exception 'Your collection is full'; end if;
  select tokens into bal from public.profiles where id = me for update;
  if bal < cost then raise exception 'Not enough tokens'; end if;
  insert into public.pets (
    id, owner, name, species, rarity, stats, level, stage,
    hunger, happiness, cleanliness, energy, health, age,
    born_at, last_tick, asleep, poops, sick, ascended
  ) values (
    pid, me, p_pet->>'name', p_pet->>'species', p_pet->>'rarity', (p_pet->'stats'),
    coalesce((p_pet->>'level')::int, 1), p_pet->>'stage',
    (p_pet->>'hunger')::real, (p_pet->>'happiness')::real,
    (p_pet->>'cleanliness')::real, (p_pet->>'energy')::real,
    (p_pet->>'health')::real, (p_pet->>'age')::real,
    (p_pet->>'bornAt')::bigint, (p_pet->>'lastTick')::bigint,
    coalesce((p_pet->>'asleep')::boolean, false),
    coalesce((p_pet->>'poops')::real, 0),
    coalesce((p_pet->>'sick')::boolean, false),
    coalesce((p_pet->>'ascended')::boolean, false)
  );
  update public.profiles set tokens = tokens - cost, active_pet_id = pid where id = me;
  return bal - cost;
end; $$;
grant execute on function public.hatch_pet(jsonb) to authenticated;

-- Train one stat: the server reads the pet's current value, computes the cost,
-- checks the balance, applies the increment + per-stage level cap, and deducts.
-- Returns { stats, level, tokens }.
create or replace function public.train_pet(p_pet_id text, p_stat text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me       uuid := auth.uid();
  pet      public.pets%rowtype;
  base     integer;
  inc      integer;
  cost     integer;
  cap      integer;
  bal      integer;
  newstats jsonb;
  newlevel integer;
begin
  if p_stat not in ('attack', 'defense', 'speed', 'maxHp') then
    raise exception 'Invalid stat';
  end if;
  select * into pet from public.pets where id = p_pet_id and owner = me;
  if pet.id is null then raise exception 'That pet is not yours'; end if;
  if pet.stage in ('egg', 'dead') then raise exception 'That pet cannot train now'; end if;
  cap := case pet.stage
           when 'baby' then 10 when 'child' then 20
           when 'teen' then 35 when 'adult' then 50 else 0 end;
  if coalesce(pet.level, 1) >= cap then
    raise exception 'At the level cap for this stage';
  end if;
  base := (pet.stats->>p_stat)::int;
  inc  := case when p_stat = 'maxHp' then 4 else 1 end;
  cost := case when p_stat = 'maxHp' then 5 + (base / 8) else 5 + (base / 2) end;
  select tokens into bal from public.profiles where id = me for update;
  if bal < cost then raise exception 'Not enough tokens'; end if;
  newstats := jsonb_set(pet.stats, array[p_stat], to_jsonb(base + inc));
  newlevel := least(cap, coalesce(pet.level, 1) + 1);
  update public.pets set stats = newstats, level = newlevel where id = p_pet_id;
  update public.profiles set tokens = tokens - cost where id = me;
  perform public._daily_bump('trained');
  return jsonb_build_object('stats', newstats, 'level', newlevel, 'tokens', bal - cost);
end; $$;
grant execute on function public.train_pet(text, text) to authenticated;

-- Earn tokens from a successful play, honoring the daily cap (UTC day).
create or replace function public.earn_play_tokens()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  reward integer := 3;    -- PLAY_REWARD
  cap    integer := 60;   -- DAILY_EARN_CAP
  today  text := to_char((now() at time zone 'utc'), 'YYYY-MM-DD');
  prof   public.profiles%rowtype;
  used   integer;
  gain   integer;
begin
  select * into prof from public.profiles where id = me for update;
  used := case when prof.earn_date = today then prof.earned_today else 0 end;
  gain := greatest(0, least(reward, cap - used));
  update public.profiles
    set tokens = tokens + gain, earn_date = today, earned_today = used + gain
    where id = me;
  perform public._daily_bump('played');
  return prof.tokens + gain;
end; $$;
grant execute on function public.earn_play_tokens() to authenticated;

-- Credit a battle win. The reward is computed server-side from the (clamped)
-- enemy level so the client can't request an arbitrary amount. NOTE: this still
-- trusts that the client actually won — server-side battle resolution is a
-- later step.
create or replace function public.claim_battle_reward(p_enemy_level integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  lvl    integer := greatest(1, least(50, coalesce(p_enemy_level, 1)));
  reward integer := 5 + (lvl / 5);   -- battleReward()
  bal    integer;
begin
  update public.profiles set tokens = tokens + reward where id = me
    returning tokens into bal;
  return bal;
end; $$;
grant execute on function public.claim_battle_reward(integer) to authenticated;

-- Legacy migration: insert local pets into the cloud (owner = caller), skipping
-- any that already exist and capping the collection at 8. Used by the one-time
-- "import/restore pets from this device" flow now that direct inserts are off.
create or replace function public.import_pets(p_pets jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me    uuid := auth.uid();
  owned integer;
  item  jsonb;
  pid   text;
begin
  select count(*) into owned from public.pets where owner = me;
  for item in select * from jsonb_array_elements(p_pets) loop
    exit when owned >= 8;
    pid := item->>'id';
    if pid is null then continue; end if;
    if exists (select 1 from public.pets where id = pid) then continue; end if;
    insert into public.pets (
      id, owner, name, species, rarity, stats, level, stage,
      hunger, happiness, cleanliness, energy, health, age,
      born_at, last_tick, asleep, poops, sick, ascended
    ) values (
      pid, me, item->>'name', item->>'species', item->>'rarity', (item->'stats'),
      coalesce((item->>'level')::int, 1), item->>'stage',
      (item->>'hunger')::real, (item->>'happiness')::real, (item->>'cleanliness')::real,
      (item->>'energy')::real, (item->>'health')::real, (item->>'age')::real,
      (item->>'bornAt')::bigint, (item->>'lastTick')::bigint,
      coalesce((item->>'asleep')::boolean, false), coalesce((item->>'poops')::real, 0),
      coalesce((item->>'sick')::boolean, false), coalesce((item->>'ascended')::boolean, false)
    );
    owned := owned + 1;
  end loop;
end; $$;
grant execute on function public.import_pets(jsonb) to authenticated;

-- Lock down direct writes now that the server owns these:
--   • profiles: clients may only set their active pet; tokens/earn columns are
--     server-only (changed solely by the RPCs above).
--   • pets: clients can no longer INSERT directly — hatch_pet / import_pets are
--     the only ways to create a pet. (Stat/care UPDATEs stay open for now;
--     locking those columns is the next hardening step.)
revoke update on public.profiles from anon, authenticated;
grant  update (active_pet_id) on public.profiles to authenticated;
revoke insert on public.pets from anon, authenticated;

-- ── Server-authoritative pet stats (anti-cheat, step 2) ───────────────────────
-- Step 1 locked the wallet; this step stops pets being forged. Hatching now
-- rolls the species, rarity, and base stats SERVER-SIDE (the client only sends
-- the chosen name, so easter-egg names still work), and direct client UPDATEs
-- to the stat/rarity/level/ascended columns are revoked — those change only via
-- hatch_pet / train_pet / ascend_pet / adopt_pet. The species pools, rarity
-- weights, and stat formula MUST stay in sync with src/state/usePet.ts.
--
-- Still client-influenced (a later step): age/stage progression is time-based
-- and trusted from the client, so growth can be fast-forwarded — but stats,
-- rarity, level (beyond the stage cap), and tokens can no longer be forged.

-- Replace the step-1 hatch (which trusted a client-built pet) with one that
-- generates everything server-side. Returns { pet, tokens }.
drop function if exists public.hatch_pet(jsonb);

create or replace function public.hatch_pet(p_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me      uuid := auth.uid();
  cost    integer := 150;        -- EGG_COST
  bal     integer;
  owned   integer;
  nm      text := coalesce(nullif(btrim(p_name), ''), 'Pixel');
  key     text := lower(btrim(coalesce(p_name, '')));
  r       double precision;
  rarity  text;
  pool    text[];
  species text;
  mult    double precision;
  pid     text := 'p_' || replace(gen_random_uuid()::text, '-', '');
  now_ms  bigint := (extract(epoch from now()) * 1000)::bigint;
  st      jsonb;
  pet_row public.pets%rowtype;
begin
  select count(*) into owned from public.pets where owner = me;
  if owned >= 8 then raise exception 'Your collection is full'; end if;
  select tokens into bal from public.profiles where id = me for update;
  if bal < cost then raise exception 'Not enough tokens'; end if;

  -- Easter-egg names force a species; otherwise roll rarity by weight
  -- (common 60 / uncommon 25 / rare 10 / epic 4 / legendary 1, total 100).
  if key = 'spyro' then
    rarity := 'legendary'; species := '🐉';
  elsif key = 'moonbeam' then
    rarity := 'legendary'; species := '🦄';
  else
    r := random() * 100;
    if    r < 60 then rarity := 'common';    pool := array['🐕','🐈','🐇','🐢'];
    elsif r < 85 then rarity := 'uncommon';  pool := array['🦊','🐍','🦎','🦇','🦔','🐧'];
    elsif r < 95 then rarity := 'rare';      pool := array['🦌','🦥','🦉','🦅','🦘','🦫','🦒'];
    elsif r < 99 then rarity := 'epic';      pool := array['🐅','🐘','🦏','🐊','🦈','🐙'];
    else              rarity := 'legendary'; pool := array['🐉','🦄','🧜','🦖'];
    end if;
    species := pool[1 + floor(random() * array_length(pool, 1))::int];
  end if;

  mult := case rarity
    when 'common' then 1.0 when 'uncommon' then 1.2 when 'rare' then 1.45
    when 'epic' then 1.75 when 'legendary' then 2.2 else 1.0 end;
  st := jsonb_build_object(
    'attack',  round((10 + random() * 8)  * mult),
    'defense', round((10 + random() * 8)  * mult),
    'speed',   round((10 + random() * 8)  * mult),
    'maxHp',   round((40 + random() * 30) * mult)
  );

  insert into public.pets (
    id, owner, name, species, rarity, stats, level, stage,
    hunger, happiness, cleanliness, energy, health, age,
    born_at, last_tick, asleep, poops, sick, ascended
  ) values (
    pid, me, nm, species, rarity, st, 1, 'egg',
    70, 70, 90, 80, 100, 0, now_ms, now_ms, false, 0, false, false
  ) returning * into pet_row;

  update public.profiles set tokens = tokens - cost, active_pet_id = pid where id = me;
  return jsonb_build_object('pet', to_jsonb(pet_row), 'tokens', bal - cost);
end; $$;
grant execute on function public.hatch_pet(text) to authenticated;

-- Ascend a dragon/unicorn at adulthood (one-way). ascended is otherwise locked.
create or replace function public.ascend_pet(p_pet_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  pet public.pets%rowtype;
begin
  select * into pet from public.pets where id = p_pet_id and owner = me;
  if pet.id is null then raise exception 'That pet is not yours'; end if;
  if pet.species not in ('🐉', '🦄') then raise exception 'This species cannot ascend'; end if;
  if pet.stage <> 'adult' then raise exception 'Only adults can ascend'; end if;
  if coalesce(pet.ascended, false) then raise exception 'Already ascended'; end if;
  update public.pets set ascended = true where id = p_pet_id;
end; $$;
grant execute on function public.ascend_pet(text) to authenticated;

-- Lock the stat/identity columns: clients may only write care state + name now.
-- stats/level/rarity/species/ascended change solely via the RPCs above and
-- adopt_pet. (age/stage stay writable so time-based growth still persists.)
revoke update on public.pets from anon, authenticated;
grant update (
  name, hunger, happiness, cleanliness, energy, health, age, stage,
  last_tick, asleep, poops, sick
) on public.pets to authenticated;

-- ── Server-authoritative turn-based battles (anti-cheat) ──────────────────────
-- Battles are resolved one turn at a time, entirely server-side. start_battle
-- creates a hidden battle row holding both sides' authoritative effective stats
-- and full HP; each battle_turn applies one round of stat-scaled, tactic-
-- modified damage and persists the new HP. Wins, token rewards, and PvP records
-- are only ever written here, so the client cannot forge an outcome. Effective-
-- stat math mirrors battleStats() and the PvE scaling mirrors generateOpponent()
-- in the client; the tactic RPS triangle mirrors src/battle/tactics.ts.
drop function if exists public.resolve_battle(text, text);
drop function if exists public.resolve_battle(text, text, text);

create table if not exists public.battles (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references public.profiles (id) on delete cascade,
  pet_id     text not null,
  mode       text not null,
  turn       integer not null default 1,
  p_name text not null, p_species text not null, p_stage text not null,
  p_rarity text not null, p_ascended boolean not null, p_level int not null,
  p_atk int not null, p_def int not null, p_spd int not null,
  p_maxhp int not null, p_hp int not null,
  e_name text not null, e_species text not null, e_stage text not null,
  e_rarity text not null, e_ascended boolean not null, e_level int not null,
  e_atk int not null, e_def int not null, e_spd int not null,
  e_maxhp int not null, e_hp int not null,
  created_at timestamptz not null default now()
);
create index if not exists battles_owner_idx on public.battles (owner);

-- The client may read its own in-progress battles, but only the RPCs below
-- (SECURITY DEFINER) ever write — so HP and outcomes can't be tampered with.
alter table public.battles enable row level security;
grant select on public.battles to authenticated;
drop policy if exists "battles: own read" on public.battles;
create policy "battles: own read" on public.battles for select using (auth.uid() = owner);

-- Begin a battle. Builds the opponent (PvE scaled to the player, or a random
-- PvP pet), stores the fight at full HP, and returns the opening state.
create or replace function public.start_battle(p_mode text, p_pet_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me   uuid := auth.uid();
  pet  public.pets%rowtype;
  opp  public.pets%rowtype;
  opp_user text;
  plvl int; pgrow double precision; pasc double precision;
  patk int; pdef int; pspd int; phpv int;
  elvl int; egrow double precision; easc double precision;
  eatk int; edef int; espd int; ehpv int;
  e_species text; e_rarity text; e_name text; e_stage text := 'adult';
  e_ascb boolean := false;
  bid uuid;
  adjs text[] := array['Wild','Feral','Rival','Rogue','Fierce','Ancient'];
  opps text[] := array['🦊','🐅','🦈','🐉','🦉','🐍','🦫','🦒','🐊','🦝','🦏','🐘'];
begin
  select * into pet from public.pets where id = p_pet_id and owner = me;
  if pet.id is null then raise exception 'That pet is not yours'; end if;
  if pet.stage in ('egg', 'dead') then raise exception 'This pet cannot battle'; end if;

  plvl := least(50, greatest(1, coalesce(pet.level, 1)));
  pgrow := 1 + (plvl - 1) * 0.05;
  pasc := case when coalesce(pet.ascended, false) then 1.5 else 1.0 end;
  patk := round((pet.stats->>'attack')::numeric  * pgrow * pasc);
  pdef := round((pet.stats->>'defense')::numeric * pgrow * pasc);
  pspd := round((pet.stats->>'speed')::numeric   * pgrow * pasc);
  phpv := greatest(1, round((pet.stats->>'maxHp')::numeric * pgrow * pasc));

  if p_mode = 'pvp' then
    select * into opp from public.pets
      where owner <> me and stage <> 'egg' and stage <> 'dead'
      order by random() limit 1;
    if opp.id is null then return jsonb_build_object('empty', true); end if;
    select username into opp_user from public.profiles where id = opp.owner;
    elvl := least(50, greatest(1, coalesce(opp.level, 1)));
    egrow := 1 + (elvl - 1) * 0.05;
    easc := case when coalesce(opp.ascended, false) then 1.5 else 1.0 end;
    eatk := round((opp.stats->>'attack')::numeric  * egrow * easc);
    edef := round((opp.stats->>'defense')::numeric * egrow * easc);
    espd := round((opp.stats->>'speed')::numeric   * egrow * easc);
    ehpv := greatest(1, round((opp.stats->>'maxHp')::numeric * egrow * easc));
    e_species := opp.species; e_rarity := opp.rarity; e_stage := opp.stage;
    e_ascb := coalesce(opp.ascended, false);
    e_name := opp.name || ' (@' || coalesce(opp_user, 'rival') || ')';
  else
    eatk := greatest(1,  round(patk * (0.8  + random() * 0.35)));
    edef := greatest(1,  round(pdef * (0.8  + random() * 0.35)));
    espd := greatest(1,  round(pspd * (0.8  + random() * 0.35)));
    ehpv := greatest(10, round(phpv * (0.85 + random() * 0.3)));
    elvl := plvl;
    e_species := opps[1 + floor(random() * array_length(opps, 1))::int];
    e_rarity := 'common';
    e_name := (adjs[1 + floor(random() * array_length(adjs, 1))::int]) || '|' || e_species;
  end if;

  -- One active battle per player; clear any leftovers first.
  delete from public.battles where owner = me;
  insert into public.battles (
    owner, pet_id, mode, turn,
    p_name, p_species, p_stage, p_rarity, p_ascended, p_level,
    p_atk, p_def, p_spd, p_maxhp, p_hp,
    e_name, e_species, e_stage, e_rarity, e_ascended, e_level,
    e_atk, e_def, e_spd, e_maxhp, e_hp
  ) values (
    me, pet.id, p_mode, 1,
    pet.name, pet.species, pet.stage, pet.rarity, coalesce(pet.ascended, false), plvl,
    patk, pdef, pspd, phpv, phpv,
    e_name, e_species, e_stage, e_rarity, e_ascb, elvl,
    eatk, edef, espd, ehpv, ehpv
  ) returning id into bid;

  return jsonb_build_object(
    'battleId', bid, 'turn', 1, 'status', 'active',
    'player', jsonb_build_object(
      'name', pet.name, 'species', pet.species, 'stage', pet.stage,
      'rarity', pet.rarity, 'ascended', coalesce(pet.ascended, false), 'level', plvl,
      'attack', patk, 'defense', pdef, 'speed', pspd, 'maxHp', phpv, 'hp', phpv),
    'enemy', jsonb_build_object(
      'name', e_name, 'species', e_species, 'stage', e_stage,
      'rarity', e_rarity, 'ascended', e_ascb, 'level', elvl,
      'attack', eatk, 'defense', edef, 'speed', espd, 'maxHp', ehpv, 'hp', ehpv)
  );
end; $$;
grant execute on function public.start_battle(text, text) to authenticated;

-- Resolve one turn. The player commits a tactic; the enemy's is rolled blindly.
-- Damage scales with attacker.attack vs defender.defense (atk²/(atk+def)), then
-- two strategic layers (mirrored in src/battle/tactics.ts):
--   • inherent stance — aggressive deals +25% / takes +40% (a real gamble);
--     defensive deals -20% / takes -10%; balanced is neutral.
--   • RPS matchup — winning aggressive▶balanced▶defensive▶aggressive ×1.35,
--     losing ×0.8.
-- These multipliers are tuned (see balance sim) so no stance dominates. The
-- faster side strikes first (speed ties broken randomly so PvP isn't initiator-
-- biased); a knockout prevents the slower side from retaliating that turn.
create or replace function public.battle_turn(p_battle_id uuid, p_tactic text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  b   public.battles%rowtype;
  ptac text; etac text; mu text;
  pmult double precision; emult double precision;
  p_out double precision; p_in double precision;
  e_out double precision; e_in double precision;
  pdmg int; edmg int; p_applied int := 0; e_applied int := 0;
  php int; ehp int; player_first boolean; result text;
  reward int := 0; bal int;
begin
  select * into b from public.battles
    where id = p_battle_id and owner = me for update;
  if b.id is null then raise exception 'No active battle'; end if;

  ptac := case when p_tactic in ('aggressive', 'balanced', 'defensive')
               then p_tactic else 'balanced' end;
  etac := (array['aggressive', 'balanced', 'defensive'])[1 + floor(random() * 3)::int];

  -- RPS triangle from the player's perspective.
  if ptac = etac then mu := 'even';
  elsif (ptac = 'aggressive' and etac = 'balanced')
     or (ptac = 'balanced' and etac = 'defensive')
     or (ptac = 'defensive' and etac = 'aggressive') then mu := 'advantage';
  else mu := 'disadvantage'; end if;

  pmult := case mu when 'advantage' then 1.35 when 'disadvantage' then 0.8 else 1.0 end;
  emult := case mu when 'advantage' then 0.8 when 'disadvantage' then 1.35 else 1.0 end;

  -- Inherent stance multipliers (deal / take), applied to whoever chose them.
  p_out := case ptac when 'aggressive' then 1.25 when 'defensive' then 0.8  else 1.0 end;
  p_in  := case ptac when 'aggressive' then 1.4  when 'defensive' then 0.9  else 1.0 end;
  e_out := case etac when 'aggressive' then 1.25 when 'defensive' then 0.8  else 1.0 end;
  e_in  := case etac when 'aggressive' then 1.4  when 'defensive' then 0.9  else 1.0 end;

  -- Player's damage: own attack stance × foe's defend stance × matchup.
  pdmg := greatest(1, round(
    (b.p_atk::numeric * b.p_atk / (b.p_atk + b.e_def)) * 1.8 * pmult * p_out * e_in
    * (0.9 + random() * 0.2)));
  edmg := greatest(1, round(
    (b.e_atk::numeric * b.e_atk / (b.e_atk + b.p_def)) * 1.8 * emult * e_out * p_in
    * (0.9 + random() * 0.2)));

  php := b.p_hp; ehp := b.e_hp;
  player_first := b.p_spd > b.e_spd
               or (b.p_spd = b.e_spd and random() < 0.5);

  if player_first then
    ehp := ehp - pdmg; p_applied := pdmg;
    if ehp <= 0 then ehp := 0; result := 'won';
    else
      php := php - edmg; e_applied := edmg;
      result := case when php <= 0 then 'lost' else 'active' end;
      if php < 0 then php := 0; end if;
    end if;
  else
    php := php - edmg; e_applied := edmg;
    if php <= 0 then php := 0; result := 'lost';
    else
      ehp := ehp - pdmg; p_applied := pdmg;
      result := case when ehp <= 0 then 'won' else 'active' end;
      if ehp < 0 then ehp := 0; end if;
    end if;
  end if;

  if result = 'active' then
    update public.battles
      set p_hp = php, e_hp = ehp, turn = turn + 1
      where id = b.id;
  else
    -- Battle over: settle rewards / PvP record, then discard the row.
    if result = 'won' then
      reward := 5 + (b.e_level / 5);                              -- battleReward()
      update public.profiles set tokens = tokens + reward where id = me;
      perform public._daily_bump('won');
    end if;
    if b.mode = 'pvp' then
      update public.profiles
        set pvp_wins   = pvp_wins   + (case when result = 'won' then 1 else 0 end),
            pvp_losses = pvp_losses + (case when result = 'won' then 0 else 1 end)
        where id = me;
    end if;
    delete from public.battles where id = b.id;
  end if;

  select tokens into bal from public.profiles where id = me;

  return jsonb_build_object(
    'status', result,
    'turn', case when result = 'active' then b.turn + 1 else b.turn end,
    'tactic', ptac, 'enemyTactic', etac,
    'order', case when player_first then 'player' else 'enemy' end,
    'playerHp', php, 'enemyHp', ehp,
    'playerDmg', p_applied, 'enemyDmg', e_applied,
    'reward', reward, 'tokens', bal
  );
end; $$;
grant execute on function public.battle_turn(uuid, text) to authenticated;

-- ── Daily quests / streak RPCs ────────────────────────────────────────────────
-- Read today's progress + claim state + streak. Rolls the day first so a fresh
-- day shows zeroed counters even before any activity.
create or replace function public.daily_status()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  today text := to_char((now() at time zone 'utc'), 'YYYY-MM-DD');
  prof  public.profiles%rowtype;
begin
  update public.profiles set
    daily_played = 0, daily_trained = 0, daily_battles_won = 0,
    daily_claimed = '{}'::text[], daily_date = today
  where id = auth.uid() and daily_date <> today;
  select * into prof from public.profiles where id = auth.uid();
  return jsonb_build_object(
    'date', today,
    'played', prof.daily_played, 'trained', prof.daily_trained, 'won', prof.daily_battles_won,
    'claimed', to_jsonb(prof.daily_claimed),
    'streak', prof.streak, 'tokens', prof.tokens
  );
end; $$;
grant execute on function public.daily_status() to authenticated;

-- Claim a completed quest. The server verifies completion against the activity
-- counters (which only server-verified actions bump), credits the reward once
-- per day, and advances the streak on check-in. Reward amounts mirror daily.ts.
create or replace function public.claim_quest(p_quest text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  today  text := to_char((now() at time zone 'utc'), 'YYYY-MM-DD');
  yday   text := to_char((now() at time zone 'utc') - interval '1 day', 'YYYY-MM-DD');
  prof   public.profiles%rowtype;
  reward int := 0;
  nstreak int;
begin
  update public.profiles set
    daily_played = 0, daily_trained = 0, daily_battles_won = 0,
    daily_claimed = '{}'::text[], daily_date = today
  where id = me and daily_date <> today;

  select * into prof from public.profiles where id = me for update;
  if p_quest = any(prof.daily_claimed) then raise exception 'Already claimed today'; end if;

  if p_quest = 'checkin' then
    nstreak := case when prof.streak_date = today then prof.streak
                    when prof.streak_date = yday  then prof.streak + 1
                    else 1 end;
    reward := 5 + least(nstreak, 7);                 -- streak bonus, capped
    update public.profiles set streak = nstreak, streak_date = today where id = me;
  elsif p_quest = 'play' then
    if prof.daily_played < 1 then raise exception 'Quest not complete'; end if;
    reward := 8;
  elsif p_quest = 'train' then
    if prof.daily_trained < 1 then raise exception 'Quest not complete'; end if;
    reward := 8;
  elsif p_quest = 'win' then
    if prof.daily_battles_won < 1 then raise exception 'Quest not complete'; end if;
    reward := 12;
  else
    raise exception 'Unknown quest';
  end if;

  update public.profiles
    set tokens = tokens + reward,
        daily_claimed = array_append(daily_claimed, p_quest)
    where id = me;
  select * into prof from public.profiles where id = me;
  return jsonb_build_object(
    'reward', reward, 'tokens', prof.tokens,
    'streak', prof.streak, 'claimed', to_jsonb(prof.daily_claimed)
  );
end; $$;
grant execute on function public.claim_quest(text) to authenticated;

-- ── Web push notifications ────────────────────────────────────────────────────
-- Browser push subscriptions (one row per device/browser). A scheduled GitHub
-- Actions job reads these with the service role and sends reminders (streak
-- expiry + pet care); the client saves/removes its own subscription via the
-- RPCs below. Per-user dedupe state lives on profiles so someone with several
-- devices is reminded once per event, not once per device.
alter table public.profiles add column if not exists notif_streak_date text   not null default '';
alter table public.profiles add column if not exists notif_care_at     bigint not null default 0;

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  owner      uuid not null references public.profiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_owner_idx on public.push_subscriptions (owner);

alter table public.push_subscriptions enable row level security;
grant select, delete on public.push_subscriptions to authenticated;
-- The scheduled sender (scripts/send-push.mjs) runs as service_role: it bypasses
-- RLS but still needs table privileges. Grant exactly what it touches — read
-- subscriptions/pets, read+update profiles (dedupe state), delete dead subs.
grant select, delete on public.push_subscriptions to service_role;
grant select, update on public.profiles            to service_role;
grant select          on public.pets               to service_role;
drop policy if exists "push: own read"   on public.push_subscriptions;
drop policy if exists "push: own delete" on public.push_subscriptions;
create policy "push: own read"   on public.push_subscriptions for select using (auth.uid() = owner);
create policy "push: own delete" on public.push_subscriptions for delete using (auth.uid() = owner);

-- Upsert the caller's subscription (keyed by endpoint so re-subscribing is safe).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_subscriptions (endpoint, owner, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set owner = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end; $$;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and owner = auth.uid();
end; $$;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- ── Token purchases (Stripe) ──────────────────────────────────────────────────
-- Real-money token bundles. The Stripe webhook Edge Function (stripe-webhook)
-- calls record_purchase with the service role after a paid Checkout session.
-- The purchases row is keyed by the Stripe session id, so retries can't double-
-- credit. Clients may read their own purchase history but can NEVER credit
-- tokens — record_purchase is execute-revoked from everyone except service_role.
create table if not exists public.purchases (
  id         text primary key,                 -- Stripe checkout session id
  owner      uuid not null references public.profiles (id) on delete cascade,
  bundle     text not null,
  tokens     integer not null,
  amount     integer not null,                 -- cents (USD)
  created_at timestamptz not null default now()
);
create index if not exists purchases_owner_idx on public.purchases (owner);

alter table public.purchases enable row level security;
grant select on public.purchases to authenticated;
grant select, insert on public.purchases to service_role;
drop policy if exists "purchases: own read" on public.purchases;
create policy "purchases: own read" on public.purchases for select using (auth.uid() = owner);

-- Atomically record a paid purchase and credit its tokens — exactly once. The
-- session id is the primary key, so a duplicate webhook delivery inserts nothing
-- and FOUND is false, skipping the credit.
create or replace function public.record_purchase(
  p_session text, p_owner uuid, p_bundle text, p_tokens int, p_amount int
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.purchases (id, owner, bundle, tokens, amount)
  values (p_session, p_owner, p_bundle, p_tokens, p_amount)
  on conflict (id) do nothing;
  if found then
    update public.profiles set tokens = tokens + p_tokens where id = p_owner;
  end if;
end; $$;
revoke execute on function public.record_purchase(text, uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.record_purchase(text, uuid, text, int, int) to service_role;
