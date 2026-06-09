// Flicker Club Match Night — Match Engine
// Pure JS, no DOM. Deterministic given a seed.
// Tick-based football simulation with zone model, event resolution, fatigue, momentum, shouts, and user actions.

// =========================================================================
// CONSTANTS
// =========================================================================

const ZONES = ['DEF_L','DEF_C','DEF_R','MID_L','MID_C','MID_R','ATT_L','ATT_C','ATT_R','BOX_L','BOX_C','BOX_R'];

const ZONE_ROW = { DEF_L:0, DEF_C:0, DEF_R:0, MID_L:1, MID_C:1, MID_R:1, ATT_L:2, ATT_C:2, ATT_R:2, BOX_L:3, BOX_C:3, BOX_R:3 };

const ZONE_COL = { DEF_L:0, DEF_C:1, DEF_R:2, MID_L:0, MID_C:1, MID_R:2, ATT_L:0, ATT_C:1, ATT_R:2, BOX_L:0, BOX_C:1, BOX_R:2 };

// Event definitions: { primary, secondary, thresholdRange, zoneWeights }
const EVENTS = {
  short_pass:   { primary:'passing',   secondary:'vision',     threshold:[35,50] },
  long_pass:    { primary:'passing',   secondary:'technique',  threshold:[45,60] },
  through_ball: { primary:'vision',    secondary:'passing',    threshold:[55,70] },
  dribble:      { primary:'dribbling', secondary:'pace',       threshold:[50,65] },
  cross:        { primary:'crossing',  secondary:'technique',  threshold:[45,55] },
  shot:         { primary:'shooting',  secondary:'technique',  threshold:[45,75] },
  header:       { primary:'heading',   secondary:'strength',   threshold:[50,65] },
  tackle:       { primary:'tackling',  secondary:'strength',   threshold:[40,60] },
  interception: { primary:'positioning',secondary:'vision',    threshold:[40,55] },
  block:        { primary:'positioning',secondary:'bravery',   threshold:[50,65] },
  save:         { primary:'handling',  secondary:'reflexes',   threshold:[40,70] },
  foul:         { primary:'aggression',secondary:'tackling',   threshold:[30,50] },
  free_kick:    { primary:'set_pieces',secondary:'shooting',   threshold:[45,65] },
  corner:       { primary:'set_pieces',secondary:'crossing',   threshold:[40,60] },
  penalty:      { primary:'shooting',  secondary:'composure',  threshold:[30,50] },
};

// Zone-to-event probability weights per tactical preset
const TACTIC_EVENT_WEIGHTS = {
  balanced: {
    DEF_L:  { short_pass:60, long_pass:20, dribble:5, tackle:10, foul:5 },
    DEF_C:  { short_pass:50, long_pass:25, dribble:5, tackle:15, foul:5 },
    DEF_R:  { short_pass:60, long_pass:20, dribble:5, tackle:10, foul:5 },
    MID_L:  { short_pass:40, long_pass:15, dribble:15, cross:10, tackle:10, through_ball:5, foul:5 },
    MID_C:  { short_pass:35, long_pass:15, dribble:15, through_ball:15, tackle:10, shot:5, foul:5 },
    MID_R:  { short_pass:40, long_pass:15, dribble:15, cross:10, tackle:10, through_ball:5, foul:5 },
    ATT_L:  { short_pass:20, dribble:20, cross:25, shot:15, through_ball:10, long_pass:5, foul:5 },
    ATT_C:  { short_pass:15, dribble:20, shot:25, through_ball:20, header:10, long_pass:5, foul:5 },
    ATT_R:  { short_pass:20, dribble:20, cross:25, shot:15, through_ball:10, long_pass:5, foul:5 },
    BOX_L:  { shot:30, header:25, cross:15, short_pass:10, dribble:10, foul:5, through_ball:5 },
    BOX_C:  { shot:35, header:30, short_pass:10, dribble:10, through_ball:5, foul:5, cross:5 },
    BOX_R:  { shot:30, header:25, cross:15, short_pass:10, dribble:10, foul:5, through_ball:5 },
  },
};

// Shout effects
const SHOUTS = {
  push_up:        { label:'Push Up!', ap:1, duration:10, zoneShift:1, attackFreq:1.2, defensePos:0.85 },
  hold_firm:      { label:'Hold Firm!', ap:1, duration:10, zoneShift:-1, defenseSuccess:1.2, attackFreq:0.85 },
  wide_play:      { label:'Wide Play!', ap:1, duration:10, wideBias:1.3, centralBias:0.7 },
  through_middle: { label:'Through the Middle!', ap:1, duration:10, centralBias:1.25, wideBias:0.75 },
  slow_down:      { label:'Slow it Down', ap:1, duration:10, tickInterval:1.5, passAccuracy:1.1, oppIntercept:0.9 },
  press_hard:     { label:'Press Hard!', ap:1, duration:10, tackleFreq:1.25, foulProb:1.15, staminaDrain:1.5 },
};

const USER_ACTIONS = {
  demand_shot:    { ap:2, label:'Demand Shot', condition:'possession && (zone in ATT or BOX)' },
  killer_ball:    { ap:2, label:'Killer Ball', condition:'possession' },
  hard_tackle:    { ap:2, label:'Hard Tackle', condition:'!possession', tackleBonus:15, foulBonus:1.3 },
  substitution:   { ap:1, label:'Substitution', condition:'subsUsed < 3' },
  formation_change:{ ap:1, label:'Formation Change', condition:'true' },
  man_mark:       { ap:2, label:'Man Mark', condition:'true' },
  time_wasting:   { ap:1, label:'Time Wasting', condition:'minute >= 75 && winning' },
  all_out_attack: { ap:3, label:'All Out Attack', condition:'true', duration:15, zoneShift:1, shotFreq:1.4, defensePos:0.6 },
  park_the_bus:   { ap:3, label:'Park the Bus', condition:'true', duration:15, oppShotAcc:0.8, interceptBlock:1.3, attackFreq:0.1 },
};

