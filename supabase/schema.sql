-- Supabase schema for SubKit
-- Run in Supabase SQL editor or psql

-- Users table (rely on Supabase auth for core fields)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text,
  display_name text,
  created_at timestamptz default now()
);

alter table if exists users enable row level security;

create policy if not exists "Allow users to select their own profile"
  on users
  for select
  using (auth.uid() = id);

create policy if not exists "Allow users to select public profiles"
  on users
  for select
  using (true);

create policy if not exists "Allow users to insert their own profile"
  on users
  for insert
  with check (auth.uid() = id);

create policy if not exists "Allow users to update their own profile"
  on users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists worlds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text default 'user_created',
  created_by uuid references users(id),
  parent_world uuid references worlds(id),
  is_joinable boolean default true,
  max_players int,
  status text default 'open',
  config jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists world_memberships (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  joined_at timestamptz default now(),
  status text default 'active'
);

create table if not exists team_verifications (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid,
  user_id uuid references users(id),
  team_name text,
  status text default 'pending',
  submitted_at timestamptz default now(),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  photo_urls jsonb default '[]'
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id),
  home_user uuid references users(id),
  away_user uuid references users(id),
  board_state jsonb,
  action_log jsonb default '[]',
  current_turn int default 0,
  engine_version text,
  status text default 'pending',
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists game_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  from_user uuid references users(id),
  message_type text,
  custom_text text,
  sent_at timestamptz default now(),
  is_game_event boolean default false
);

-- Application settings singleton
create table if not exists app_settings (
  id text primary key,
  admin_email text,
  verification_turnaround_hours int default 24,
  points_multiplier numeric default 1.0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
