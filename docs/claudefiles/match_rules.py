"""
match_rules.py
──────────────
Flicker Club Match Night — rules layer.

This module wraps the raw GRF game state and enforces all the rules
from your game plan gist:

  • 12-zone pitch grid
  • Event resolution formula
  • AP (Action Points) system
  • Manager actions (shouts, demand shot, killer ball, etc.)
  • Free prompts (corner, free kick, penalty, etc.)
  • Fatigue / stamina degradation
  • Formation zone mapping
  • Tactical presets
  • Commentary generation
  • Man-mark, substitutions, cards
"""

import random
import math
from typing import Optional

# ─── Zone grid ────────────────────────────────────────────────────────────────
# From the home team's perspective. Each tuple is (row, col).
ZONES = [
    "DEF_L", "DEF_C", "DEF_R",
    "MID_L", "MID_C", "MID_R",
    "ATT_L", "ATT_C", "ATT_R",
    "BOX_L", "BOX_C", "BOX_R",
]

ATTACKING_ZONES = {"ATT_L", "ATT_C", "ATT_R", "BOX_L", "BOX_C", "BOX_R"}
BOX_ZONES       = {"BOX_L", "BOX_C", "BOX_R"}
WIDE_ZONES      = {"DEF_L", "DEF_R", "MID_L", "MID_R", "ATT_L", "ATT_R"}
CENTRAL_ZONES   = {"DEF_C", "MID_C", "ATT_C", "BOX_C"}

# Forward progression map (home team advancing)
NEXT_ZONE = {
    "DEF_L": "MID_L",  "DEF_C": "MID_C",  "DEF_R": "MID_R",
    "MID_L": "ATT_L",  "MID_C": "ATT_C",  "MID_R": "ATT_R",
    "ATT_L": "BOX_L",  "ATT_C": "BOX_C",  "ATT_R": "BOX_R",
    "BOX_L": "BOX_C",  "BOX_C": "BOX_C",  "BOX_R": "BOX_C",
}
PREV_ZONE = {v: k for k, v in NEXT_ZONE.items() if v != k}

# ─── Event definitions ────────────────────────────────────────────────────────
# (event_type, primary_stat, secondary_stat, threshold_range)
EVENT_TABLE = {
    "short_pass":   ("passing",   "vision",      (35, 45)),
    "long_pass":    ("passing",   "technique",   (45, 60)),
    "through_ball": ("vision",    "passing",     (55, 70)),
    "dribble":      ("dribbling", "pace",        (50, 65)),
    "cross":        ("crossing",  "technique",   (45, 55)),
    "shot":         ("shooting",  "technique",   (45, 75)),   # range depends on zone
    "header":       ("heading",   "strength",    (50, 65)),
    "tackle":       ("tackling",  "strength",    (45, 60)),
    "interception": ("positioning","vision",     (45, 60)),
    "block":        ("positioning","bravery",    (45, 60)),
    "save":         ("handling",  "reflexes",    (40, 60)),
    "free_kick":    ("set_pieces","shooting",    (45, 65)),
    "corner":       ("set_pieces","crossing",    (40, 55)),
    "penalty":      ("shooting",  "composure",   (55, 70)),
    "goal_kick":    ("handling",  "passing",     (40, 55)),
}

SHOT_THRESHOLD = {
    "ATT_L": (60, 75), "ATT_C": (60, 75), "ATT_R": (60, 75),  # outside box
    "BOX_L": (45, 60), "BOX_C": (45, 60), "BOX_R": (45, 60),  # inside box
}

# ─── Formations ───────────────────────────────────────────────────────────────
FORMATION_ZONES = {
    "4-4-2":   ["DEF_L","DEF_C","DEF_C","DEF_R","MID_L","MID_C","MID_C","MID_R","ATT_C","ATT_C"],
    "4-3-3":   ["DEF_L","DEF_C","DEF_C","DEF_R","MID_C","MID_C","MID_C","ATT_L","ATT_C","ATT_R"],
    "4-5-1":   ["DEF_L","DEF_C","DEF_C","DEF_R","MID_L","MID_C","MID_C","MID_C","MID_R","ATT_C"],
    "3-5-2":   ["DEF_C","DEF_C","DEF_C","MID_L","MID_C","MID_C","MID_C","MID_R","ATT_C","ATT_C"],
    "4-2-3-1": ["DEF_L","DEF_C","DEF_C","DEF_R","MID_C","MID_C","MID_L","MID_C","MID_R","ATT_C"],
    "5-3-2":   ["DEF_L","DEF_C","DEF_C","DEF_C","DEF_R","MID_C","MID_C","MID_C","ATT_C","ATT_C"],
    "3-4-3":   ["DEF_C","DEF_C","DEF_C","MID_L","MID_C","MID_C","MID_R","ATT_L","ATT_C","ATT_R"],
    "4-1-2-1-2":["DEF_L","DEF_C","DEF_C","DEF_R","MID_C","MID_C","MID_C","ATT_C","ATT_C","ATT_C"],
}

