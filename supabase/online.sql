-- ===========================================================================
-- ProMouser Online: database
--
-- Run this AFTER ProMouser's schema.sql, in the SAME Supabase project. Both sites
-- then share one set of accounts: signing up on either site creates the other
-- account, and your ProMouser plan, Turbo and CPS bests show on your Online profile.
--
-- Everything here is changed through the o_* functions below, never by writing
-- tables directly, so prices, coins, items and Turbo can't be edited from the browser.
-- Safe to re-run: it updates functions and the item catalog and keeps all data.
-- ===========================================================================

-- ---------------------------------------------------------------- tables
create table if not exists public.online_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  username     text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 32),
  bio          text not null default '' check (char_length(bio) <= 160),
  avatar_url   text check (avatar_url is null or (avatar_url ~ '^https?://' and char_length(avatar_url) < 600)),
  border       text,
  showcase     text,
  name_grad    jsonb,   -- Turbo: {"colors": ["#22d3ee", "#f472b6"], "angle": 90}
  theme        jsonb,   -- Turbo: profile page gradient, same shape
  coins        int  not null default 250 check (coins >= 0),
  xp           int  not null default 0 check (xp >= 0),
  bp_season    int  not null default 1,
  bp_xp        int  not null default 0 check (bp_xp >= 0),
  bp_claims    jsonb not null default '{"free": [], "turbo": []}'::jsonb,
  stats        jsonb not null default '{}'::jsonb,   -- {"arena": {"played": 3, "wins": 1, "best": 14}}
  coins_day    date,
  coins_today  int  not null default 0,
  daily_day    date,
  daily_streak int  not null default 0,
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);
create unique index if not exists online_profiles_username_key on public.online_profiles (lower(username));

create table if not exists public.online_items (
  id        text primary key,
  kind      text not null check (kind in ('mouse', 'border')),
  name      text not null,
  rarity    text not null check (rarity in ('common', 'rare', 'epic', 'legendary', 'mythic')),
  coins     int,            -- price in coins, null = not sold for coins
  price_inr int,            -- price in ₹ (sold through products / grant_order), null = not sold for money
  free      boolean not null default false,   -- everyone gets it
  turbo     boolean not null default false,   -- claimable while Turbo is active, kept forever
  pass_tier int             -- battle pass reward
);

