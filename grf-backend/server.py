"""
server.py
─────────
Flicker Club Match Night — GRF WebSocket backend.

One GRF environment per WebSocket connection.
The browser sends {"action": int} each tick;
the server returns full game state + the Subbuteo match-engine
layer (zones, AP, events, commentary) on top.

Install:
    pip install gfootball fastapi uvicorn websockets numpy

Run:
    uvicorn server:app --host 0.0.0.0 --port 8765
"""

import asyncio
import json
import logging
import traceback
from typing import Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# ── GRF import (server must have gfootball installed) ────────────────────────
try:
    import gfootball.env as football_env
    from gfootball.env.football_env import FootballEnv
    GRF_AVAILABLE = True
except ImportError:
    GRF_AVAILABLE = False
    logging.warning("gfootball not installed — using stub env for development")

# ── Flicker Club rules layer ──────────────────────────────────────────────────
from match_rules import MatchRules

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("flicker")

app = FastAPI(title="Flicker Club Match Night – GRF Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # dev origins — update for prod
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Stub env for dev without GRF installed
# ─────────────────────────────────────────────────────────────────────────────
class StubEnv:
    """Minimal stub that mimics the GRF simple115v2 observation shape."""

    OBS_SIZE = 115

    def __init__(self):
        self._step = 0
        self._score = [0, 0]
        self.rng = np.random.default_rng(42)

    def reset(self):
        self._step = 0
        self._score = [0, 0]
        return self._obs()

    def step(self, action):
        self._step += 1
        done = self._step >= 3000
        # Occasionally score
        if self.rng.random() < 0.005:
            self._score[0] += 1
        reward = 0.0
        if done:
            reward = float(self._score[0] - self._score[1])
        return self._obs(), reward, done, {"score": self._score[:]}

    def _obs(self):
        obs = self.rng.uniform(-1, 1, self.OBS_SIZE).astype(np.float32)
        # Encode step fraction into obs[0] so client can show progress
        obs[0] = self._step / 3000
        return obs

    def close(self):
        pass


def make_env(scenario: str, representation: str) -> object:
    if GRF_AVAILABLE:
        return football_env.create_environment(
            env_name=scenario,
            representation=representation,
            render=False,
            write_video=False,
            dump_frequency=0,
            logdir="/tmp/grf_logs",
            extra_players=None,
            number_of_left_players_agent_controls=1,
            number_of_right_players_agent_controls=0,
        )
    return StubEnv()


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket endpoint
# ─────────────────────────────────────────────────────────────────────────────
@app.websocket("/env")
async def env_session(ws: WebSocket):
    await ws.accept()
    env: Optional[object] = None
    rules: Optional[MatchRules] = None

    try:
        # ── Handshake: client sends match config ─────────────────────────────
        config_msg = await ws.receive_json()
        log.info("Session config: %s", config_msg)

        scenario      = config_msg.get("scenario", "11_vs_11_stochastic")
        representation = config_msg.get("representation", "raw")
        home_team     = config_msg.get("home_team", {})
        away_team     = config_msg.get("away_team", {})
        match_type    = config_msg.get("match_type", "friendly")  # friendly/ranked/cup/league
        formation     = config_msg.get("formation", "4-4-2")
        tactic        = config_msg.get("tactic", "balanced")

        # ── Boot GRF ─────────────────────────────────────────────────────────
        env = make_env(scenario, representation)
        raw_obs = env.reset()

        # ── Boot Flicker Club rules layer ────────────────────────────────────
        rules = MatchRules(
            match_type=match_type,
            home_team=home_team,
            away_team=away_team,
            formation=formation,
            tactic=tactic,
        )

        await _send(ws, {
            "type": "ready",
            "obs": _serialise_obs(raw_obs, representation),
            "state": rules.state_snapshot(),
        })

        # ── Main game loop ────────────────────────────────────────────────────
        while True:
            msg = await ws.receive_json()
            msg_type = msg.get("type", "step")

            if msg_type == "step":
                # Normal tick — client sends the action its AI/user chose
                action = int(msg.get("action", 0))
                raw_obs, reward, done, info = env.step(action)

                # Run Flicker Club rules on top of GRF state
                grf_state = _parse_raw(raw_obs, representation, info)
                rules.tick(grf_state)

                payload = {
                    "type": "obs",
                    "obs": _serialise_obs(raw_obs, representation),
                    "reward": float(reward),
                    "done": bool(done),
                    "state": rules.state_snapshot(),
                    "event": rules.last_event,
                    "commentary": rules.pop_commentary(),
                }
                await _send(ws, payload)

                if done:
                    env.close()
                    env = make_env(scenario, representation)
                    raw_obs = env.reset()
                    rules.reset_for_new_match()
                    await _send(ws, {
                        "type": "match_over",
                        "final_score": rules.score,
                        "stats": rules.match_stats(),
                    })

            elif msg_type == "manager_action":
                # Player uses AP to trigger a manager action
                result = rules.apply_manager_action(
                    action=msg.get("action"),
                    sub_data=msg.get("sub", {}),
                )
                await _send(ws, {
                    "type": "manager_result",
                    "result": result,
                    "state": rules.state_snapshot(),
                })

            elif msg_type == "free_prompt":
                # Dead ball prompt response (no AP cost)
                result = rules.apply_free_prompt(
                    prompt=msg.get("prompt"),
                    choice=msg.get("choice"),
                )
                await _send(ws, {
                    "type": "prompt_result",
                    "result": result,
                    "state": rules.state_snapshot(),
                })

            elif msg_type == "ping":
                await _send(ws, {"type": "pong"})

    except WebSocketDisconnect:
        log.info("Client disconnected")
    except Exception as exc:
        log.error("Session error: %s", traceback.format_exc())
        try:
            await _send(ws, {"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        if env is not None:
            try:
                env.close()
            except Exception:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
async def _send(ws: WebSocket, data: dict):
    await ws.send_text(json.dumps(data, default=_json_default))


def _json_default(obj):
    if isinstance(obj, (np.integer,)):  return int(obj)
    if isinstance(obj, (np.floating,)): return float(obj)
    if isinstance(obj, np.ndarray):     return obj.tolist()
    raise TypeError(f"Not serialisable: {type(obj)}")


def _serialise_obs(raw_obs, representation: str) -> list:
    if isinstance(raw_obs, np.ndarray):
        return raw_obs.tolist()
    if isinstance(raw_obs, (list, tuple)):
        return list(raw_obs)
    return raw_obs


def _parse_raw(raw_obs, representation: str, info: dict) -> dict:
    """
    Pull the fields Flicker Club rules needs from the raw GRF observation.
    GRF 'raw' representation exposes dict with ball, left_team, right_team etc.
    'simple115v2' is a flat float vector — we parse the known offsets.
    """
    if isinstance(raw_obs, dict):
        return raw_obs                 # already structured (raw representation)

    # simple115v2 flat vector layout (indices from GRF source):
    # [0:3]   ball xyz
    # [3:5]   ball direction xy
    # [5:8]   ball rotation
    # [8]     ball owned team  (-1/0/1)
    # [9:20]  left team active player + coords (11 × 2, interleaved)
    # ... full decode not strictly needed; rules layer uses info dict instead
    obs = np.asarray(raw_obs)
    return {
        "score": info.get("score", [0, 0]),
        "ball_owned_team": int(round(obs[8])) if len(obs) > 8 else -1,
        "game_mode": info.get("game_mode", 0),
        "steps": info.get("steps", 0),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "grf_available": GRF_AVAILABLE}