# ─── Tactical preset modifiers ────────────────────────────────────────────────
TACTIC_MODS = {
    "balanced":      {},
    "attacking":     {"shot_freq": +0.15, "def_events": -0.10},
    "defensive":     {"def_events": +0.15, "shot_freq": -0.10},
    "counter_attack":{"long_pass_bonus": +0.20, "possession_weight": -0.20},
    "possession":    {"short_pass_bonus": +0.20, "through_ball": -0.15},
    "direct":        {"long_pass_freq": +0.20, "short_pass": -0.10},
}

# ─── AP by match type ─────────────────────────────────────────────────────────
STARTING_AP = {"friendly": 8, "ranked": 6, "cup": 6, "league": 6}

# ─── Commentary templates ─────────────────────────────────────────────────────
COMMENTARY = {
    "short_pass_success":   ["{p} slides it to a teammate.", "{p} keeps it simple, nice pass."],
    "short_pass_fail":      ["{p}'s pass is cut out!", "Loose ball — {opp} pounce!"],
    "shot_on_target":       ["{p} forces a save!", "{p} tests the keeper!"],
    "shot_off_target":      ["{p} drags it wide.", "{p}'s effort sails over."],
    "goal":                 ["GOAL! {p} slots it home!", "THE NET BULGES! {p} scores!"],
    "save":                 ["What a save from the keeper!", "Brilliant stop!"],
    "dribble_success":      ["{p} beats the defender!", "{p} glides past!"],
    "dribble_fail":         ["Tackled! {p} loses it.", "{opp} makes a clean tackle."],
    "tackle":               ["{p} wins the ball cleanly.", "Strong challenge from {p}."],
    "foul":                 ["Foul by {p}. Free kick.", "{p} brings them down — the ref whistles."],
    "yellow_card":          ["{p} is booked!", "Yellow card for {p}."],
    "red_card":             ["{p} is sent off! Down to ten men!", "Straight red — {p} walks."],
    "corner":               ["Corner kick. {home} looking to deliver."],
    "free_kick":            ["Free kick in a promising position."],
    "penalty":              ["PENALTY! The ref points to the spot!"],
    "half_time":            ["Half-time. {home} {hs} – {as} {away}."],
    "full_time":            ["Full-time. {home} {hs} – {as} {away}. What a match!"],
    "push_up":              ["The manager shouts: Push Up!"],
    "hold_firm":            ["The manager shouts: Hold Firm!"],
    "all_out_attack":       ["All Out Attack — everything forward!"],
    "park_the_bus":         ["Parking the bus. Defend, defend, defend."],
    "sub":                  ["{out} makes way. {inp} comes on."],
    "injury":               ["{p} is down. This looks serious."],
}

def _comment(key, **kwargs) -> str:
    templates = COMMENTARY.get(key, [key])
    tmpl = random.choice(templates)
    return tmpl.format(**kwargs)


