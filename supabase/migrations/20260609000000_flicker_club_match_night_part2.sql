-- Flicker Club Match Night migration - PART 2
-- Run after 20260609000000_flicker_club_match_night.sql in the same SQL editor.
-- Idempotent: safe to re-run.

-- 4. matches - drop and rebuild for football
DROP TABLE IF EXISTS public.match_events CASCADE;
DROP TABLE IF EXISTS public.match_actions CASCADE;
DROP TABLE IF EXISTS public.flicker_clubs CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  away_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
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
  winner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  man_of_the_match_player_id text,
  home_subs_used integer NOT NULL DEFAULT 0,
  away_subs_used integer NOT NULL DEFAULT 0,
  action_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  board_state jsonb,
  stats jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matches_home_user_idx ON public.matches (home_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_away_user_idx ON public.matches (away_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_status_idx ON public.matches (status);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_select" ON public.matches;
CREATE POLICY "matches_select" ON public.matches FOR SELECT TO authenticated USING (home_user_id = auth.uid() OR away_user_id = auth.uid());
DROP POLICY IF EXISTS "matches_insert" ON public.matches;
CREATE POLICY "matches_insert" ON public.matches FOR INSERT TO authenticated WITH CHECK (home_user_id = auth.uid());
DROP POLICY IF EXISTS "matches_update" ON public.matches;
CREATE POLICY "matches_update" ON public.matches FOR UPDATE TO authenticated USING (home_user_id = auth.uid() OR away_user_id = auth.uid()) WITH CHECK (home_user_id = auth.uid() OR away_user_id = auth.uid());
