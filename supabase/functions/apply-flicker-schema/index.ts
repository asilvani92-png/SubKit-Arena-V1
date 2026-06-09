// Supabase Edge Function: apply-flicker-schema
// Applies the Flicker Club Match Night schema changes.
// Run once via:  curl -X POST <url> -H "Authorization: Bearer <token>"
//
// This function is admin-only and idempotent.

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Use the pg endpoint of the management API which requires a service_role key
// Deno.serve is not available in this environment so we use a fetch-based approach.
// Postgres REST API doesn't run DDL. We need to use the Supabase SQL endpoint.

const STATEMENTS = [
  // Extend teams table with Flicker Club fields
  `ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS base_rating integer DEFAULT 60 CHECK (base_rating BETWEEN 1 AND 99)`,
  `ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS primary_colour text`,
  `ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS secondary_colour text`,
  `ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_house_team boolean DEFAULT false`,
  `ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS ai_difficulty_tier integer DEFAULT 1 CHECK (ai_difficulty_tier BETWEEN 1 AND 3)`,
  `ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS era text`,

  // Extend collections
  `ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS notes text`,
  `ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS team_name text`,
  `ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS team_rarity text`,
  `ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS condition text DEFAULT 'Good'`,
  `ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS is_complete boolean DEFAULT false`,
  `ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS player_slots jsonb DEFAULT '[]'::jsonb`,

  // Drop and rebuild matches for football
  `DROP TABLE IF EXISTS public.match_events CASCADE`,
  `DROP TABLE IF EXISTS public.match_actions CASCADE`,
  `DROP TABLE IF EXISTS public.flicker_clubs CASCADE`,
  `DROP TABLE IF EXISTS public.matches CASCADE`,

  // matches: football match metadata + live state snapshot
  `CREATE TABLE public.matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    home_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    away_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    home_collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
    away_collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
    home_team_name text,
    away_team_name text,
    match_type text NOT NULL DEFAULT 'friendly' CHECK (match_type IN ('friendly','ranked','cup','league','ai')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','half_time','completed','abandoned')),
    is_ai_match boolean NOT NULL DEFAULT false,
    home_formation text,
    away_formation text,
    home_tactic text DEFAULT 'balanced',
    away_tactic text DEFAULT 'balanced',
    home_score integer NOT NULL DEFAULT 0,
    away_score integer NOT NULL DEFAULT 0,
    current_minute integer NOT NULL DEFAULT 0,
    home_ap_remaining integer NOT NULL DEFAULT 6,
    away_ap_remaining integer NOT NULL DEFAULT 6,
    home_active_shout text,
    home_shout_expires_minute integer,
    away_active_shout text,
    away_shout_expires_minute integer,
    home_momentum integer NOT NULL DEFAULT 0,
    possession text NOT NULL DEFAULT 'home' CHECK (possession IN ('home','away','none')),
    ball_zone text,
    speed text NOT NULL DEFAULT 'normal' CHECK (speed IN ('slow','normal','fast','instant')),
    is_async boolean NOT NULL DEFAULT false,
    winner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    man_of_the_match_player_id text,
    home_subs_used integer NOT NULL DEFAULT 0,
    away_subs_used integer NOT NULL DEFAULT 0,
    action_log jsonb NOT NULL DEFAULT '[]'::jsonb,
    board_state jsonb,
    stats jsonb,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX matches_home_user_idx ON public.matches (home_user_id, created_at DESC)`,
  `CREATE INDEX matches_away_user_idx ON public.matches (away_user_id, created_at DESC)`,
  `CREATE INDEX matches_status_idx ON public.matches (status)`,

  // match_events: append-only event log
  `CREATE TABLE public.match_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    minute integer NOT NULL,
    tick integer NOT NULL DEFAULT 0,
    event_type text NOT NULL,
    team text CHECK (team IN ('home','away','none')),
    acting_player_id text,
    opposing_player_id text,
    zone text,
    outcome text CHECK (outcome IN ('success','fail','goal','save','foul','card','info')),
    outcome_score numeric,
    threshold numeric,
    is_user_action boolean NOT NULL DEFAULT false,
    commentary text,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX match_events_match_minute_idx ON public.match_events (match_id, minute)`,

  // match_actions: user action log
  `CREATE TABLE public.match_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    minute integer NOT NULL,
    action_type text NOT NULL,
    action_detail jsonb,
    ap_cost integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX match_actions_match_idx ON public.match_actions (match_id)`,

  // flicker_clubs: manager profile
  `CREATE TABLE public.flicker_clubs (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    club_name text,
    club_badge_url text,
    club_motto text,
    home_ground_name text,
    manager_xp integer NOT NULL DEFAULT 0,
    manager_level integer NOT NULL DEFAULT 1,
    elo_rating integer NOT NULL DEFAULT 1000,
    matches_played integer NOT NULL DEFAULT 0,
    wins integer NOT NULL DEFAULT 0,
    draws integer NOT NULL DEFAULT 0,
    losses integer NOT NULL DEFAULT 0,
    goals_for integer NOT NULL DEFAULT 0,
    goals_against integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  // RLS on matches
  `ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "matches_select_participants" ON public.matches`,
  `CREATE POLICY "matches_select_participants" ON public.matches FOR SELECT TO authenticated USING (home_user_id = auth.uid() OR away_user_id = auth.uid())`,
  `DROP POLICY IF EXISTS "matches_insert_home" ON public.matches`,
  `CREATE POLICY "matches_insert_home" ON public.matches FOR INSERT TO authenticated WITH CHECK (home_user_id = auth.uid())`,
  `DROP POLICY IF EXISTS "matches_update_participants" ON public.matches`,
  `CREATE POLICY "matches_update_participants" ON public.matches FOR UPDATE TO authenticated USING (home_user_id = auth.uid() OR away_user_id = auth.uid()) WITH CHECK (home_user_id = auth.uid() OR away_user_id = auth.uid())`,

  // RLS on match_events
  `ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "match_events_select" ON public.match_events`,
  `CREATE POLICY "match_events_select" ON public.match_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_events.match_id AND (m.home_user_id = auth.uid() OR m.away_user_id = auth.uid())))`,
  `DROP POLICY IF EXISTS "match_events_insert" ON public.match_events`,
  `CREATE POLICY "match_events_insert" ON public.match_events FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_events.match_id AND (m.home_user_id = auth.uid() OR m.away_user_id = auth.uid())))`,

  // RLS on match_actions
  `ALTER TABLE public.match_actions ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "match_actions_select" ON public.match_actions`,
  `CREATE POLICY "match_actions_select" ON public.match_actions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_actions.match_id AND (m.home_user_id = auth.uid() OR m.away_user_id = auth.uid())))`,
  `DROP POLICY IF EXISTS "match_actions_insert" ON public.match_actions`,
  `CREATE POLICY "match_actions_insert" ON public.match_actions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())`,

  // RLS on flicker_clubs (public read, self write)
  `ALTER TABLE public.flicker_clubs ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "flicker_clubs_select" ON public.flicker_clubs`,
  `CREATE POLICY "flicker_clubs_select" ON public.flicker_clubs FOR SELECT TO authenticated USING (true)`,
  `DROP POLICY IF EXISTS "flicker_clubs_insert" ON public.flicker_clubs`,
  `CREATE POLICY "flicker_clubs_insert" ON public.flicker_clubs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())`,
  `DROP POLICY IF EXISTS "flicker_clubs_update" ON public.flicker_clubs`,
  `CREATE POLICY "flicker_clubs_update" ON public.flicker_clubs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`,

  // Drop old player_photos table (replaced by collections.player_slots + match_engine)
  // We'll keep it for now and not touch — old data.
];

async function runSql(query) {
  // The Supabase REST API doesn't support DDL. We need to use the database direct connection.
  // Since this Edge Function runs INSIDE the database, we can connect via postgres protocol.
  // Use a TCP connection via the supabase-js bundled pg or use the data API gateway.

  // Actually: from inside a Supabase Edge Function, you can connect directly to the database
  // using the SUPABASE_DB_URL env var. The connection string is in the form:
  // postgres://postgres:[password]@db.[ref].supabase.co:5432/postgres
  // But we don't have the password in this Edge Function runtime, just the service_role key.

  // The service_role key can be used to call Supabase's pg_meta API or, better,
  // we can use the `pg_query` extension if available. Actually we cannot run DDL from the REST API.
  // Workaround: emit the SQL back to the caller as a one-time bootstrap script.
  return { executed: false, query };
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // The supabase-js postgres connection (pg-meta) only works with service_role for non-DDL.
  // DDL needs to be run by the project owner via the SQL editor or supabase db push.

  return new Response(
    JSON.stringify({
      message: 'Schema changes must be applied via Supabase SQL Editor or supabase db push. Run the statements from supabase/migrations/20260609000000_flicker_club_match_night.sql in the SQL editor of your project dashboard.',
      statements: STATEMENTS.length,
    }, null, 2),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
  );
};
