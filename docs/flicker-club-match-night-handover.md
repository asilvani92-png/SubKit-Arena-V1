# Flicker Club Match Night — Handover Document

> **Project:** SubKit (Subbuteo card collection + game app)
> **Repo:** https://github.com/asilvani92-png/SubKit
> **Supabase Project:** `uejjtqbbzvwvcuvnvann`
> **Supabase URL:** https://uejjtqbbzvwvcuvnvann.supabase.co
> **Status:** Migration applied ✅, code written ✅, build passing ✅

---

## Table of Contents

1. [What's Been Built](#1-whats-been-built)
2. [Schema Overview](#2-schema-overview)
3. [Key Files](#3-key-files)
4. [Match Engine API](#4-match-engine-api)
5. [UI Components](#5-ui-components)
6. [Edge Functions](#6-edge-functions)
7. [Next Steps / TODO](#7-next-steps--todo)
8. [Techniques to Avoid Cline Crashes](#8-techniques-to-avoid-cline-crashes)

---

## 1. What's Been Built

The "Flicker Club Match Night" game layer adds football match simulation to the Subbuteo card collection app. Users can:

- Manage a **flicker club** (manager profile with XP, ELO, club name)
- Start a **match vs AI** (one of 20 seeded house teams) or challenge another player
- Watch a **simulated match** with a canvas pitch, commentary feed, and action bar with AP-gated shouts
- See **post-match results** with stats, man of the match, and timeline

The match uses a turn-based AP system (6 AP per user per half) with shouts, momentum, and possession mechanics.

---

## 2. Schema Overview

### New Tables

| Table | Purpose | RLS |
|---|---|---|
| `team_players` | Generated squad (14 players per collection) | Select/All for own collections via auth |
| `matches` | Match state (score, AP, shouts, momentum, possession, etc) | Select/Insert/Update for participants |
| `match_events` | Append-only event log (goals, saves, fouls, commentary) | Select/Insert for participants |
| `match_actions` | User action log (shouts, subs, etc) | Select for participants, Insert for self |
| `flicker_clubs` | Manager profile (club name, ELO, XP, W/D/L) | Select public, Insert/Update for self |

### Extended Tables

| Table | New Columns |
|---|---|
| `teams` | `base_rating`, `primary_colour`, `secondary_colour`, `is_house_team`, `ai_difficulty_tier`, `era` |
| `collections` | `notes`, `team_name`, `team_rarity`, `condition`, `is_complete`, `player_slots` |

### House Teams

20 seeded teams with hardcoded UUIDs (`00000000-0000-0000-0000-000000000001` through `00000000-0000-0000-0000-000000000020`). Rarity tiers: Common (rating 68-78), Uncommon (80-84), Rare (85-88), Ultra Rare (86), Legend (92). Difficulty tiers 1-3.

### SQL Migration Files (in run order)

| File | What it does |
|---|---|
| `supabase/migrations/20260609000000_flicker_club_match_night.sql` | ALTER teams/collections + CREATE team_players w/ RLS |
| `supabase/migrations/20260609000000_flicker_club_match_night_part2.sql` | CREATE matches table w/ RLS |
| `supabase/migrations/20260609000000_flicker_club_match_night_part3.sql` | CREATE match_events + match_actions + flicker_clubs w/ RLS |
| `supabase/migrations/20260609000000_flicker_club_match_night_seed_a.sql` | 10 house teams (Brazil '70 → Liverpool '84) |
| `supabase/migrations/20260609000000_flicker_club_match_night_seed_b.sql` | 10 house teams (Barcelona '09 → Porto '04) |

---

## 3. Key Files

### Core Logic

| File | Purpose |
|---|---|
| `src/pages/GameArena.jsx` | Main match orchestrator — handles pre-match, match loop, half-time, full-time |
| `src/pages/Matches.jsx` | "Find Match" page — start AI match or challenge a player |
| `src/lib/db.js` | DB abstraction — maps entity names to real table names (`teams`, `collections`, `profiles`, `team_players`, `matches`, `match_events`, `flicker_clubs`) |
| `packages/game-engine/src/index.js` | Match engine — all simulation logic (1000+ lines, 40+ exported functions) |

### UI Components

| File | Purpose |
|---|---|
| `src/components/game/MatchPitch.jsx` | Canvas-based 12-zone pitch rendering |
| `src/components/game/MatchHUD.jsx` | Score, clock, AP, speed controls |
| `src/components/game/CommentaryFeed.jsx` | Scrolling text commentary with templates |
| `src/components/game/ActionBar.jsx` | Shouts, actions, subs with AP gating |
| `src/components/game/MatchResult.jsx` | Full-time stats, MoM, timeline |

### House Teams Data

| File | Purpose |
|---|---|
| `src/data/house-teams.json` | 20 teams with colours, eras, base_ratings |

### Edge Functions

| File | Purpose |
|---|---|
| `supabase/functions/generate-squad/index.ts` | Generate 14 players (11+3 subs) for a collection. Uses deterministic seeded RNG + position templates |
| `supabase/functions/match-recap/index.ts` | Generate AI post-match recap text |
| `supabase/functions/verify-team/index.ts` | Verify a team photo (gives +3 stat bonus) |
| `supabase/functions/apply-flicker-schema/index.ts` | Script to apply all SQL |

---

## 4. Match Engine API

All in `packages/game-engine/src/index.js`:

### Core State

```
MatchState {
  matchId, homeCollectionId, awayCollectionId, homeUserId, awayUserId,
  homePlayers, awayPlayers,
  homeScore, awayScore, minute, speed,
  homeAP, awayAP,
  homeShout, awayShout, homeShoutExpires, awayShoutExpires,
  possession ("home"|"away"), ballZone ("B1"..."C4"|null),
  homeMomentum, awayMomentum,
  actionLog, events, completed, halfTime
}
```

### Key Functions

| Function | Description |
|---|---|
| `createMatchState()` | Initialises a match from two team/collection objects |
| `simulateTick(state)` | Advances one tick (minute ÷ 4). Returns new state + events |
| `handleUserAction(state, action)` | Processes a user action (shout, sub, nothing) |
| `canUserAct(state)` | Checks if user has remaining AP this half |
| `processMatchAction(state)` | Runs one simulation step, returns updated state |
| `getShouts()` | Returns available shout types with AP costs |
| `recalculateShoutExpiry(state)` | Removes expired shouts |
| `recalculateMomentum(state)` | Recalculates momentum based on score, possession, events |
| `determinePossession(state)` | Determines which team has possession based on momentum |
| `processGoal(state, scoringTeam, player, assister)` | Handles a goal event |
| `processFoul(state, player)` | Handles a foul event |
| `applySubstitution(state, team, outSlot, inSlot)` | Applies a substitution |
| Game engine also tracks: fatigue accumulation, successful passes, tackles, interceptions, shots on/off target, etc

---

## 5. UI Components

### GameArena.jsx (Match Orchestrator)

**States:** `loading` → `pre_match` → `playing` → `half_time` → `playing` → `full_time`

- Pre-match: picks AI team, creates match in DB, calls generate-squad Edge Function for both sides
- Playing: runs simulation ticks, updates match in DB, fetches events
- Half-time: waits for user to confirm
- Full-time: shows MatchResult, updates flicker_clubs stats

### MatchPitch.jsx

- Canvas-based with 3 zones (Defence, Midfield, Attack) × 4 lanes (Left, Centre-Left, Centre-Right, Right) = 12 zones
- Shows ball position indicator
- Colour-coded by team (primary/secondary colours from house-teams.json)

### MatchHUD.jsx

- Team names + scores (home left, away right)
- Clock (MM' format)
- AP indicators (filled/empty dots)
- Shout indicator (if active)
- Speed toggle (slow/normal/fast/instant)

### CommentaryFeed.jsx

- Scrolling list of templated commentary lines
- Colour codes: yellow for fouls, red for cards, green for goals
- Shows player names + outcome

### ActionBar.jsx

- Buttons for: "Fire Up" (1 AP), "Park the Bus" (2 AP), "All-Out Attack" (2 AP), "Time Waste" (1 AP)
- Each shout lasts 4 minutes, applies a tactical modifier (see engine)
- Greyed-out when AP depleted
- Substitution button (3 AP, limited to 3 per match)

### MatchResult.jsx

- Final score in large text
- "Man of the Match" badge
- Key stats: possession, shots, shots on target, fouls, cards
- Timeline (scrollable event list)
- XP/ELO chang

---

## 6. Edge Functions

### `generate-squad`

**Endpoint:** POST `https://uejjtqbbzvwvcuvnvann.supabase.co/functions/v1/generate-squad`

**Body:**
```json
{ "collection_id": "uuid", "formation": "4-4-2" }
```

**Flow:**
1. Fetch collection from `collections` table
2. Fetch team from `teams` table
3. Delete existing players from `team_players` for this collection
4. Generate 14 players (11 starting + 3 subs) using deterministic seeded RNG
5. Insert into `team_players`
6. Return players array

**Formations supported:** 4-4-2, 4-3-3, 4-5-1, 3-5-2, 4-2-3-1, 5-3-2, 3-4-3, 4-1-2-1-2

**Rarity bonus:** If `collection.is_verified` is true, +3 to all stats (photo verification bonus)

**Deploy:**
```bash
supabase functions deploy generate-squad --no-verify-jwt
```

### `match-recap`

Generates AI-written post-match commentary. Incomplete — needs the OpenAI/Claude integration wired up.

### `verify-team`

Verifies a team photo. Incomplete — needs Supabase Storage integration and image processing.

---

## 7. Next Steps / TODO

### High Priority

- [ ] **Deploy Edge Functions:** `supabase functions deploy generate-squad --no-verify-jwt` (required for Match vs AI to work)
- [ ] **Wire up Post-Match Flow:** After a match completes in GameArena, write XP and ELO updates to `flicker_clubs` table. Currently the engine produces `homeStats`/`awayStats` in the match result but the persistence isn't wired.
- [ ] **"Play Again" button:** After MatchResult, add a button to go back to Matches page or rematch the same AI team
- [ ] **Handle match state conflicts:** If both players are human, need polling for opponent actions or async turn notification

### Medium Priority

- [ ] **League/Leaderboard page:** Read from `flicker_clubs` ordered by `elo_rating` DESC
- [ ] **Player-vs-Player challenge flow:** The "Challenge a Player" CTA on Matches page needs the backend (create match with awaiting opponent, notify them, etc)
- [ ] **verify-team deployment:** Wire up `supabase functions deploy verify-team` + Supabase Storage bucket for team photos
- [ ] **match-recap deployment:** Wire up OpenAI/Claude API key as secret, then deploy
- [ ] **Substitution UI in ActionBar:** Currently has placeholder — needs actual player-in/player-out selection
- [ ] **Formation selector in pre-match:** Let user pick formation before kickoff
- [ ] **Tactics selector:** Pre-set tactic (balanced/defensive/attacking) modifies AI behaviour

### Low Priority / Polish

- [ ] **Sound effects:** Goal sound, whistle, crowd noise
- [ ] **3D pitch rendering** or animated player dots on canvas
- [ ] **Replay system:** Rewatch key moments from match_events
- [ ] **Tournament/Cup mode:** Bracket generation from `flicker_clubs` ELO
- [ ] **Mobile responsiveness:** The canvas pitch and action bar need testing on mobile

### Known Issues

- `GameArena.jsx` imports `db.updateMatch()` but this function isn't exported from `db.js` — currently commented out. Need to implement or wire it properly.
- `MatchPitch.jsx` canvas rendering may need resizing for different screen sizes.
- The `speed` toggle doesn't fully work — switching to "instant" should skip all remaining ticks instantly.
- AI opponent always uses default formation (4-4-2) — would be better to randomise based on the house team's era/style.

---

## 8. Techniques to Avoid Cline Crashes

This project was built with Cline (AI coding agent). Cline can crash when handling very large file outputs. To avoid this in future sessions:

1. **Break long SQL files into parts** — split migration into 5 small files instead of 1 big one
2. **Use `execute_command` with heredocs** for writing files with long content (e.g. `cat >> file.sql << 'EOF' ... EOF`)
3. **Keep individual tool outputs under ~2000 lines** — write in chunks, one logical section per call
4. **Use `tmp` files for intermediate results** — `write_to_file` for short content, heredocs for long content
5. **Watch token count** — if context window exceeds 80%, start a fresh task branch
6. **Git commit/push frequently** — this resets the working state and reduces cognitive load

---

## Quick Reference Commands

```bash
# Deploy edge functions
supabase functions deploy generate-squad --no-verify-jwt
supabase functions deploy match-recap --no-verify-jwt
supabase functions deploy verify-team --no-verify-jwt

# Run locally
npm run dev

# Build
npm run build

# Deploy to Vercel (if configured)
npm run build
vercel --prod
```

---

*Handover prepared 09 June 2026. For questions, refer to the commits in `git log` starting from `0b4e9cf`*.