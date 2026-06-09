# GRF Migration Guide
## Replacing the SubKit Arena custom engine with Google Research Football

---

## What changed

| Old                                    | New                                     |
|----------------------------------------|-----------------------------------------|
| `packages/game-engine/index.js`        | Deleted — GRF runs server-side          |
| Physics / simulation JS                | `grf-backend/server.py` (Python)        |
| Game rules in JS                       | `grf-backend/match_rules.py` (Python)   |
| Any hook that ran the engine client-side | `src/useGRFEngine.js` (thin WS client)  |
| Direct obs parsing (if any)            | `src/parseGRFObs.js`                    |

Your game rules (AP, zones, events, formations, fatigue, commentary) **did not change** —
they now live in `match_rules.py` server-side and are sent back to the client each tick.

---

## 1. Backend setup (one-time)

```bash
# Recommend Python 3.8–3.10 (GRF doesn't support 3.11+ yet on all platforms)
cd grf-backend

# Linux / macOS
pip install gfootball fastapi "uvicorn[standard]" websockets numpy

# If gfootball compile fails on Linux, install system deps first:
# sudo apt-get install cmake libgl1-mesa-dev libsdl2-dev libsdl2-image-dev \
#   libsdl2-ttf-dev libsdl2-gfx-dev libboost-all-dev

uvicorn server:app --host 0.0.0.0 --port 8765
```

Test it's running:
```
curl http://localhost:8765/health
# → {"status":"ok","grf_available":true}
```

If `grf_available` is `false`, GRF isn't installed — the server still works with
the built-in stub environment so your UI development isn't blocked.

---

## 2. Environment variable

Add to your `.env.local`:

```
VITE_GRF_WS_URL=ws://localhost:8765/env
```

For production (Railway, Render, etc.):
```
VITE_GRF_WS_URL=wss://your-backend.railway.app/env
```

---

## 3. Remove the old engine package

```bash
# In your repo root:
rm -rf packages/game-engine
```

Update `package.json` — remove any local workspace reference to game-engine.

---

## 4. Replace the engine import in your match page

Find wherever you imported / instantiated the old engine. Replace it with:

```jsx
// Before (old engine)
import { createEngine } from '@subkit/game-engine';
const engine = createEngine(homeTeam, awayTeam);

// After (GRF)
import { useGRFEngine } from './useGRFEngine';

function MatchPage({ homeTeam, awayTeam }) {
  const matchConfig = {
    scenario:       '11_vs_11_stochastic',
    representation: 'raw',
    home_team:      homeTeam,   // { name, ref, baseRating, year }
    away_team:      awayTeam,
    match_type:     'friendly',
    formation:      '4-4-2',
    tactic:         'balanced',
  };

  const {
    state,          // score, AP, zones, fatigue, formation...
    obs,            // raw GRF positions → feed to PitchRenderer
    commentary,
    lastEvent,
    connected,
    step,           // advance one GRF tick
    managerAction,  // spend AP
    freePrompt,     // dead-ball choices (free, corner, penalty...)
  } = useGRFEngine(matchConfig);

  // ...
}
```

---

## 5. Update your PitchRenderer

The renderer previously read from the old engine's state.
Now it reads `obs` (raw GRF positions) via `parseGRFObs`:

```jsx
import { parseGRFObs, grfToCanvas } from './parseGRFObs';

function PitchRenderer({ obs, state, canvasRef }) {
  const parsed = parseGRFObs(obs, 'raw');
  if (!parsed) return null;

  const W = canvasRef.current?.width  ?? 800;
  const H = canvasRef.current?.height ?? 600;

  // Ball dot
  const ball = grfToCanvas(parsed.ball.x, parsed.ball.y, W, H);

  // Home team dots
  const homeDots = parsed.home.map(p => grfToCanvas(p.x, p.y, W, H));

  // Away team dots
  const awayDots = parsed.away.map(p => grfToCanvas(p.x, p.y, W, H));

  // Draw on canvas...
}
```

---

## 6. Manager actions

```jsx
// Tactical shout (1 AP)
managerAction('TACTICAL_SHOUT', { shout: 'PUSH_UP' });

// Demand shot (2 AP)
managerAction('DEMAND_SHOT', { zone: state.ball_zone });

// Killer ball (2 AP)
managerAction('KILLER_BALL');

// Hard tackle (2 AP)
managerAction('HARD_TACKLE');

// Substitution (1 AP)
managerAction('SUBSTITUTION', { out: 9, in: 0 });  // squad indices

// Formation change (1 AP)
managerAction('FORMATION_CHANGE', { formation: '4-3-3', tactic: 'counter_attack' });

// Man mark (2 AP)
managerAction('MAN_MARK', { defender: 2, attacker: 0 });

// Time wasting (1 AP, last 15 mins + winning)
managerAction('TIME_WASTING');

// All out attack (3 AP)
managerAction('ALL_OUT_ATTACK');

// Park the bus (3 AP)
managerAction('PARK_THE_BUS');
```

---

## 7. Free prompts (no AP cost)

```jsx
// Corner
freePrompt('corner', 'near_post');   // 'near_post' | 'far_post' | 'short_corner'

// Free kick
freePrompt('free_kick', 'shoot');    // 'shoot' | 'cross' | 'short_pass'

// Penalty
freePrompt('penalty', 'left');       // 'left' | 'centre' | 'right'

// Goal kick
freePrompt('goal_kick', 'long');     // 'short' | 'long'

// Kick off
freePrompt('kick_off', 'play_short'); // 'play_short' | 'launch_long'
```

---

## 8. Game loop

GRF doesn't auto-advance — you call `step()` with an action each tick.
For the automated AI side (away team), the server controls it.
For the match speed controls, drive `step()` from an interval:

```jsx
const TICKS_PER_SECOND = {
  slow:   6,
  normal: 9,
  fast:   15,
};

useEffect(() => {
  if (!connected || !ready) return;

  const interval = setInterval(() => {
    step(0);  // action 0 = idle; GRF internally simulates both teams
  }, 1000 / TICKS_PER_SECOND[speed]);

  return () => clearInterval(interval);
}, [connected, ready, step, speed]);
```

---

## 9. GRF scenario reference

| Scenario                    | Description                              |
|-----------------------------|------------------------------------------|
| `11_vs_11_stochastic`       | Full 11v11 with random AI (recommended)  |
| `11_vs_11_easy_stochastic`  | Easier AI opponent                       |
| `11_vs_11_hard_stochastic`  | Harder AI opponent                       |
| `academy_empty_goal`        | Dev/test: one attacker vs empty goal     |
| `academy_pass_and_shoot`    | Dev/test: two attackers vs keeper        |

Use `11_vs_11_stochastic` for all match types in production.

---

## 10. Deployment (Railway / Render)

The backend is a standard FastAPI app.

**railway.toml:**
```toml
[build]
builder = "nixpacks"
buildCommand = "pip install gfootball fastapi uvicorn websockets numpy"

[deploy]
startCommand = "uvicorn server:app --host 0.0.0.0 --port $PORT"
```

Note: GRF requires CMake + SDL2 at build time. On Railway, add a Dockerfile
instead of nixpacks for reliable GRF compilation:

```dockerfile
FROM python:3.9-slim

RUN apt-get update && apt-get install -y \
    cmake build-essential libgl1-mesa-dev \
    libsdl2-dev libsdl2-image-dev libsdl2-ttf-dev \
    libsdl2-gfx-dev libboost-all-dev git

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8765"]
```