create table if not exists public.online_inventory (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null references public.online_items(id),
  source      text not null default 'coins',
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.online_bp_rewards (
  season int not null, track text not null check (track in ('free', 'turbo')), tier int not null,
  coins int not null default 0, item_id text references public.online_items(id),
  primary key (season, track, tier)
);

-- one row per pair; user_id sent the request
create table if not exists public.online_friends (
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.online_messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null references auth.users(id) on delete cascade,
  recipient  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists online_messages_pair_idx on public.online_messages (least(sender, recipient), greatest(sender, recipient), id);
create index if not exists online_messages_unread_idx on public.online_messages (recipient) where read_at is null;

create table if not exists public.online_lobbies (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  host        uuid not null references auth.users(id) on delete cascade,
  game        text not null,
  name        text not null check (char_length(name) between 1 and 40),
  is_public   boolean not null default true,
  max_players int not null default 8 check (max_players between 2 and 16),
  status      text not null default 'open' check (status in ('open', 'playing', 'closed')),
  settings    jsonb not null default '{}'::jsonb check (pg_column_size(settings) < 4000),
  round       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.online_lobby_members (
  lobby_id  uuid not null references public.online_lobbies(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);
create index if not exists online_lobby_members_user_idx on public.online_lobby_members (user_id);

create table if not exists public.online_results (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  game       text not null,
  score      numeric not null,
  won        boolean not null default false,
  lobby_id   uuid,
  coins      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists online_results_game_idx on public.online_results (game, score);
create index if not exists online_results_user_idx on public.online_results (user_id, created_at desc);

-- All access goes through the functions below.
alter table public.online_profiles      enable row level security;
alter table public.online_items         enable row level security;
alter table public.online_inventory     enable row level security;
alter table public.online_bp_rewards    enable row level security;
alter table public.online_friends       enable row level security;
alter table public.online_messages      enable row level security;
alter table public.online_lobbies       enable row level security;
alter table public.online_lobby_members enable row level security;
alter table public.online_results       enable row level security;
revoke all on public.online_profiles, public.online_items, public.online_inventory, public.online_bp_rewards, public.online_friends,
  public.online_messages, public.online_lobbies, public.online_lobby_members, public.online_results from anon, authenticated;
drop policy if exists "items read" on public.online_items;
create policy "items read" on public.online_items for select to anon, authenticated using (true);
grant select on public.online_items to anon, authenticated;

-- ---------------------------------------------------------------- catalog (prices live here; the site only displays them)
insert into public.online_items (id, kind, name, rarity, coins, price_inr, free, turbo, pass_tier) values
  ('m-starter',    'mouse',  'Starter Classic',    'common',    null, null, true,  false, null),
  ('m-carbon',     'mouse',  'Carbon Lite',        'common',     400, null, false, false, null),
  ('m-arctic',     'mouse',  'Arctic Honeycomb',   'rare',      1200, null, false, false, null),
  ('m-toxic',      'mouse',  'Toxic Neon',         'rare',      1500, null, false, false, null),
  ('m-chrome',     'mouse',  'Chrome Viper',       'epic',      3000, null, false, false, null),
  ('m-sakura',     'mouse',  'Sakura Bloom',       'epic',      3500, null, false, false, null),
  ('m-holo',       'mouse',  'Holo Glass',         'epic',      null,   79, false, false, null),
  ('m-galaxy',     'mouse',  'Galaxy Drift',       'legendary', null,  129, false, false, null),
  ('m-molten',     'mouse',  'Molten Core',        'legendary', null,  149, false, false, null),
  ('m-gold',       'mouse',  'Gold Rush',          'legendary', 12000, 149, false, false, null),
  ('m-prism',      'mouse',  'Prism Phantom',      'mythic',    null,  199, false, false, null),
  ('m-circuit',    'mouse',  'Circuit Board',      'epic',      null, null, false, false, 20),
  ('m-ember',      'mouse',  'Ember Strike',       'epic',      null, null, false, false, 15),
  ('m-spectre',    'mouse',  'Season One Spectre', 'mythic',    null, null, false, false, 30),
  ('m-hyperdrive', 'mouse',  'Turbo Hyperdrive',   'mythic',    null, null, false, true,  null),
  ('b-clean',      'border', 'Clean Ring',         'common',    null, null, true,  false, null),
  ('b-crimson',    'border', 'Crimson Pulse',      'common',     300, null, false, false, null),
  ('b-frost',      'border', 'Frost',              'rare',       800, null, false, false, null),
  ('b-pixel',      'border', 'Pixel Party',        'rare',      1000, null, false, false, null),
  ('b-neon',       'border', 'Neon Cycle',         'epic',      2000, null, false, false, null),
  ('b-sakura',     'border', 'Sakura Petals',      'epic',      2500, null, false, false, null),
  ('b-fire',       'border', 'Inferno',            'legendary', 6000,   49, false, false, null),
  ('b-galaxy',     'border', 'Galaxy',             'legendary', null,   79, false, false, null),
  ('b-glitch',     'border', 'Glitch',             'legendary', null,   99, false, false, null),
  ('b-crown',      'border', 'Royal Crown',        'mythic',    null,  129, false, false, null),
  ('b-volt',       'border', 'Volt',               'epic',      null, null, false, false, 10),
  ('b-ember',      'border', 'Ember',              'epic',      null, null, false, false, 5),
  ('b-void',       'border', 'Void',               'legendary', null, null, false, false, 25),
  ('b-aurora',     'border', 'Turbo Aurora',       'mythic',    null, null, false, true,  null)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, rarity = excluded.rarity, coins = excluded.coins,
  price_inr = excluded.price_inr, free = excluded.free, turbo = excluded.turbo, pass_tier = excluded.pass_tier;

-- items sold for ₹ go through ProMouser's products / grant_order (type 'item', feature = item id)
insert into public.products (id, type, feature, name, credits, days, price_inr)
  select 'item-' || i.id, 'item', i.id, i.name || ' (' || i.kind || ')', 0, 0, i.price_inr from public.online_items i where i.price_inr is not null
on conflict (id) do update set feature = excluded.feature, name = excluded.name, price_inr = excluded.price_inr, active = true;

-- battle pass, season 1: 30 tiers, 400 XP each
insert into public.online_bp_rewards (season, track, tier, coins, item_id)
  select 1, 'free', t, case when t = 30 then 1000 else 50 + (t / 4) * 50 end, null from generate_series(2, 30, 2) t where t not in (10, 20)
  union all select 1, 'free', 10, 0, 'b-volt'
  union all select 1, 'free', 20, 0, 'm-circuit'
  union all select 1, 'turbo', t, 150, null from generate_series(1, 30) t where t not in (5, 15, 25, 30)
  union all select 1, 'turbo', 5, 0, 'b-ember'
  union all select 1, 'turbo', 15, 0, 'm-ember'
  union all select 1, 'turbo', 25, 0, 'b-void'
  union all select 1, 'turbo', 30, 0, 'm-spectre'
on conflict (season, track, tier) do update set coins = excluded.coins, item_id = excluded.item_id;

-- ---------------------------------------------------------------- helpers (internal)
create or replace function public.o_uid() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  return auth.uid();
end $$;

create or replace function public.o_turbo(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select turbo_until > now() from public.profiles where id = p_user), false) $$;

create or replace function public.o_level(p_xp int) returns int
language sql immutable set search_path = '' as $$ select 1 + floor(sqrt(greatest(p_xp, 0) / 150.0))::int $$;

-- the public "card" for a user: what other players see in lists
create or replace function public.o_card(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', o.user_id, 'username', o.username, 'display_name', o.display_name, 'avatar_url', o.avatar_url,
    'border', o.border, 'level', public.o_level(o.xp), 'turbo', public.o_turbo(o.user_id),
    'name_grad', case when public.o_turbo(o.user_id) then o.name_grad end, 'plan', p.plan, 'last_seen', o.last_seen, 'showcase', o.showcase)
  from public.online_profiles o join public.profiles p on p.id = o.user_id where o.user_id = p_user $$;

create or replace function public.o_friend_status(p_me uuid, p_other uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when f.status = 'accepted' then 'friends' when f.user_id = p_me then 'outgoing' else 'incoming' end
    from public.online_friends f where (f.user_id = p_me and f.friend_id = p_other) or (f.user_id = p_other and f.friend_id = p_me) limit 1), 'none') $$;

-- create the Online profile the first time an account visits ProMouser Online
create or replace function public.o_ensure(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare base text; uname text; dname text; tries int := 0;
begin
  if exists (select 1 from public.online_profiles where user_id = p_user) then return; end if;
  select left(coalesce(nullif(trim(name), ''), 'Player'), 32) into dname from public.profiles where id = p_user;
  if dname is null then raise exception 'NO_PROFILE'; end if;
  base := left(regexp_replace(lower(dname), '[^a-z0-9_]', '', 'g'), 14);
  if char_length(base) < 3 then base := 'player'; end if;
  loop
    uname := base || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from public.online_profiles where lower(username) = lower(uname));
    tries := tries + 1; if tries > 20 then uname := 'player' || floor(random() * 1e8)::bigint; exit; end if;
  end loop;
  insert into public.online_profiles (user_id, username, display_name, border, showcase) values (p_user, uname, dname, 'b-clean', 'm-starter')
    on conflict do nothing;
  insert into public.online_inventory (user_id, item_id, source) select p_user, id, 'free' from public.online_items where free on conflict do nothing;
end $$;

create or replace function public.o_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.o_valid_grad(g jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select g is null or (jsonb_typeof(g) = 'object' and jsonb_typeof(g -> 'colors') = 'array'
    and jsonb_array_length(g -> 'colors') between 2 and 3
    and not exists (select 1 from jsonb_array_elements_text(g -> 'colors') c where c !~ '^#[0-9a-fA-F]{6}$')
    and coalesce((g ->> 'angle')::int, 90) between 0 and 360) $$;

-- ---------------------------------------------------------------- me
create or replace function public.o_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); o public.online_profiles; p public.profiles; t boolean;
begin
  perform public.o_ensure(uid);
  update public.online_profiles set last_seen = now() where user_id = uid returning * into o;
  select * into p from public.profiles where id = uid;
  t := public.o_turbo(uid);
  if t then insert into public.online_inventory (user_id, item_id, source) select uid, id, 'turbo' from public.online_items where turbo on conflict do nothing; end if;
  return jsonb_build_object(
    'user_id', uid, 'email', (select email from auth.users where id = uid), 'username', o.username, 'display_name', o.display_name, 'bio', o.bio,
    'avatar_url', o.avatar_url, 'border', o.border, 'showcase', o.showcase, 'name_grad', o.name_grad, 'theme', o.theme,
    'coins', o.coins, 'xp', o.xp, 'level', public.o_level(o.xp), 'bp_season', o.bp_season, 'bp_xp', o.bp_xp, 'bp_claims', o.bp_claims,
    'stats', o.stats, 'created_at', o.created_at,
    'coins_today', case when o.coins_day = public.o_today() then o.coins_today else 0 end,
    'daily_claimed', o.daily_day = public.o_today(), 'daily_streak', o.daily_streak,
    'turbo', t, 'turbo_until', p.turbo_until,
    'inventory', coalesce((select jsonb_agg(item_id order by acquired_at) from public.online_inventory where user_id = uid), '[]'::jsonb),
    'promouser', jsonb_build_object('name', p.name, 'plan', p.plan, 'member_since', p.created_at, 'cps_best', p.cps_best,
      'recommendations', (select count(*) from public.recommendation_runs where user_id = uid)),
    'unread', (select count(*) from public.online_messages where recipient = uid and read_at is null),
    'requests', (select count(*) from public.online_friends where friend_id = uid and status = 'pending'));
end $$;

create or replace function public.o_set_profile(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); t boolean := public.o_turbo(uid);
begin
  perform public.o_ensure(uid);
  if p ? 'username' then
    if (p ->> 'username') !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'BAD_USERNAME'; end if;
    if exists (select 1 from public.online_profiles where lower(username) = lower(p ->> 'username') and user_id <> uid) then raise exception 'USERNAME_TAKEN'; end if;
    update public.online_profiles set username = p ->> 'username' where user_id = uid;
  end if;
  if p ? 'display_name' then
    if char_length(trim(p ->> 'display_name')) not between 1 and 32 then raise exception 'BAD_NAME'; end if;
    update public.online_profiles set display_name = trim(p ->> 'display_name') where user_id = uid;
  end if;
  if p ? 'bio' then update public.online_profiles set bio = left(coalesce(p ->> 'bio', ''), 160) where user_id = uid; end if;
  if p ? 'avatar_url' then update public.online_profiles set avatar_url = nullif(p ->> 'avatar_url', '') where user_id = uid; end if;
  if p ? 'border' then
    if p ->> 'border' is not null and not exists (select 1 from public.online_inventory i join public.online_items x on x.id = i.item_id where i.user_id = uid and i.item_id = p ->> 'border' and x.kind = 'border') then raise exception 'NOT_OWNED'; end if;
    update public.online_profiles set border = p ->> 'border' where user_id = uid;
  end if;
  if p ? 'showcase' then
    if p ->> 'showcase' is not null and not exists (select 1 from public.online_inventory i join public.online_items x on x.id = i.item_id where i.user_id = uid and i.item_id = p ->> 'showcase' and x.kind = 'mouse') then raise exception 'NOT_OWNED'; end if;
    update public.online_profiles set showcase = p ->> 'showcase' where user_id = uid;
  end if;
  if p ? 'name_grad' or p ? 'theme' then
    if not t and (jsonb_typeof(p -> 'name_grad') = 'object' or jsonb_typeof(p -> 'theme') = 'object') then raise exception 'TURBO_REQUIRED'; end if;
    if not public.o_valid_grad(nullif(p -> 'name_grad', 'null'::jsonb)) or not public.o_valid_grad(nullif(p -> 'theme', 'null'::jsonb)) then raise exception 'BAD_GRADIENT'; end if;
    if p ? 'name_grad' then update public.online_profiles set name_grad = nullif(p -> 'name_grad', 'null'::jsonb) where user_id = uid; end if;
    if p ? 'theme' then update public.online_profiles set theme = nullif(p -> 'theme', 'null'::jsonb) where user_id = uid; end if;
  end if;
  return public.o_me();
end $$;

create or replace function public.o_daily() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); o public.online_profiles; bonus int;
begin
  perform public.o_ensure(uid);
  select * into o from public.online_profiles where user_id = uid for update;
  if o.daily_day = public.o_today() then raise exception 'ALREADY_CLAIMED'; end if;
  o.daily_streak := case when o.daily_day = public.o_today() - 1 then least(o.daily_streak + 1, 7) else 1 end;
  bonus := 40 + o.daily_streak * 10;
  update public.online_profiles set coins = coins + bonus, daily_day = public.o_today(), daily_streak = o.daily_streak where user_id = uid;
  return jsonb_build_object('coins', bonus, 'streak', o.daily_streak);
end $$;

-- ---------------------------------------------------------------- people
create or replace function public.o_profile(p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); o public.online_profiles; p public.profiles; t boolean;
begin
  select * into o from public.online_profiles where lower(username) = lower(p_username);
  if not found then raise exception 'NO_SUCH_USER'; end if;
  select * into p from public.profiles where id = o.user_id;
  t := public.o_turbo(o.user_id);
  return public.o_card(o.user_id) || jsonb_build_object(
    'bio', o.bio, 'showcase', o.showcase, 'theme', case when t then o.theme end, 'stats', o.stats, 'xp', o.xp, 'created_at', o.created_at,
    'cps_best', p.cps_best, 'member_since', p.created_at, 'friend', public.o_friend_status(uid, o.user_id), 'me', o.user_id = uid,
    'items', coalesce((select jsonb_agg(item_id) from public.online_inventory where user_id = o.user_id), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(r) from (select game, score, won, created_at from public.online_results where user_id = o.user_id order by created_at desc limit 8) r), '[]'::jsonb));
end $$;

create or replace function public.o_search(p_q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); q text := regexp_replace(coalesce(p_q, ''), '[^A-Za-z0-9_]', '', 'g');
begin
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(public.o_card(user_id) || jsonb_build_object('friend', public.o_friend_status(uid, user_id)) order by char_length(username))
    from (select user_id, username from public.online_profiles where username ilike q || '%' and user_id <> uid order by char_length(username) limit 10) s), '[]'::jsonb);
