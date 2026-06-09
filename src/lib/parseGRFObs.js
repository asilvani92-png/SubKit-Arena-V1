/**
 * parseGRFObs.js
 * ──────────────
 * Converts the raw GRF observation (float array or dict) into the
 * player dot positions and ball position that your PitchRenderer needs.
 *
 * GRF "raw" representation returns a dict with these keys:
 *   ball                float[3]      x, y, z  (range [-1,1], [-0.42,0.42], [0,...])
 *   ball_direction      float[3]      velocity
 *   ball_rotation       float[3]
 *   ball_owned_team     int           -1 | 0 | 1
 *   ball_owned_player   int           0-10
 *   left_team           float[11][2]  x, y per player
 *   right_team          float[11][2]
 *   left_team_direction float[11][2]  velocity
 *   right_team_direction float[11][2]
 *   left_team_tired_factor float[11]  0.0 = fresh
 *   right_team_tired_factor float[11]
 *   left_team_active    bool[11]
 *   right_team_active   bool[11]
 *   left_team_yellow_card  bool[11]
 *   right_team_yellow_card bool[11]
 *   left_team_roles     int[11]
 *   right_team_roles    int[11]
 *   game_mode           int
 *   score               int[2]
 *   steps               int
 *   steps_left          int
 *
 * "simple115v2" is a flat float[115] — we decode the known layout.
 *
 * Output shape (what your PitchRenderer expects):
 * {
 *   ball: { x, y }                          // pitch coords, x∈[-1,1] y∈[-0.42,0.42]
 *   ballOwnedTeam: -1 | 0 | 1
 *   home: [{ x, y, tiredFactor, role, active, yellow }×11]
 *   away: [{ x, y, tiredFactor, role, active, yellow }×11]
 *   gameMode: int
 *   score: [int, int]
 *   stepsLeft: int
 * }
 */

// GRF game modes
export const GameMode = {
  0: 'normal',
  1: 'kick_off',
  2: 'goal_kick',
  3: 'free_kick',
  4: 'corner',
  5: 'throw_in',
  6: 'penalty',
};

/**
 * Parse the GRF observation into render-ready data.
 * Handles both 'raw' (dict) and 'simple115v2' (flat array) representations.
 *
 * @param {Array|Object} obs  Raw obs from the server
 * @param {string} repr       'raw' | 'simple115v2'
 * @returns {object}
 */
export function parseGRFObs(obs, repr = 'raw') {
  if (!obs) return null;

  if (repr === 'raw' && typeof obs === 'object' && !Array.isArray(obs)) {
    return parseRaw(obs);
  }

  // Flat array — either simple115v2 or our stub
  const arr = Array.isArray(obs) ? obs : Object.values(obs);
  if (repr === 'simple115v2') return parseSimple115(arr);

  // Fallback stub parse
  return parseStub(arr);
}

// ─── Raw dict representation ──────────────────────────────────────────────────
function parseRaw(obs) {
  const lt = obs.left_team  || [];
  const rt = obs.right_team || [];
  const ltd = obs.left_team_tired_factor  || [];
  const rtd = obs.right_team_tired_factor || [];
  const lta = obs.left_team_active        || [];
  const rta = obs.right_team_active       || [];
  const lty = obs.left_team_yellow_card   || [];
  const rty = obs.right_team_yellow_card  || [];
  const ltr = obs.left_team_roles         || [];
  const rtr = obs.right_team_roles        || [];

  return {
    ball: {
      x: obs.ball?.[0] ?? 0,
      y: obs.ball?.[1] ?? 0,
      z: obs.ball?.[2] ?? 0,
    },
    ballDirection: {
      x: obs.ball_direction?.[0] ?? 0,
      y: obs.ball_direction?.[1] ?? 0,
    },
    ballOwnedTeam:   obs.ball_owned_team   ?? -1,
    ballOwnedPlayer: obs.ball_owned_player ?? 0,
    home: lt.map((pos, i) => ({
      x:          pos[0] ?? 0,
      y:          pos[1] ?? 0,
      tiredFactor: ltd[i]  ?? 0,
      role:        ltr[i]  ?? 7,
      active:      lta[i]  ?? true,
      yellow:      lty[i]  ?? false,
    })),
    away: rt.map((pos, i) => ({
      x:          pos[0] ?? 0,
      y:          pos[1] ?? 0,
      tiredFactor: rtd[i]  ?? 0,
      role:        rtr[i]  ?? 7,
      active:      rta[i]  ?? true,
      yellow:      rty[i]  ?? false,
    })),
    gameMode:  obs.game_mode  ?? 0,
    score:     obs.score      ?? [0, 0],
    stepsLeft: obs.steps_left ?? 3000,
    steps:     obs.steps      ?? 0,
  };
}

