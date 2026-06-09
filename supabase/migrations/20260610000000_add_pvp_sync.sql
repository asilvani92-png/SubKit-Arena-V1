-- Migration: Add awaiting_opponent status and PvP sync fields
-- Idempotent — safe to re-run.

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_status_check
  CHECK (status IN ('awaiting_opponent','pending','active','half_time','completed','abandoned'));

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_async boolean NOT NULL DEFAULT false;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS challenge_expires_at timestamptz;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz NOT NULL DEFAULT now();