const HALF_TIME_TALKS = {
  encourage:    { composure:3 },
  demand_more:  { aggression:3, shooting:3, foulRisk:1.05 },
  calm_down:    { aggression:-5, passing:3, positioning:3 },
  no_changes:   {},
};

const COMMENTARY_TEMPLATES = {
  short_pass:   ['{name} plays a short pass to {target}.','Neat ball from {name}.','{name} keeps it simple.','Short pass from {name}.'],
  long_pass:    ['{name} switches play with a long ball.','Long pass from {name} finds {target}.','{name} launches it forward.'],
  through_ball: ['{name} tries to slip {target} through!','Through ball from {name}!','{name} threads a pass through the defence.'],
  dribble:      ['{name} drives forward.','{name} takes on {opponent}... beats him!','{name} dribbles into space.'],
  cross:        ['{name} swings a cross in.','Cross from {name} into the box!','{name} delivers from the flank.'],
  shot:         ['{name} shoots!','Shot from {name}!','{name} lets fly from distance!'],
  header:       ['{name} gets his head to it.','Header from {name}!'],
  tackle:       ['{name} wins the ball with a strong tackle.','{name} slides in and wins it.','Tackle by {name}!'],
  interception: ['{name} reads the pass and intercepts.','{name} cuts out the ball.','Intercepted by {name}!'],
  block:        ['{name} throws himself in front of it!','Blocked by {name}!','{name} makes a crucial block.'],
  save:         ['SAVE! {name} denies the shot.','{name} makes a fine save!','Great stop by {name}!'],
  foul:         ['Foul! {name} penalised.','{name} concedes a free kick.','Referee blows for a foul by {name}.'],
  goal:         ['GOAL! {name} scores! {score}','{name} finds the net! {score}','GOOOOOAL! {name}! {score}'],
  free_kick:    ['{name} lines up the free kick...','Free kick taken by {name}.'],
  corner:       ['{name} takes the corner...','Corner kick by {name}.'],
  penalty:      ['PENALTY! {name} steps up...','{name} places the ball on the spot.'],
  goal_kick:    ['Goal kick taken by {name}.'],
  throw_in:     ['{name} takes the throw-in.'],
  yellow_card:  ['Yellow card for {name}!','{name} goes into the book.'],
  red_card:     ['RED CARD! {name} is sent off!'],
  injury:       ['{name} is down injured.','{name} receiving treatment.'],
  kickoff:      ['The match kicks off!','Second half underway!'],
  half_time:    ['Half time! {score}'],
  full_time:    ['Full time! {score}'],
};

// =========================================================================
// UTILITY
// =========================================================================

function pickWeighted(weights, rand) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [,v]) => s + v, 0);
  let r = rand() * total;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[entries.length-1][0];
}