end $$;

create or replace function public.o_friends() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid();
begin
  perform public.o_ensure(uid);
  return coalesce((select jsonb_agg(x order by (x ->> 'status') <> 'incoming', x ->> 'last_msg' desc nulls last, x ->> 'username') from (
    select public.o_card(other) || jsonb_build_object('status', case when f.status = 'accepted' then 'friends' when f.user_id = uid then 'outgoing' else 'incoming' end,
      'unread', (select count(*) from public.online_messages m where m.sender = other and m.recipient = uid and m.read_at is null),
      'last_msg', (select max(created_at) from public.online_messages m where (m.sender = other and m.recipient = uid) or (m.sender = uid and m.recipient = other))) as x
    from public.online_friends f cross join lateral (select case when f.user_id = uid then f.friend_id else f.user_id end as other) o
    where (f.user_id = uid or f.friend_id = uid) and exists (select 1 from public.online_profiles where user_id = other)) s), '[]'::jsonb);
end $$;

create or replace function public.o_friend_add(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); st text;
begin
  if p_user = uid then raise exception 'CANNOT_ADD_SELF'; end if;
  if not exists (select 1 from public.online_profiles where user_id = p_user) then raise exception 'NO_SUCH_USER'; end if;
  st := public.o_friend_status(uid, p_user);
  if st = 'incoming' then update public.online_friends set status = 'accepted' where user_id = p_user and friend_id = uid; return 'friends'; end if;
  if st = 'none' then
    if (select count(*) from public.online_friends where user_id = uid and status = 'pending' and created_at > now() - interval '1 hour') >= 30 then raise exception 'SLOW_DOWN'; end if;
    insert into public.online_friends (user_id, friend_id) values (uid, p_user); return 'outgoing';
  end if;
  return st;
