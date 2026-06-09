-- Flicker Club Match Night: full schema for the football match layer.
-- Replaces the turn-based match shape with a football match shape.
-- Adds team_players (generated squads), match_events (event log),
-- match_actions (user action log), flicker_clubs (manager profile).

-- =========================================================================
-- 1. Extend teams catalogue
-- =========================================================================
alter table if exists public."SubbuteoTeam"
  add column if not exists base_rating integer default 60
    check (base_rating between 1 and 99);
alter table if exists public."SubbuteoTeam"
  add column if not exists primary_colour text;
alter table if exists public."SubbuteoTeam"
  add column if not exists secondary_colour text;
alter table if exists public."SubbuteoTeam"
  add column if not exists is_house_team boolean default false;
alter table if exists public."SubbuteoTeam"
  add column if not exists ai_difficulty_tier integer default 1
    check (ai_difficulty_tier between 1 and 3);

-- =========================================================================
-- 2. Drop old turn-based matches and rebuild
-- =========================================================================
-- The previous matches table was turn-based. We rebuild it for football.
drop table if exists public.match_events cascade;
drop table if exists public.match_actions cascade;
drop table if exists public.flicker_clubs cascade;
drop table if exists public.matches cascade;

-- =========================================================================
-- 3. matches — football match metadata + live state snapshot
-- =========================================================================
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  home_user_id uuid references public.users(id) on delete cascade,
  away_user_id uuid references public.users(id) on delete set null,
  home_collection_id uuid references public."UserCollection"(id) on delete set null,
  away_collection_id uuid references public."UserCollection"(id) on delete set null,
  home_team_name text,
  away_team_name text,
  match_type text not null default 'friendly'
    check (match_type in ('friendly','ranked','cup','league','ai')),
  status text not null default 'pending'
    check (status in ('pending','active','half_time','completed','abandoned')),
  is_ai_match boolean not null default false,
  home_formation text,
  away_formation text,
  home_tactic text default 'balanced',
  away_tactic text default 'balanced',
  home_score integer not null default 0,
  away_score integer not null default 0,
  current_minute integer not null default 0,
  home_ap_remaining integer not null default 6,
  away_ap_remaining integer not null default 6,
  home_active_shout text,
  home_shout_expires_minute integer,
  away_active_shout text,
  away_shout_expires_minute integer,
  home_momentum integer not null default 0,
  possession text not null default 'home' check (possession in ('home','away','none')),
  ball_zone text,
  speed text not null default 'normal' check (speed in ('slow','normal','fast','instant')),
  is_async boolean not null default false,
  winner_user_id uuid references public.users(id) on delete set null,
  man_of_the_match_player_id text,
  home_subs_used integer not null default 0,
  away_subs_used integer not null default 0,
  action_log jsonb not null default '[]'::jsonb,
  board_state jsonb,
  stats jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists matches_home_user_idx on public.matches (home_user_id, created_at desc);
create index if not exists matches_away_user_idx on public.matches (away_user_id, created_at desc);
create index if not exists matches_status_idx on public.matches (status);

alter table public.matches enable row level security;

create policy "matches: select for participants and ai matches"
  on public.matches for select
  to authenticated
  using ( home_user_id = (select auth.uid()) or away_user_id = (select auth.uid()) );

create policy "matches: insert for self as home"
  on public.matches for insert
  to authenticated
  with check ( home_user_id = (select auth.uid()) );

create policy "matches: update for participants"
  on public.matches for update
  to authenticated
  using ( home_user_id = (select auth.uid()) or away_user_id = (select auth.uid()) )
  with check ( home_user_id = (select auth.uid()) or away_user_id = (select auth.uid()) );

-- =========================================================================
-- 4. match_events — append-only event log
-- =========================================================================
create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  minute integer not null,
  tick integer not null default 0,
  event_type text not null,
  team text check (team in ('home','away','none')),
  acting_player_id text,
  opposing_player_id text,
  zone text,
  outcome text check (outcome in ('success','fail','goal','save','foul','card','info')),
  outcome_score numeric,
  threshold numeric,
  is_user_action boolean not null default false,
  commentary text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists match_events_match_minute_idx
  on public.match_events (match_id, minute);

alter table public.match_events enable row level security;

create policy "match_events: select for participants"
  on public.match_events for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_events.match_id
        and (m.home_user_id = (select auth.uid()) or m.away_user_id = (select auth.uid()))
    )
  );

create policy "match_events: insert for participants"
  on public.match_events for insert
  to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_events.match_id
        and (m.home_user_id = (select auth.uid()) or m.away_user_id = (select auth.uid()))
    )
  );

-- =========================================================================
-- 5. match_actions — user action log (for replays and analytics)
-- =========================================================================
create table if not exists public.match_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  minute integer not null,
  action_type text not null,
  action_detail jsonb,
  ap_cost integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists match_actions_match_idx
  on public.match_actions (match_id);

alter table public.match_actions enable row level security;

create policy "match_actions: select for participants"
  on public.match_actions for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_actions.match_id
        and (m.home_user_id = (select auth.uid()) or m.away_user_id = (select auth.uid()))
    )
  );

create policy "match_actions: insert for own actions"
  on public.match_actions for insert
  to authenticated
  with check ( user_id = (select auth.uid()) );

-- =========================================================================
-- 6. flicker_clubs — manager profile (XP, level, Elo, club identity)
-- =========================================================================
create table if not exists public.flicker_clubs (
  user_id uuid primary key references public.users(id) on delete cascade,
  club_name text,
  club_badge_url text,
  club_motto text,
  home_ground_name text,
  manager_xp integer not null default 0,
  manager_level integer not null default 1,
  elo_rating integer not null default 1000,
  matches_played integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.flicker_clubs enable row level security;

create policy "flicker_clubs: select public"
  on public.flicker_clubs for select
  to authenticated
  using ( true );

create policy "flicker_clubs: insert for self"
  on public.flicker_clubs for insert
  to authenticated
  with check ( user_id = (select auth.uid()) );

create policy "flicker_clubs: update for self"
  on public.flicker_clubs for update
  to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- =========================================================================
-- 7. update existing UserCollection.user_id reference (already present, no-op safety)
-- =========================================================================
-- The existing UserCollection in the schema didn't have user_id — the JS code
-- (FindMatch.jsx) assumes it. The original schema (line 1-10) had `users` but
-- UserCollection itself is in entity JSON only. We don't touch it here.