function pickRandom(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function seededRand(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}

// =========================================================================
// FORMATION HELPERS
// =========================================================================

const FORMATION_POSITIONS = {
  '4-4-2':  ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'],
  '4-3-3':  ['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'],
  '4-5-1':  ['GK','LB','CB','CB','RB','LM','CM','CM','CM','RM','ST'],
  '3-5-2':  ['GK','CB','CB','CB','LM','CM','CM','CM','RM','ST','ST'],
  '4-2-3-1':['GK','LB','CB','CB','RB','CDM','CDM','CAM','LM','RM','ST'],
  '5-3-2':  ['GK','LWB','CB','CB','CB','RWB','CM','CM','CM','ST','ST'],
  '3-4-3':  ['GK','CB','CB','CB','LM','CM','CM','RM','LW','ST','RW'],
  '4-1-2-1-2':['GK','LB','CB','CB','RB','CDM','CM','CM','CAM','ST','ST'],
};

// Position → default zone mapping (row 0=DEF, 1=MID, 2=ATT, 3=BOX)
const POSITION_ZONE = {
  GK:'DEF_C', LB:'DEF_L', CB:'DEF_C', RB:'DEF_R', LWB:'DEF_L', RWB:'DEF_R',
  CDM:'MID_C', CM:'MID_C', CAM:'MID_C', LM:'MID_L', RM:'MID_R',
  LW:'ATT_L', RW:'ATT_R', ST:'ATT_C',
};

function getFormationPositions(formationKey) {
  return FORMATION_POSITIONS[formationKey] || FORMATION_POSITIONS['4-4-2'];
}

function getPlayerZone(specificPosition, zoneShift) {
  const base = POSITION_ZONE[specificPosition] || 'MID_C';
  const row = clamp(ZONE_ROW[base] + (zoneShift || 0), 0, 3);
  const col = ZONE_COL[base];
  return ZONES[row * 3 + col];
}

// =========================================================================
// EVENT RESOLUTION
// =========================================================================

function resolveEvent(eventType, actor, opponent, rand, modifiers = {}) {
  const def = EVENTS[eventType];
  if (!def) return { outcome:'fail', score:0, threshold:50 };

  const primary = actor[def.primary] || 50;
  const secondary = actor[def.secondary] || 50;
  const randomFactor = rand() * 100;

  let score = (primary * 0.55) + (secondary * 0.25) + (randomFactor * 0.20);

  // Apply modifiers (shouts, tactics, fatigue)
  if (modifiers.primaryBonus) score += modifiers.primaryBonus;
  if (modifiers.secondaryBonus) score += modifiers.secondaryBonus * 0.25;
  if (modifiers.penalty) score -= modifiers.penalty;

  // Fatigue penalty
  if (actor.fatigue > 20) score -= (actor.fatigue - 20) * 0.15;

  // Momentum bonus
  if (modifiers.momentumBonus) score += modifiers.momentumBonus;

  // Threshold
  const [tMin, tMax] = def.threshold;
  let threshold = tMin + (rand() * (tMax - tMin));
  if (modifiers.thresholdBonus) threshold += modifiers.thresholdBonus;

  const success = score >= threshold;

  // For contested events (tackle vs dribble, shot vs save), opponent also rolls
  let opponentScore = 0;
  if (opponent && ['dribble','shot','header','through_ball'].includes(eventType)) {
    const oppDef = eventType === 'dribble' ? EVENTS.tackle : (eventType === 'shot' || eventType === 'header' ? EVENTS.save : EVENTS.interception);
    const oppPrimary = opponent[oppDef.primary] || 50;
    const oppSecondary = opponent[oppDef.secondary] || 50;
    opponentScore = (oppPrimary * 0.55) + (oppSecondary * 0.25) + (rand() * 20);
    if (opponent.fatigue > 20) opponentScore -= (opponent.fatigue - 20) * 0.15;
    if (modifiers.opponentBonus) opponentScore += modifiers.opponentBonus;
  }

  return {
    outcome: opponentScore > 0 ? (score > opponentScore ? 'success' : 'fail') : (success ? 'success' : 'fail'),
    score: Math.round(score),
    threshold: Math.round(threshold),
    opponentScore: Math.round(opponentScore),
  };
}

// =========================================================================
// FATIGUE
// =========================================================================

function applyFatigue(player, minutesElapsed) {
  if (!player || player.fatigue === undefined) return player;
  const stamina = player.stamina || 50;
  const baseDrain = 0.3;
  const fatigueRate = ((100 - stamina) / 100) * baseDrain;
  const newFatigue = clamp(player.fatigue + fatigueRate * (minutesElapsed / 90), 0, 100);
  return { ...player, fatigue: newFatigue };
}

function getFatiguePenalty(fatigue) {
  if (fatigue <= 20) return 0;
  if (fatigue <= 40) return 3;
  if (fatigue <= 60) return 7;
  if (fatigue <= 80) return 12;
  return 18;
}

// =========================================================================
// MOMENTUM
// =========================================================================

function applyMomentumShift(momentum, event, team) {
  const shifts = {
    goal: 30,
    shot_on_target: 10,
    three_passes: 5,
    tackle: 5,
    foul_conceded: -8,
    red_card: -25,
    substitution: 5,
    user_action: 5,
  };
  const shift = shifts[event] || 0;
  const direction = team === 'home' ? 1 : -1;
  return clamp(momentum + (shift * direction), -100, 100);
}

function getMomentumModifier(momentum) {
  if (Math.abs(momentum) >= 40) return { composure: 5, successRate: 1.1, oppComposure: -3 };
  return { composure: 0, successRate: 1.0, oppComposure: 0 };
}

// =========================================================================
// COMMENTARY GENERATION
// =========================================================================

function generateCommentary(eventType, actor, target, opponent, score, minute) {
  const templates = COMMENTARY_TEMPLATES[eventType];
  if (!templates || templates.length === 0) return `${minute}' — ${eventType}`;
  const template = templates[Math.floor(Math.random() * templates.length)];
  let text = template
    .replace(/{name}/g, actor?.player_name || 'Player')
    .replace(/{target}/g, target?.player_name || 'teammate')
    .replace(/{opponent}/g, opponent?.player_name || 'opponent')
    .replace(/{score}/g, score || '');
  return `${minute}' — ${text}`;
}

// =========================================================================
// MATCH STATE INITIALISATION
// =========================================================================

function createInitialState(homeTeam, awayTeam, homeFormation, awayFormation, homeTactic, awayTactic, matchType, seed) {
  const rand = seededRand(seed || hashString(Date.now().toString()));
  return {
    // Match metadata
    matchType: matchType || 'friendly',
    minute: 0,
    tick: 0,
    status: 'active',
    speed: 'normal',

    // Teams
    home: {
      name: homeTeam.team_name || 'Home',
      players: homeTeam.players || [],
      formation: homeFormation || '4-4-2',
      tactic: homeTactic || 'balanced',
      score: 0,
      apRemaining: matchType === 'friendly' ? 8 : 6,
      activeShout: null,
      shoutExpiresMinute: 0,
      subsUsed: 0,
      momentum: 0,
      possessionTicks: 0,
      stats: { shots:0, shotsOnTarget:0, fouls:0, corners:0, yellowCards:0, redCards:0 },
      halfTimeTalk: null,
      manMarkTarget: null,
      manMarkDefender: null,
      allOutAttack: false,
      allOutAttackExpires: 0,
      parkTheBus: false,
      parkTheBusExpires: 0,
    },
    away: {
      name: awayTeam.team_name || 'Away',
      players: awayTeam.players || [],
      formation: awayFormation || '4-4-2',
      tactic: awayTactic || 'balanced',
      score: 0,
      apRemaining: matchType === 'friendly' ? 8 : 6,
      activeShout: null,
      shoutExpiresMinute: 0,
      subsUsed: 0,
      momentum: 0,
      possessionTicks: 0,
      stats: { shots:0, shotsOnTarget:0, fouls:0, corners:0, yellowCards:0, redCards:0 },
      halfTimeTalk: null,
      manMarkTarget: null,
      manMarkDefender: null,
      allOutAttack: false,
      allOutAttackExpires: 0,
      parkTheBus: false,
      parkTheBusExpires: 0,
    },

    // Ball state
    possession: 'home',
    ballZone: 'MID_C',
    consecutivePasses: 0,

    // Event log
    events: [],
    actionLog: [],

    // Pending prompts (free actions)
    pendingPrompt: null,

    // RNG
    _rand: rand,
    _seed: seed,
  };
}

// =========================================================================
// TICK RESOLUTION
// =========================================================================

function resolveTick(state) {
  if (state.status !== 'active' && state.status !== 'half_time') return state;
  if (state.minute >= 90) {
    state.status = 'completed';
    state.events.push({ minute:state.minute, eventType:'full_time', team:'none', commentary:generateCommentary('full_time', null, null, null, `${state.home.score}-${state.away.score}`, state.minute) });
    return state;
  }

  const rand = state._rand;
  const minute = state.minute;
  const possession = state.possession;
  const attacking = possession === 'home' ? state.home : state.away;
  const defending = possession === 'home' ? state.away : state.home;
  const attackingKey = possession;
  const defendingKey = possession === 'home' ? 'away' : 'home';

  // Check shout expiry
  if (attacking.activeShout && minute >= attacking.shoutExpiresMinute) {
    attacking.activeShout = null;
    attacking.shoutExpiresMinute = 0;
  }
  if (defending.activeShout && minute >= defending.shoutExpiresMinute) {
    defending.activeShout = null;
    defending.shoutExpiresMinute = 0;
  }

  // Check all-out-attack / park-the-bus expiry
  if (attacking.allOutAttack && minute >= attacking.allOutAttackExpires) attacking.allOutAttack = false;
  if (defending.allOutAttack && minute >= defending.allOutAttackExpires) defending.allOutAttack = false;
  if (attacking.parkTheBus && minute >= attacking.parkTheBusExpires) attacking.parkTheBus = false;
  if (defending.parkTheBus && minute >= defending.parkTheBusExpires) defending.parkTheBus = false;

  // Determine ball zone
  const ballZone = state.ballZone;
  const zoneRow = ZONE_ROW[ballZone] || 1;

  // Select player on the ball (based on formation + zone)
  const formation = getFormationPositions(attacking.formation);
  let zoneShift = attacking.activeShout === 'push_up' ? 1 : (attacking.activeShout === 'hold_firm' ? -1 : 0);
  if (attacking.allOutAttack) zoneShift = zoneShift + 1;
  if (attacking.parkTheBus) zoneShift = zoneShift - 1;

  // Find a player whose zone matches the ball zone
  const candidates = attacking.players.filter((p, i) => {
    if (i >= 11) return false; // subs don't play
    const pZone = getPlayerZone(formation[i] || 'CM', zoneShift);
    return pZone === ballZone || ZONE_ROW[pZone] === zoneRow;
  });
  const ballCarrier = candidates.length > 0 ? candidates[Math.floor(rand() * candidates.length)] : attacking.players[0];

  // Select event type based on zone + tactic
  const tacticWeights = getTacticWeights(attacking.tactic, ballZone, attacking);
  const eventType = pickWeighted(tacticWeights, rand);

  // Find opponent in same zone
  const defFormation = getFormationPositions(defending.formation);
  let defZoneShift = defending.activeShout === 'push_up' ? 1 : (defending.activeShout === 'hold_firm' ? -1 : 0);
  if (defending.allOutAttack) defZoneShift = defZoneShift + 1;
  if (defending.parkTheBus) defZoneShift = defZoneShift - 1;
  const defCandidates = defending.players.filter((p, i) => {
    if (i >= 11) return false;
    const pZone = getPlayerZone(defFormation[i] || 'CM', defZoneShift);
    return pZone === ballZone || ZONE_ROW[pZone] === zoneRow;
  });
  const opponent = defCandidates.length > 0 ? defCandidates[Math.floor(rand() * defCandidates.length)] : defending.players[0];

  // Man-mark check
  let opponentBonus = 0;
  if (defending.manMarkTarget && ballCarrier && ballCarrier.player_name === defending.manMarkTarget) {
    opponentBonus = 10;
  }

  // Resolve event
  const momentumMod = getMomentumModifier(attacking.momentum);
  const fatiguePenalty = getFatiguePenalty(ballCarrier.fatigue || 0);
  const result = resolveEvent(eventType, ballCarrier, opponent, rand, {
    penalty: fatiguePenalty,
    momentumBonus: momentumMod.successRate > 1 ? 5 : 0,
    opponentBonus: opponentBonus,
  });

  // Build event record
  const event = {
    minute,
    tick: state.tick,
    eventType,
    team: attackingKey,
    actingPlayer: ballCarrier,
    opposingPlayer: opponent,
    zone: ballZone,
    outcome: result.outcome,
    score: result.score,
    threshold: result.threshold,
    opponentScore: result.opponentScore,
    commentary: '',
  };

  // Determine next zone and possession based on outcome
  let nextZone = ballZone;
  let nextPossession = possession;
  let goalScored = false;

  if (eventType === 'shot' || eventType === 'header') {
    attacking.stats.shots++;
    if (result.outcome === 'success') {
      attacking.stats.shotsOnTarget++;
      // Check if it beats the goalkeeper
      const gk = defending.players.find(p => p.specific_position === 'GK');
      const saveResult = gk ? resolveEvent('save', gk, ballCarrier, rand, { penalty: getFatiguePenalty(gk.fatigue || 0) }) : { outcome:'fail' };
      if (saveResult.outcome === 'success') {
        event.outcome = 'save';
        event.eventType = 'save';
        event.actingPlayer = gk;
        event.opposingPlayer = ballCarrier;
        event.commentary = generateCommentary('save', gk, null, ballCarrier, null, minute);
        nextZone = 'DEF_C';
        nextPossession = defendingKey;
      } else {
        // GOAL!
        attacking.score++;
        goalScored = true;
        event.outcome = 'goal';
        event.eventType = 'goal';
        event.commentary = generateCommentary('goal', ballCarrier, null, null, `${attacking.score}-${defending.score}`, minute);
        attacking.momentum = applyMomentumShift(attacking.momentum, 'goal', attackingKey);
        nextZone = 'MID_C';
        nextPossession = defendingKey; // conceding team kicks off
      }
    } else {
      // Missed shot — goal kick
      event.commentary = generateCommentary('goal_kick', defending.players.find(p => p.specific_position === 'GK'), null, null, null, minute);
      nextZone = 'DEF_C';
      nextPossession = defendingKey;
    }
  } else if (eventType === 'tackle') {
    if (result.outcome === 'success') {
      // Tackle wins the ball
      nextPossession = defendingKey;
      nextZone = ballZone;
      attacking.momentum = applyMomentumShift(attacking.momentum, 'tackle', defendingKey);
      event.commentary = generateCommentary('tackle', opponent, null, ballCarrier, null, minute);
    } else {
      // Failed tackle — possible foul
      const foulChance = (ballCarrier.aggression || 50) / 100;
      if (rand() < foulChance * 0.3) {
        event.eventType = 'foul';
        event.outcome = 'foul';
        attacking.stats.fouls++;
        event.commentary = generateCommentary('foul', opponent, null, ballCarrier, null, minute);
        // Check card
        const cardProb = (opponent.aggression || 50) * 0.3 + (100 - (opponent.tackling || 50)) * 0.2 + rand() * 30;
        if (cardProb >= 76) {
          event.outcome = 'card';
          event.eventType = 'red_card';
          event.commentary = generateCommentary('red_card', opponent, null, null, null, minute);
          defending.stats.redCards++;
          defending.momentum = applyMomentumShift(defending.momentum, 'red_card', attackingKey);
        } else if (cardProb >= 40) {
          event.outcome = 'card';
          event.eventType = 'yellow_card';
          event.commentary = generateCommentary('yellow_card', opponent, null, null, null, minute);
          defending.stats.yellowCards++;
        }
        nextZone = ballZone;
        nextPossession = attackingKey; // free kick to attacking team
      } else {
        event.commentary = generateCommentary('dribble', ballCarrier, null, opponent, null, minute);
        nextZone = advanceZone(ballZone, 'forward');
      }
    }
  } else if (eventType === 'interception') {
    if (result.outcome === 'success') {
      nextPossession = defendingKey;
      event.commentary = generateCommentary('interception', opponent, null, ballCarrier, null, minute);
    } else {
      event.commentary = generateCommentary('short_pass', ballCarrier, null, null, null, minute);
      nextZone = advanceZone(ballZone, 'forward');
    }
  } else if (eventType === 'block') {
    event.commentary = generateCommentary('block', opponent, null, ballCarrier, null, minute);
    nextZone = ballZone;
    nextPossession = defendingKey;
  } else if (['short_pass','long_pass','through_ball','cross','dribble'].includes(eventType)) {
    if (result.outcome === 'success') {
      const direction = eventType === 'long_pass' || eventType === 'through_ball' ? 'far' : 'forward';
      nextZone = advanceZone(ballZone, direction);
      attacking.consecutivePasses++;
      if (attacking.consecutivePasses >= 3) {
        attacking.momentum = applyMomentumShift(attacking.momentum, 'three_passes', attackingKey);
        attacking.consecutivePasses = 0;
      }
      event.commentary = generateCommentary(eventType, ballCarrier, null, opponent, null, minute);
    } else {
      // Failed pass — turnover
      nextPossession = defendingKey;
      nextZone = ballZone;
      attacking.consecutivePasses = 0;
      if (eventType === 'through_ball') {
        // Through ball fail = goal kick if in ATT/BOX
        if (zoneRow >= 2) {
          nextZone = 'DEF_C';
          event.commentary = generateCommentary('goal_kick', defending.players.find(p => p.specific_position === 'GK'), null, null, null, minute);
        } else {
          event.commentary = generateCommentary('interception', opponent, null, ballCarrier, null, minute);
        }
      } else {
        event.commentary = generateCommentary('interception', opponent, null, ballCarrier, null, minute);
      }
    }
  } else if (eventType === 'foul') {
    attacking.stats.fouls++;
    event.commentary = generateCommentary('foul', ballCarrier, null, opponent, null, minute);
    nextPossession = defendingKey;
    nextZone = ballZone;
  } else {
    event.commentary = generateCommentary(eventType, ballCarrier, null, opponent, null, minute);
  }

  // Apply fatigue
  attacking.players = attacking.players.map(p => applyFatigue(p, minute));
  defending.players = defending.players.map(p => applyFatigue(p, minute));

  // Update state
  state.ballZone = nextZone;
  state.possession = nextPossession;
  state.tick++;
  state.events.push(event);

  // Advance minute (15-30 seconds per tick)
  const tickMinutes = 0.25 + rand() * 0.25;
  state.minute = Math.min(90, Math.round((state.minute + tickMinutes) * 100) / 100);

  // Check half time
  if (state.minute >= 45 && state.tick > 1 && state.status === 'active') {
    state.status = 'half_time';
    state.events.push({ minute:45, eventType:'half_time', team:'none', commentary:generateCommentary('half_time', null, null, null, `${state.home.score}-${state.away.score}`, 45) });
  }

  // Check for action prompts (free actions)
  if (event.eventType === 'foul' && zoneRow >= 2) {
    state.pendingPrompt = { type:'free_kick', team:nextPossession, zone:ballZone };
  } else if (event.eventType === 'foul' && zoneRow === 3) {
    state.pendingPrompt = { type:'penalty', team:nextPossession, zone:ballZone };
  } else if (nextZone && nextZone.startsWith('DEF') && nextPossession !== possession) {
    // Goal kick
    state.pendingPrompt = { type:'goal_kick', team:nextPossession, zone:nextZone };
  } else {
    state.pendingPrompt = null;
  }

  return state;
}

function advanceZone(zone, direction) {
  const row = ZONE_ROW[zone] || 1;
  const col = ZONE_COL[zone] || 1;
  let newRow = row;
  if (direction === 'forward') newRow = Math.min(3, row + 1);
  else if (direction === 'backward') newRow = Math.max(0, row - 1);
  else if (direction === 'far') newRow = Math.min(3, row + 2);
  // Randomise col slightly
  const newCol = col + (Math.random() > 0.5 ? 1 : -1);
  const clampedCol = clamp(newCol, 0, 2);
  return ZONES[newRow * 3 + clampedCol];
}

function getTacticWeights(tactic, zone, team) {
  const base = JSON.parse(JSON.stringify(TACTIC_EVENT_WEIGHTS.balanced[zone] || TACTIC_EVENT_WEIGHTS.balanced.MID_C));
  if (tactic === 'attacking') {
    for (const k of Object.keys(base)) {
      if (k === 'shot') base[k] = (base[k] || 0) * 1.15;
      if (['tackle','interception','block'].includes(k)) base[k] = (base[k] || 0) * 0.9;
    }
  } else if (tactic === 'defensive') {
    for (const k of Object.keys(base)) {
      if (['tackle','interception','block'].includes(k)) base[k] = (base[k] || 0) * 1.15;
      if (k === 'shot') base[k] = (base[k] || 0) * 0.9;
    }
  } else if (tactic === 'possession') {
    if (base.short_pass) base.short_pass *= 1.2;
    if (base.long_pass) base.long_pass *= 0.85;
    if (base.through_ball) base.through_ball *= 0.85;
  } else if (tactic === 'direct') {
    if (base.long_pass) base.long_pass *= 1.2;
    if (base.through_ball) base.through_ball *= 1.2;
    if (base.short_pass) base.short_pass *= 0.9;
  } else if (tactic === 'counter') {
    // Counter: low possession, when winning ball immediate long pass
    // Simulated by higher long_pass/through_ball weights
    if (base.long_pass) base.long_pass *= 1.2;
    if (base.through_ball) base.through_ball *= 1.2;
  }

  // Apply shout modifiers
  if (team.activeShout === 'wide_play') {
    for (const k of Object.keys(base)) {
      if (['cross','short_pass'].includes(k) && (zone.endsWith('_L') || zone.endsWith('_R'))) base[k] = (base[k] || 0) * 1.3;
      if (['through_ball','shot'].includes(k) && zone.endsWith('_C')) base[k] = (base[k] || 0) * 0.7;
    }
  }
  if (team.activeShout === 'through_middle') {
    for (const k of Object.keys(base)) {
      if (['through_ball','short_pass','shot'].includes(k) && zone.endsWith('_C')) base[k] = (base[k] || 0) * 1.25;
      if (['cross'].includes(k) && (zone.endsWith('_L') || zone.endsWith('_R'))) base[k] = (base[k] || 0) * 0.75;
    }
  }
  if (team.activeShout === 'press_hard') {
    if (base.tackle) base.tackle *= 1.25;
    if (base.foul) base.foul *= 1.15;
  }

  // All-out-attack / park-the-bus
  if (team.allOutAttack) {
    for (const k of Object.keys(base)) {
      if (['shot','through_ball','dribble'].includes(k)) base[k] = (base[k] || 0) * 1.4;
      if (['tackle','interception','block'].includes(k)) base[k] = (base[k] || 0) * 0.6;
    }
  }
  if (team.parkTheBus) {
    for (const k of Object.keys(base)) {
      if (['tackle','interception','block'].includes(k)) base[k] = (base[k] || 0) * 1.3;
      if (['shot','through_ball','cross','dribble'].includes(k)) base[k] = (base[k] || 0) * 0.1;
    }
  }

  return base;
}

// =========================================================================
// USER ACTIONS
// =========================================================================

function applyUserAction(state, teamKey, actionType, detail = {}) {
  const team = state[teamKey];
  const action = USER_ACTIONS[actionType];
  if (!action) return { success:false, error:'Unknown action' };
  if (team.apRemaining < action.ap) return { success:false, error:'Not enough AP' };

  team.apRemaining -= action.ap;
  team.momentum = applyMomentumShift(team.momentum, 'user_action', teamKey);

  switch (actionType) {
    case 'demand_shot':
      // Forces a shot on the next tick
      state._forceEvent = 'shot';
      break;
    case 'killer_ball':
      state._forceEvent = 'through_ball';
      break;
    case 'hard_tackle':
      state._forceEvent = 'tackle';
      state._tackleBonus = 15;
      break;
    case 'substitution': {
      const offIndex = detail.offIndex;
      const onIndex = detail.onIndex;
      if (offIndex === undefined || onIndex === undefined) return { success:false, error:'Need offIndex and onIndex' };
      if (team.subsUsed >= 3) return { success:false, error:'No subs remaining' };
      // Swap player
      const offPlayer = team.players[offIndex];
      const onPlayer = team.players[onIndex];
      if (!offPlayer || !onPlayer) return { success:false, error:'Invalid player indices' };
      team.players[offIndex] = { ...onPlayer, fatigue:0 };
      team.players[onIndex] = { ...offPlayer };
      team.subsUsed++;
      // Fresh legs boost: +5 to all stats for 5 minutes
      team.players[offIndex]._freshLegsBoost = 5;
      team.players[offIndex]._freshLegsExpires = state.minute + 5;
      break;
    }
    case 'formation_change':
      if (detail.formation) team.formation = detail.formation;
      break;
    case 'man_mark':
      team.manMarkTarget = detail.targetPlayerName;
      team.manMarkDefender = detail.defenderPlayerName;
      break;
    case 'time_wasting':
      // Reduces tick frequency — implemented by skipping ticks
      state._timeWasting = true;
      break;
    case 'all_out_attack':
      team.allOutAttack = true;
      team.allOutAttackExpires = state.minute + 15;
      break;
    case 'park_the_bus':
      team.parkTheBus = true;
      team.parkTheBusExpires = state.minute + 15;
      break;
  }

  state.actionLog.push({ minute:Math.floor(state.minute), team:teamKey, actionType, detail, apCost:action.ap });
  return { success:true };
}

function applyShout(state, teamKey, shoutKey) {
  const team = state[teamKey];
  const shout = SHOUTS[shoutKey];
  if (!shout) return { success:false, error:'Unknown shout' };
  if (team.apRemaining < shout.ap) return { success:false, error:'Not enough AP' };
  team.apRemaining -= shout.ap;
  team.activeShout = shoutKey;
  team.shoutExpiresMinute = state.minute + shout.duration;
  team.momentum = applyMomentumShift(team.momentum, 'user_action', teamKey);
  state.actionLog.push({ minute:Math.floor(state.minute), team:teamKey, actionType:'shout', detail:{ shout:shoutKey }, apCost:shout.ap });
  return { success:true };
}

function applyHalfTimeTalk(state, teamKey, talkKey) {
  const talk = HALF_TIME_TALKS[talkKey];
  if (!talk) return { success:false, error:'Unknown talk' };
  state[teamKey].halfTimeTalk = talkKey;
  // Apply stat modifiers to all players
  state[teamKey].players = state[teamKey].players.map(p => {
    const mods = { ...p };
    if (talk.composure) mods.composure = clamp((p.composure || 50) + talk.composure, 1, 99);
    if (talk.aggression) mods.aggression = clamp((p.aggression || 50) + talk.aggression, 1, 99);
    if (talk.shooting) mods.shooting = clamp((p.shooting || 50) + talk.shooting, 1, 99);
    if (talk.passing) mods.passing = clamp((p.passing || 50) + talk.passing, 1, 99);
    if (talk.positioning) mods.positioning = clamp((p.positioning || 50) + talk.positioning, 1, 99);
    return mods;
  });
  return { success:true };
}

function applyActionPrompt(state, teamKey, choice) {
  // Free actions: free_kick, corner, penalty, goal_kick, kickoff
  const prompt = state.pendingPrompt;
  if (!prompt) return { success:false, error:'No pending prompt' };
  state.pendingPrompt = null;
  // The choice affects the next event
  state._promptChoice = { type:prompt.type, team:teamKey, choice };
  return { success:true };
}

// =========================================================================
// AI CONTROLLER
// =========================================================================

function aiDecideAction(state, teamKey, difficulty) {
  const team = state[teamKey];
  const opponent = state[teamKey === 'home' ? 'away' : 'home'];
  const rand = state._rand;

  // Easy: random actions, often wastes AP
  if (difficulty === 'easy') {
    if (rand() < 0.1 && team.apRemaining >= 1) {
      const shouts = Object.keys(SHOUTS);
      return { type:'shout', shoutKey:shouts[Math.floor(rand() * shouts.length)] };
    }
    return null;
  }

  // Medium: uses tactical shouts appropriately, makes 1 sub
  if (difficulty === 'medium') {
    if (team.apRemaining >= 1 && !team.activeShout && rand() < 0.15) {
      if (opponent.score > team.score) return { type:'shout', shoutKey:'push_up' };
      if (team.score > opponent.score && state.minute > 70) return { type:'shout', shoutKey:'hold_firm' };
      return { type:'shout', shoutKey:['push_up','hold_firm','wide_play','through_middle'][Math.floor(rand() * 4)] };
    }
    if (team.apRemaining >= 2 && state.possession === teamKey && rand() < 0.05) {
      return { type:'action', actionType:'demand_shot' };
    }
    if (team.subsUsed < 1 && state.minute > 60 && rand() < 0.1) {
      const subCandidates = team.players.filter((p, i) => i >= 11);
      const tiredPlayers = team.players.filter((p, i) => i < 11 && (p.fatigue || 0) > 50);
      if (tiredPlayers.length > 0 && subCandidates.length > 0) {
        return { type:'action', actionType:'substitution', detail:{ offIndex:team.players.indexOf(tiredPlayers[0]), onIndex:11 + Math.floor(rand() * Math.min(3, subCandidates.length)) } };
      }
    }
    return null;
  }

  // Hard: optimal action timing, all 3 subs, man mark
  if (difficulty === 'hard') {
    if (team.apRemaining >= 1 && !team.activeShout && rand() < 0.2) {
      if (opponent.score > team.score) return { type:'shout', shoutKey:'push_up' };
      if (team.score > opponent.score && state.minute > 70) return { type:'shout', shoutKey:'hold_firm' };
      if (state.minute < 30) return { type:'shout', shoutKey:'press_hard' };
    }
    if (team.apRemaining >= 2 && state.possession === teamKey && rand() < 0.08) {
      return { type:'action', actionType:'demand_shot' };
    }
    if (team.apRemaining >= 2 && state.possession !== teamKey && rand() < 0.06) {
      return { type:'action', actionType:'hard_tackle' };
    }
    if (team.subsUsed < 3 && state.minute > 55 && rand() < 0.15) {
      const subCandidates = team.players.filter((p, i) => i >= 11);
      const tiredPlayers = team.players.filter((p, i) => i < 11 && (p.fatigue || 0) > 40);
      if (tiredPlayers.length > 0 && subCandidates.length > 0) {
        return { type:'action', actionType:'substitution', detail:{ offIndex:team.players.indexOf(tiredPlayers[0]), onIndex:11 + Math.floor(rand() * Math.min(3, subCandidates.length)) } };
      }
    }
    if (team.apRemaining >= 2 && !team.manMarkTarget && opponent.players.length > 0 && rand() < 0.05) {
      // Find opponent's best player (highest overall)
      const bestOpp = opponent.players.reduce((a, b) => ((a.overall_rating || 0) > (b.overall_rating || 0) ? a : b));
      return { type:'action', actionType:'man_mark', detail:{ targetPlayerName:bestOpp.player_name, defenderPlayerName:team.players[1]?.player_name } };
    }
    if (team.apRemaining >= 3 && opponent.score > team.score && state.minute > 75 && rand() < 0.2) {
      return { type:'action', actionType:'all_out_attack' };
    }
    if (team.apRemaining >= 3 && team.score > opponent.score && state.minute > 80 && rand() < 0.2) {
      return { type:'action', actionType:'park_the_bus' };
    }
    return null;
  }

  return null;
}

// =========================================================================
// MATCH SIMULATION (full match in one call)
// =========================================================================

function simulateFullMatch(homeTeam, awayTeam, homeFormation, awayFormation, homeTactic, awayTactic, matchType, seed) {
  let state = createInitialState(homeTeam, awayTeam, homeFormation, awayFormation, homeTactic, awayTactic, matchType, seed);
  const maxTicks = 1000; // safety limit
  let ticks = 0;

  while (state.status !== 'completed' && ticks < maxTicks) {
    // AI decisions (for AI matches)
    if (matchType === 'ai' || matchType === 'friendly') {
      const homeAI = aiDecideAction(state, 'home', 'medium');
      if (homeAI) {
        if (homeAI.type === 'shout') applyShout(state, 'home', homeAI.shoutKey);
        else if (homeAI.type === 'action') applyUserAction(state, 'home', homeAI.actionType, homeAI.detail || {});
      }
      const awayAI = aiDecideAction(state, 'away', 'medium');
      if (awayAI) {
        if (awayAI.type === 'shout') applyShout(state, 'away', awayAI.shoutKey);
        else if (awayAI.type === 'action') applyUserAction(state, 'away', awayAI.actionType, awayAI.detail || {});
      }
    }

    state = resolveTick(state);
    ticks++;

    // Handle half-time pause (in full sim, just continue)
    if (state.status === 'half_time') {
      state.status = 'active';
      state.events.push({ minute:45, eventType:'kickoff', team:'none', commentary:generateCommentary('kickoff', null, null, null, null, 45) });
    }
  }

  // Compute final stats
  const totalTicks = state.home.possessionTicks + state.away.possessionTicks || 1;
  state.home.stats.possessionPct = Math.round((state.home.possessionTicks / totalTicks) * 100);
  state.away.stats.possessionPct = 100 - state.home.stats.possessionPct;

  // Determine Man of the Match (player with highest combined event success rate)
  const allPlayers = [...state.home.players, ...state.away.players];
  const playerEvents = {};
  for (const ev of state.events) {
    if (ev.actingPlayer) {
      const pid = ev.actingPlayer.player_name;
      if (!playerEvents[pid]) playerEvents[pid] = { successes:0, total:0 };
      playerEvents[pid].total++;
      if (ev.outcome === 'success' || ev.outcome === 'goal') playerEvents[pid].successes++;
    }
  }
  let bestPlayer = null;
  let bestRate = 0;
  for (const [name, stats] of Object.entries(playerEvents)) {
    const rate = stats.total > 0 ? stats.successes / stats.total : 0;
    if (rate > bestRate) { bestRate = rate; bestPlayer = name; }
  }
  state.manOfTheMatch = bestPlayer;

  return state;
}

// =========================================================================
// EXPORTS
// =========================================================================

export {
  createInitialState,
  resolveTick,
  applyUserAction,
  applyShout,
  applyHalfTimeTalk,
  applyActionPrompt,
  aiDecideAction,
  simulateFullMatch,
  generateCommentary,
  resolveEvent,
  applyFatigue,
  getFatiguePenalty,
  applyMomentumShift,
  getMomentumModifier,
  getFormationPositions,
  getPlayerZone,
  ZONES,
  ZONE_ROW,
  ZONE_COL,
  EVENTS,
  SHOUTS,
  USER_ACTIONS,
  HALF_TIME_TALKS,
  FORMATION_POSITIONS,
  COMMENTARY_TEMPLATES,
};

export default {
  createInitialState,
  resolveTick,
  applyUserAction,
  applyShout,
  applyHalfTimeTalk,
  applyActionPrompt,
  aiDecideAction,
  simulateFullMatch,
  generateCommentary,
  resolveEvent,
  applyFatigue,
  getFatiguePenalty,
  applyMomentumShift,
  getMomentumModifier,
  getFormationPositions,
  getPlayerZone,
  ZONES,
  ZONE_ROW,
  ZONE_COL,
  EVENTS,
  SHOUTS,
  USER_ACTIONS,
  HALF_TIME_TALKS,
  FORMATION_POSITIONS,
  COMMENTARY_TEMPLATES,
};