end $$;

create or replace function public.o_friend_remove(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.online_friends where (user_id = public.o_uid() and friend_id = p_user) or (user_id = p_user and friend_id = public.o_uid()) $$;

-- ---------------------------------------------------------------- direct messages (friends only)
create or replace function public.o_dm_list(p_user uuid, p_before bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid();
begin
  update public.online_messages set read_at = now() where sender = p_user and recipient = uid and read_at is null;
  return coalesce((select jsonb_agg(m order by m.id) from (
    select id, sender, recipient, body, created_at, read_at from public.online_messages
    where least(sender, recipient) = least(uid, p_user) and greatest(sender, recipient) = greatest(uid, p_user)
      and (p_before is null or id < p_before) order by id desc limit 60) m), '[]'::jsonb);
end $$;

create or replace function public.o_dm_send(p_user uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); b text := trim(coalesce(p_body, '')); r public.online_messages;
begin
  if public.o_friend_status(uid, p_user) <> 'friends' then raise exception 'NOT_FRIENDS'; end if;
  if char_length(b) not between 1 and 500 then raise exception 'BAD_MESSAGE'; end if;
  if (select count(*) from public.online_messages where sender = uid and created_at > now() - interval '10 seconds') >= 8 then raise exception 'SLOW_DOWN'; end if;
  insert into public.online_messages (sender, recipient, body) values (uid, p_user, b) returning * into r;
  return to_jsonb(r);
end $$;

-- ---------------------------------------------------------------- lobbies
create or replace function public.o_games_mp() returns text[]
language sql immutable set search_path = '' as $$ select array['arena', 'cps-duel', 'reaction-duel', 'aim-rush', 'tracking', 'royale'] $$;

create or replace function public.o_lobby_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', l.id, 'code', l.code, 'host', l.host, 'game', l.game, 'name', l.name, 'is_public', l.is_public,
    'max_players', l.max_players, 'status', l.status, 'settings', l.settings, 'round', l.round, 'updated_at', l.updated_at,
    'members', coalesce((select jsonb_agg(public.o_card(m.user_id) order by m.joined_at) from public.online_lobby_members m where m.lobby_id = l.id), '[]'::jsonb))
  from public.online_lobbies l where l.id = p_id $$;

create or replace function public.o_leave_all(p_user uuid, p_except uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare l record;
begin
  for l in select m.lobby_id from public.online_lobby_members m where m.user_id = p_user and m.lobby_id is distinct from p_except loop
    delete from public.online_lobby_members where lobby_id = l.lobby_id and user_id = p_user;
    if not exists (select 1 from public.online_lobby_members where lobby_id = l.lobby_id) then
      update public.online_lobbies set status = 'closed', updated_at = now() where id = l.lobby_id;
    else
      update public.online_lobbies set host = (select user_id from public.online_lobby_members where lobby_id = l.lobby_id order by joined_at limit 1), updated_at = now()
        where id = l.lobby_id and host = p_user;
    end if;
  end loop;
end $$;

create or replace function public.o_lobby_create(p_game text, p_name text, p_public boolean default true, p_max int default 8, p_settings jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); c text; lid uuid;
begin
  perform public.o_ensure(uid);
  if not (p_game = any (public.o_games_mp())) then raise exception 'BAD_GAME'; end if;
  if (select count(*) from public.online_lobbies where host = uid and created_at > now() - interval '1 minute') >= 5 then raise exception 'SLOW_DOWN'; end if;
  perform public.o_leave_all(uid);
  loop
    c := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.online_lobbies where code = c);
  end loop;
  insert into public.online_lobbies (code, host, game, name, is_public, max_players, settings)
    values (c, uid, p_game, left(coalesce(nullif(trim(p_name), ''), 'Lobby'), 40), coalesce(p_public, true), least(greatest(coalesce(p_max, 8), 2), 16), coalesce(p_settings, '{}'::jsonb))
    returning id into lid;
  insert into public.online_lobby_members (lobby_id, user_id) values (lid, uid);
  return public.o_lobby_json(lid);
end $$;

create or replace function public.o_lobby_join(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); l public.online_lobbies;
begin
  perform public.o_ensure(uid);
  select * into l from public.online_lobbies where code = upper(trim(p_code)) or id::text = p_code;
  if not found or l.status = 'closed' then raise exception 'LOBBY_NOT_FOUND'; end if;
  if exists (select 1 from public.online_lobby_members where lobby_id = l.id and user_id = uid) then return public.o_lobby_json(l.id); end if;
  if (select count(*) from public.online_lobby_members where lobby_id = l.id) >= l.max_players then raise exception 'LOBBY_FULL'; end if;
  perform public.o_leave_all(uid, l.id);
  insert into public.online_lobby_members (lobby_id, user_id) values (l.id, uid);
  update public.online_lobbies set updated_at = now() where id = l.id;
  return public.o_lobby_json(l.id);
end $$;

create or replace function public.o_lobby_leave(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid();
begin
  delete from public.online_lobby_members where lobby_id = p_id and user_id = uid;
  if not exists (select 1 from public.online_lobby_members where lobby_id = p_id) then
    update public.online_lobbies set status = 'closed', updated_at = now() where id = p_id;
  else
    update public.online_lobbies set host = (select user_id from public.online_lobby_members where lobby_id = p_id order by joined_at limit 1), updated_at = now()
      where id = p_id and host = uid;
  end if;
end $$;

create or replace function public.o_lobby(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); l public.online_lobbies;
begin
  select * into l from public.online_lobbies where id = p_id;
  if not found then raise exception 'LOBBY_NOT_FOUND'; end if;
  if not l.is_public and not exists (select 1 from public.online_lobby_members where lobby_id = p_id and user_id = uid) then raise exception 'LOBBY_NOT_FOUND'; end if;
  return public.o_lobby_json(p_id);
end $$;

create or replace function public.o_lobbies() returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by (x ->> 'status') = 'playing', x ->> 'updated_at' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', l.id, 'code', l.code, 'game', l.game, 'name', l.name, 'status', l.status, 'max_players', l.max_players,
      'players', (select count(*) from public.online_lobby_members m where m.lobby_id = l.id), 'host', public.o_card(l.host), 'updated_at', l.updated_at) x
    from public.online_lobbies l
    where l.is_public and l.status <> 'closed' and l.updated_at > now() - interval '3 hours'
      and exists (select 1 from public.online_lobby_members m where m.lobby_id = l.id)
    order by l.updated_at desc limit 50) s $$;

