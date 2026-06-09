-- Flicker Club Match Night migration - PART 3
-- Run after part2 in the same SQL editor.
-- Idempotent: safe to re-run.

-- 5. match_events - append-only event log
CREATE TABLE public.match_events (
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
);
CREATE INDEX IF NOT EXISTS match_events_match_idx ON public.match_events (match_id, minute);
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_events_select" ON public.match_events;
CREATE POLICY "match_events_select" ON public.match_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_events.match_id AND (m.home_user_id = auth.uid() OR m.away_user_id = auth.uid())));
DROP POLICY IF EXISTS "match_events_insert" ON public.match_events;
CREATE POLICY "match_events_insert" ON public.match_events FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_events.match_id AND (m.home_user_id = auth.uid() OR m.away_user_id = auth.uid())));

-- 6. match_actions - user action log
CREATE TABLE public.match_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  minute integer NOT NULL,
  action_type text NOT NULL,
  action_detail jsonb,
  ap_cost integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_actions_select" ON public.match_actions;
CREATE POLICY "match_actions_select" ON public.match_actions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_actions.match_id AND (m.home_user_id = auth.uid() OR m.away_user_id = auth.uid())));
DROP POLICY IF EXISTS "match_actions_insert" ON public.match_actions;
CREATE POLICY "match_actions_insert" ON public.match_actions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 7. flicker_clubs - manager profile
CREATE TABLE public.flicker_clubs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
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
);
ALTER TABLE public.flicker_clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flicker_clubs_select" ON public.flicker_clubs;
CREATE POLICY "flicker_clubs_select" ON public.flicker_clubs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "flicker_clubs_insert" ON public.flicker_clubs;
CREATE POLICY "flicker_clubs_insert" ON public.flicker_clubs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "flicker_clubs_update" ON public.flicker_clubs;
CREATE POLICY "flicker_clubs_update" ON public.flicker_clubs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