class MatchRules:
    """
    Stateful rules layer that wraps each GRF tick.
    Instantiated per WebSocket session.
    """

    def __init__(self, match_type="friendly", home_team=None, away_team=None,
                 formation="4-4-2", tactic="balanced"):
        self.match_type  = match_type
        self.home_team   = home_team or {}
        self.away_team   = away_team or {}
        self.formation   = formation
        self.tactic      = tactic

        self.score          = [0, 0]
        self.match_time     = 0          # 0–90
        self.half           = 1
        self.action_points  = STARTING_AP.get(match_type, 6)
        self.subs_used      = 0
        self.sticky_actions = set()
        self.shout_expires  = 0          # match_time minute
        self.man_mark       = None       # {"defender": idx, "attacker": idx}
        self.ball_zone      = "MID_C"
        self.possession     = 0          # 0 = home, 1 = away
        self.last_event     = None
        self._commentary    = []
        self._ticks         = 0
        self.match_stats    = {
            "home_shots": 0, "away_shots": 0,
            "home_possession": 0, "away_possession": 0,
            "home_fouls": 0, "away_fouls": 0,
            "home_corners": 0, "away_corners": 0,
            "home_yellows": 0, "away_yellows": 0,
            "home_reds": 0, "away_reds": 0,
        }
        self.game_mode      = "normal"
        self.pending_prompt = None       # free prompt awaiting client choice

        # Player roster stubs (populated from team data via generate_squad in grf-stats)
        # For now: 11 slots per side with fatigue tracking
        self._home_fatigue = [0.0] * 11
        self._away_fatigue = [0.0] * 11

    # ─── Called every GRF tick ────────────────────────────────────────────────
    def tick(self, grf_state: dict):
        self._ticks += 1
        # GRF runs ~3000 steps per 90-min match
        self.match_time  = min(90, self._ticks / 3000 * 90)
        self.score       = grf_state.get("score", self.score)
        self.possession  = int(grf_state.get("ball_owned_team", self.possession))
        if self.possession < 0: self.possession = self.possession  # no change

        # Advance match stats
        if self.possession == 0:
            self.match_stats["home_possession"] += 1
        else:
            self.match_stats["away_possession"] += 1

        # Expire shout
        if self.shout_expires and self.match_time >= self.shout_expires:
            self.sticky_actions.discard("active_shout")
            self.shout_expires = 0

        # Expire fresh-legs boost (tracked by tick count)
        # Fatigue drain — Press Hard multiplier
        drain_mult = 1.5 if "press_hard" in self.sticky_actions else 1.0
        base_drain = 90 / 3000  # ≈ 0.03 per tick = 1 fatigue unit per minute
        for i in range(11):
            self._home_fatigue[i] = min(100, self._home_fatigue[i] + base_drain * drain_mult)

        # Half-time
        if self.half == 1 and self.match_time >= 45:
            self.half = 2
            ht_comment = _comment(
                "half_time",
                home=self.home_team.get("name","Home"),
                away=self.away_team.get("name","Away"),
                hs=self.score[0], as_=self.score[1],
            )
            self._commentary.append(ht_comment)
            self.last_event = {"type": "half_time", "time": 45}

    # ─── Manager actions (AP costing) ─────────────────────────────────────────
    def apply_manager_action(self, action: str, sub_data: dict = None) -> dict:
        sub_data = sub_data or {}

        AP_COSTS = {
            "TACTICAL_SHOUT":   1,
            "DEMAND_SHOT":      2,
            "KILLER_BALL":      2,
            "HARD_TACKLE":      2,
            "SUBSTITUTION":     1,
            "FORMATION_CHANGE": 1,
            "MAN_MARK":         2,
            "TIME_WASTING":     1,
            "ALL_OUT_ATTACK":   3,
            "PARK_THE_BUS":     3,
        }

        cost = AP_COSTS.get(action, 99)
        if self.action_points < cost:
            return {"ok": False, "reason": f"Need {cost} AP, have {self.action_points}"}

        # Validate and apply
        if action == "TACTICAL_SHOUT":
            shout = sub_data.get("shout", "PUSH_UP")
            self.sticky_actions.discard("active_shout")
            self.sticky_actions.add(shout.lower())
            self.sticky_actions.add("active_shout")
            self.shout_expires = self.match_time + 10
            self._commentary.append(_comment(shout.lower()))

        elif action == "DEMAND_SHOT":
            if self.possession != 0:
                return {"ok": False, "reason": "You must have possession"}
            self.sticky_actions.add("demand_shot_next")
            self._commentary.append("Manager demands a shot!")

        elif action == "KILLER_BALL":
            if self.possession != 0:
                return {"ok": False, "reason": "You must have possession"}
            self.sticky_actions.add("killer_ball_next")
            self._commentary.append("Through ball coming — killer ball!")

        elif action == "HARD_TACKLE":
            if self.possession == 0:
                return {"ok": False, "reason": "Opponent must have the ball"}
            self.sticky_actions.add("hard_tackle_next")
            self._commentary.append("Go in hard!")

        elif action == "SUBSTITUTION":
            if self.subs_used >= 3:
                return {"ok": False, "reason": "All 3 substitutes used"}
            if self.match_time >= 90:
                return {"ok": False, "reason": "Match has ended"}
            out_idx = sub_data.get("out", 0)
            in_idx  = sub_data.get("in", 0)
            self.subs_used += 1
            # Reset fatigue for incoming player
            if 0 <= out_idx < 11:
                self._home_fatigue[out_idx] = 0.0
            self._commentary.append(_comment("sub", out=f"Player {out_idx}", inp=f"Sub {in_idx}"))

        elif action == "FORMATION_CHANGE":
            new_form = sub_data.get("formation", self.formation)
            self.formation = new_form
            new_tactic = sub_data.get("tactic", self.tactic)
            self.tactic = new_tactic
            self._commentary.append(f"Formation change to {new_form}.")

        elif action == "MAN_MARK":
            defender = sub_data.get("defender", 0)
            attacker = sub_data.get("attacker", 0)
            self.man_mark = {"defender": defender, "attacker": attacker}
            self._commentary.append(f"Player {defender} set to man-mark opponent {attacker}.")

        elif action == "TIME_WASTING":
            if self.match_time < 75:
                return {"ok": False, "reason": "Only in last 15 minutes"}
            if self.score[0] <= self.score[1]:
                return {"ok": False, "reason": "Must be winning to time-waste"}
            self.sticky_actions.add("time_wasting")
            self._commentary.append("Time wasting. Run the clock down.")

        elif action == "ALL_OUT_ATTACK":
            self.sticky_actions.discard("park_the_bus")
            self.sticky_actions.add("all_out_attack")
            self._commentary.append(_comment("all_out_attack"))

        elif action == "PARK_THE_BUS":
            self.sticky_actions.discard("all_out_attack")
            self.sticky_actions.add("park_the_bus")
            self._commentary.append(_comment("park_the_bus"))

        else:
            return {"ok": False, "reason": "Unknown action"}

        self.action_points -= cost
        self.last_event = {"type": "manager_action", "action": action}
        return {"ok": True, "ap_remaining": self.action_points}

    # ─── Free prompts (no AP cost) ────────────────────────────────────────────
    def apply_free_prompt(self, prompt: str, choice: str) -> dict:
        """
        Handle dead-ball prompt responses.
        These don't cost AP — they route the next GRF action via an override.
        """
        valid = {
            "free_kick": ["shoot", "cross", "short_pass"],
            "corner":    ["near_post", "far_post", "short_corner"],
            "penalty":   ["left", "centre", "right"],
            "goal_kick": ["short", "long"],
            "kick_off":  ["play_short", "launch_long"],
        }
        if prompt not in valid:
            return {"ok": False, "reason": "Unknown prompt"}
        if choice not in valid[prompt]:
            return {"ok": False, "reason": f"Invalid choice for {prompt}"}

        # The engine will use this on the next step() call
        self.sticky_actions.add(f"prompt_{prompt}_{choice}")
        return {"ok": True, "prompt": prompt, "choice": choice}

    # ─── Event resolution (for events the rules layer generates independently) ──
    @staticmethod
    def resolve_event(primary: float, secondary: float,
                      threshold_range: tuple, modifiers: float = 0.0) -> bool:
        """
        outcome_score = (primary × 0.55) + (secondary × 0.25) + (rand × 0.20) + modifiers
        success if outcome_score >= threshold (drawn from range)
        """
        rand_component = random.uniform(1, 100) * 0.20
        score = (primary * 0.55) + (secondary * 0.25) + rand_component + modifiers
        threshold = random.uniform(*threshold_range)
        return score >= threshold

    # ─── State snapshot (sent to client) ─────────────────────────────────────
    def state_snapshot(self) -> dict:
        total_ticks = max(1, self.match_stats["home_possession"] + self.match_stats["away_possession"])
        return {
            "match_time":    round(self.match_time, 1),
            "half":          self.half,
            "score":         self.score,
            "action_points": self.action_points,
            "subs_used":     self.subs_used,
            "possession":    self.possession,
            "ball_zone":     self.ball_zone,
            "formation":     self.formation,
            "tactic":        self.tactic,
            "sticky_actions": list(self.sticky_actions),
            "man_mark":      self.man_mark,
            "game_mode":     self.game_mode,
            "home_fatigue":  [round(f, 1) for f in self._home_fatigue],
            "possession_pct": round(
                self.match_stats["home_possession"] / total_ticks * 100, 1
            ),
        }

    def match_stats(self) -> dict:
        total_ticks = max(1, self.match_stats["home_possession"] + self.match_stats["away_possession"])
        return {
            **self.match_stats,
            "final_score": self.score,
            "home_possession_pct": round(self.match_stats["home_possession"] / total_ticks * 100, 1),
        }

    def pop_commentary(self) -> list:
        out = self._commentary[:]
        self._commentary = []
        return out

    def reset_for_new_match(self):
        self.__init__(
            match_type=self.match_type,
            home_team=self.home_team,
            away_team=self.away_team,
            formation=self.formation,
            tactic=self.tactic,
        )