create or replace function public.o_lobby_update(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); l public.online_lobbies;
begin
  select * into l from public.online_lobbies where id = p_id for update;
  if not found or l.host <> uid then raise exception 'NOT_HOST'; end if;
  if p ? 'game' and not ((p ->> 'game') = any (public.o_games_mp())) then raise exception 'BAD_GAME'; end if;
  if p ? 'status' and (p ->> 'status') not in ('open', 'playing') then raise exception 'BAD_STATUS'; end if;
  update public.online_lobbies set
    game = coalesce(p ->> 'game', game), name = left(coalesce(nullif(trim(p ->> 'name'), ''), name), 40),
    is_public = coalesce((p ->> 'is_public')::boolean, is_public),
    max_players = greatest(least(coalesce((p ->> 'max_players')::int, max_players), 16), 2, (select count(*) from public.online_lobby_members where lobby_id = p_id)::int),
    settings = case when p ? 'settings' and pg_column_size(p -> 'settings') < 4000 then p -> 'settings' else settings end,
    status = coalesce(p ->> 'status', status),
    round = round + case when (p ->> 'status') = 'playing' and status <> 'playing' then 1 else 0 end,
    updated_at = now()
  where id = p_id;
  return public.o_lobby_json(p_id);
end $$;

create or replace function public.o_lobby_kick(p_id uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid();
begin
  if not exists (select 1 from public.online_lobbies where id = p_id and host = uid) then raise exception 'NOT_HOST'; end if;
  if p_user = uid then raise exception 'CANNOT_KICK_SELF'; end if;
  delete from public.online_lobby_members where lobby_id = p_id and user_id = p_user;
  return public.o_lobby_json(p_id);
end $$;

-- ---------------------------------------------------------------- games: results, coins, XP, leaderboards
-- Scores are checked against realistic limits and coins are capped per game and per day,
-- so a modified browser can't print coins.
create or replace function public.o_submit(p_game text, p_score numeric, p_won boolean default false, p_lobby uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); o public.online_profiles; c int; x int; today date := public.o_today(); lvl int; st jsonb; best numeric; low boolean := p_game = 'reaction-duel';
  lim numeric := case p_game when 'arena' then 80 when 'cps-duel' then 35 when 'reaction-duel' then 2000 when 'aim-rush' then 20000 when 'tracking' then 100
    when 'gallery' then 40000 when 'royale' then 12 when 'simon' then 60 end;
begin
  perform public.o_ensure(uid);
  if lim is null then raise exception 'BAD_GAME'; end if;
  if p_score is null or p_score < 0 or p_score > lim or (low and p_score < 80) then raise exception 'BAD_SCORE'; end if;
  if exists (select 1 from public.online_results where user_id = uid and game = p_game and created_at > now() - interval '5 seconds') then raise exception 'SLOW_DOWN'; end if;
  c := least(120, 10 + case p_game
    when 'arena' then (p_score * 4)::int + case when p_won then 30 else 0 end
    when 'cps-duel' then (p_score * 2)::int + case when p_won then 25 else 0 end
    when 'reaction-duel' then greatest(0, (400 - p_score) / 10)::int + case when p_won then 25 else 0 end
    when 'aim-rush' then (p_score / 40)::int
    when 'tracking' then (p_score / 2)::int
    when 'gallery' then (p_score / 60)::int
    when 'royale' then (p_score * 5)::int + case when p_won then 30 else 0 end
    when 'simon' then (p_score * 3)::int end);
  select * into o from public.online_profiles where user_id = uid for update;
  if o.coins_day is distinct from today then o.coins_today := 0; end if;
  c := greatest(0, least(c, 2000 - o.coins_today));
  x := 30 + case when p_won then 30 else 0 end + least(60, c / 2);
  st := coalesce(o.stats -> p_game, '{}'::jsonb);
  best := (st ->> 'best')::numeric;
  st := jsonb_build_object('played', coalesce((st ->> 'played')::int, 0) + 1, 'wins', coalesce((st ->> 'wins')::int, 0) + case when p_won then 1 else 0 end,
    'best', case when best is null then p_score when low then least(best, p_score) else greatest(best, p_score) end);
  lvl := public.o_level(o.xp);
  update public.online_profiles set coins = coins + c, coins_day = today, coins_today = o.coins_today + c, xp = xp + x, bp_xp = bp_xp + x,
    stats = jsonb_set(stats, array[p_game], st) where user_id = uid;
  insert into public.online_results (user_id, game, score, won, lobby_id, coins) values (uid, p_game, p_score, coalesce(p_won, false), p_lobby, c);
  return jsonb_build_object('coins', c, 'xp', x, 'capped', o.coins_today + c >= 2000, 'level', public.o_level(o.xp + x), 'level_up', public.o_level(o.xp + x) > lvl,
    'best', st -> 'best', 'new_best', best is null or (case when low then p_score < best else p_score > best end), 'bp_tier', least(30, (o.bp_xp + x) / 400));
end $$;

create or replace function public.o_leaderboard(p_game text) returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.o_card(user_id) || jsonb_build_object('score', score) order by case when p_game = 'reaction-duel' then score else -score end), '[]'::jsonb)
  from (select user_id, case when p_game = 'reaction-duel' then min(score) else max(score) end as score
        from public.online_results where game = p_game group by user_id
        order by case when p_game = 'reaction-duel' then min(score) else -max(score) end limit 20) s $$;