// ─── simple115v2 flat array layout ───────────────────────────────────────────
// Based on GRF source: gfootball/env/observation_processor.py
// Indices (0-indexed):
//  0     ball_x
//  1     ball_y
//  2     ball_z
//  3     ball_owned_team  (0=left, 1=right, float; -1 encoded as 0/0 in one-hot)
//  4–14  left_team_x      (11 values)
// 15–25  left_team_y
// 26–36  right_team_x
// 37–47  right_team_y
// 48–58  left_team_tired_factor
// 59–69  right_team_tired_factor
// 70–80  left_team_active (bool)
// 81–91  right_team_active
// 92–94  ball_direction xyz
// 95–105 left_team_direction_x (11)
// 106–116 left_team_direction_y (but vector is 115 so some overlap)
// Remaining: game_mode one-hot, score, steps_left

function parseSimple115(arr) {
  const get = (i) => arr[i] ?? 0;

  const home = [];
  const away = [];
  for (let i = 0; i < 11; i++) {
    home.push({
      x:           get(4  + i),
      y:           get(15 + i),
      tiredFactor: get(48 + i),
      active:      get(70 + i) > 0.5,
      role:        7,   // not encoded in simple115v2
      yellow:      false,
    });
    away.push({
      x:           get(26 + i),
      y:           get(37 + i),
      tiredFactor: get(59 + i),
      active:      get(81 + i) > 0.5,
      role:        7,
      yellow:      false,
    });
  }

  // Game mode one-hot at positions 96–102 (approx)
  let gameMode = 0;
  for (let m = 0; m < 7; m++) {
    if (get(96 + m) > 0.5) { gameMode = m; break; }
  }

  return {
    ball: { x: get(0), y: get(1), z: get(2) },
    ballDirection: { x: get(92), y: get(93) },
    ballOwnedTeam: get(3) > 0.5 ? 1 : (get(3) < -0.5 ? -1 : 0),
    ballOwnedPlayer: 0,
    home,
    away,
    gameMode,
    score: [0, 0],   // not directly encoded; track from server state
    stepsLeft: Math.round(get(113) * 3000),
    steps: 0,
  };
}

// ─── Stub fallback ────────────────────────────────────────────────────────────
function parseStub(arr) {
  // Stub env sends a random array; generate placeholder positions
  const placeholderTeam = (side) =>
    Array.from({ length: 11 }, (_, i) => ({
      x: side === 0 ? -0.5 + i * 0.05 : 0.5 - i * 0.05,
      y: (i - 5) * 0.07,
      tiredFactor: arr[i] > 0 ? arr[i] * 0.1 : 0,
      role: i === 0 ? 0 : 7,
      active: true,
      yellow: false,
    }));

  return {
    ball: { x: (arr[1] ?? 0) * 0.3, y: (arr[2] ?? 0) * 0.1, z: 0 },
    ballDirection: { x: 0, y: 0 },
    ballOwnedTeam: -1,
    ballOwnedPlayer: 0,
    home: placeholderTeam(0),
    away: placeholderTeam(1),
    gameMode: 0,
    score: [0, 0],
    stepsLeft: 3000,
    steps: 0,
  };
}

// ─── Zone helper ──────────────────────────────────────────────────────────────
/**
 * Convert a GRF [x, y] position to a Flicker Club zone string.
 * Zones are always from the home team's perspective.
 *
 * @param {number} x       GRF x ∈ [-1, 1]
 * @param {number} y       GRF y ∈ [-0.42, 0.42]
 * @param {number} side    0 = home, 1 = away (flips x)
 * @returns {string}       e.g. 'BOX_C'
 */
export function posToZone(x, y, side = 0) {
  const nx = side === 0 ? x : -x;

  let col;
  if      (nx < -0.33) col = 'L';
  else if (nx <  0.33) col = 'C';
  else                 col = 'R';

  let row;
  if      (nx >  0.72) row = 'BOX';
  else if (nx >  0.00) row = 'ATT';
  else if (nx > -0.40) row = 'MID';
  else                 row = 'DEF';

  return `${row}_${col}`;
}

/**
 * Convert a GRF pitch coordinate to canvas pixel position.
 * @param {number} x      GRF x ∈ [-1, 1]
 * @param {number} y      GRF y ∈ [-0.42, 0.42]
 * @param {number} W      canvas width in px
 * @param {number} H      canvas height in px
 */
export function grfToCanvas(x, y, W, H) {
  return {
    px: ((x + 1) / 2) * W,
    py: ((y + 0.42) / 0.84) * H,
  };
}