-- ---------------------------------------------------------------- shop, Turbo, battle pass
create or replace function public.o_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); it public.online_items;
begin
  perform public.o_ensure(uid);
  select * into it from public.online_items where id = p_item;
  if not found or it.coins is null then raise exception 'NOT_FOR_COINS'; end if;
  if exists (select 1 from public.online_inventory where user_id = uid and item_id = p_item) then raise exception 'ALREADY_OWNED'; end if;
  update public.online_profiles set coins = coins - it.coins where user_id = uid and coins >= it.coins;
  if not found then raise exception 'NOT_ENOUGH_COINS'; end if;
  insert into public.online_inventory (user_id, item_id, source) values (uid, p_item, 'coins');
  return public.o_me();
end $$;

create or replace function public.o_claim_tier(p_track text, p_tier int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.o_uid(); o public.online_profiles; r public.online_bp_rewards;
begin
  perform public.o_ensure(uid);
  select * into o from public.online_profiles where user_id = uid for update;
  select * into r from public.online_bp_rewards where season = o.bp_season and track = p_track and tier = p_tier;
  if not found then raise exception 'NO_REWARD'; end if;
  if o.bp_xp / 400 < p_tier then raise exception 'TIER_LOCKED'; end if;
  if p_track = 'turbo' and not public.o_turbo(uid) then raise exception 'TURBO_REQUIRED'; end if;
  if (o.bp_claims -> p_track) @> to_jsonb(p_tier) then raise exception 'ALREADY_CLAIMED'; end if;
  update public.online_profiles set coins = coins + r.coins,
    bp_claims = jsonb_set(bp_claims, array[p_track], coalesce(bp_claims -> p_track, '[]'::jsonb) || to_jsonb(p_tier)) where user_id = uid;
  if r.item_id is not null then insert into public.online_inventory (user_id, item_id, source) values (uid, r.item_id, 'pass') on conflict do nothing; end if;
  return public.o_me();
end $$;

-- ---------------------------------------------------------------- permissions
do $$ declare f text; begin
  foreach f in array array['o_me()', 'o_set_profile(jsonb)', 'o_daily()', 'o_profile(text)', 'o_search(text)', 'o_friends()', 'o_friend_add(uuid)',
    'o_friend_remove(uuid)', 'o_dm_list(uuid, bigint)', 'o_dm_send(uuid, text)', 'o_lobby_create(text, text, boolean, int, jsonb)', 'o_lobby_join(text)',
    'o_lobby_leave(uuid)', 'o_lobby(uuid)', 'o_lobbies()', 'o_lobby_update(uuid, jsonb)', 'o_lobby_kick(uuid, uuid)', 'o_submit(text, numeric, boolean, uuid)',
    'o_leaderboard(text)', 'o_buy(text)', 'o_claim_tier(text, int)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['o_ensure(uuid)', 'o_card(uuid)', 'o_turbo(uuid)', 'o_friend_status(uuid, uuid)', 'o_lobby_json(uuid)', 'o_leave_all(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- avatars (Supabase Storage)
-- A public "avatars" bucket; each user can only write inside a folder named after their id.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do update set public = true;
    execute 'drop policy if exists "avatar upload" on storage.objects';
    execute 'drop policy if exists "avatar update" on storage.objects';
    execute 'drop policy if exists "avatar delete" on storage.objects';
    execute $p$create policy "avatar upload" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "avatar update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "avatar delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;
