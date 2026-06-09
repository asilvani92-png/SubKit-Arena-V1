// Supabase Edge Function: generate-squad
// Generates 11 starting players + 3 substitutes for a SubbuteoTeam in a user's collection.
// Stats are deterministic given (team_id, slot_index, formation).
// POST { collection_id, formation? }

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const OUTFIELD_TEMPLATES: any = {
  GK:    { handling: 1.20, reflexes: 1.20, kicking: 1.00, one_on_ones: 1.10, aerial_reach: 1.10, communication: 1.10, composure: 1.00, positioning: 0.95, pace: 0.60, strength: 0.85, stamina: 0.70, aggression: 0.60, bravery: 0.95 },
  CB:    { pace: 0.80, shooting: 0.40, passing: 0.70, dribbling: 0.60, tackling: 1.20, heading: 1.20, crossing: 0.50, vision: 0.65, technique: 0.75, positioning: 1.10, strength: 1.15, stamina: 0.90, aggression: 0.95, composure: 0.95, set_pieces: 0.50, bravery: 1.10 },
  LB:    { pace: 0.95, shooting: 0.40, passing: 0.80, dribbling: 0.80, tackling: 1.05, heading: 0.85, crossing: 1.00, vision: 0.70, technique: 0.80, positioning: 1.00, strength: 0.90, stamina: 1.05, aggression: 0.80, composure: 0.85, set_pieces: 0.55, bravery: 0.95 },
  RB:    { pace: 0.95, shooting: 0.40, passing: 0.80, dribbling: 0.80, tackling: 1.05, heading: 0.85, crossing: 1.00, vision: 0.70, technique: 0.80, positioning: 1.00, strength: 0.90, stamina: 1.05, aggression: 0.80, composure: 0.85, set_pieces: 0.55, bravery: 0.95 },
  LWB:   { pace: 1.00, shooting: 0.50, passing: 0.85, dribbling: 0.85, tackling: 0.95, heading: 0.75, crossing: 1.10, vision: 0.75, technique: 0.85, positioning: 0.90, strength: 0.85, stamina: 1.10, aggression: 0.75, composure: 0.85, set_pieces: 0.50, bravery: 0.90 },
  RWB:   { pace: 1.00, shooting: 0.50, passing: 0.85, dribbling: 0.85, tackling: 0.95, heading: 0.75, crossing: 1.10, vision: 0.75, technique: 0.85, positioning: 0.90, strength: 0.85, stamina: 1.10, aggression: 0.75, composure: 0.85, set_pieces: 0.50, bravery: 0.90 },
  CDM:   { pace: 0.80, shooting: 0.55, passing: 0.85, dribbling: 0.75, tackling: 1.10, heading: 0.95, crossing: 0.60, vision: 0.85, technique: 0.85, positioning: 1.05, strength: 1.00, stamina: 1.00, aggression: 0.90, composure: 0.95, set_pieces: 0.55, bravery: 1.00 },
  CM:    { pace: 0.85, shooting: 0.70, passing: 0.95, dribbling: 0.90, tackling: 0.90, heading: 0.80, crossing: 0.75, vision: 0.95, technique: 0.95, positioning: 0.90, strength: 0.85, stamina: 1.05, aggression: 0.80, composure: 0.90, set_pieces: 0.70, bravery: 0.85 },
  CAM:   { pace: 0.90, shooting: 0.85, passing: 1.00, dribbling: 1.00, tackling: 0.65, heading: 0.70, crossing: 0.80, vision: 1.10, technique: 1.05, positioning: 0.80, strength: 0.75, stamina: 0.90, aggression: 0.65, composure: 0.95, set_pieces: 0.85, bravery: 0.70 },
  LM:    { pace: 1.00, shooting: 0.70, passing: 0.90, dribbling: 0.95, tackling: 0.75, heading: 0.65, crossing: 1.00, vision: 0.85, technique: 0.95, positioning: 0.75, strength: 0.75, stamina: 1.00, aggression: 0.70, composure: 0.85, set_pieces: 0.65, bravery: 0.75 },
  RM:    { pace: 1.00, shooting: 0.70, passing: 0.90, dribbling: 0.95, tackling: 0.75, heading: 0.65, crossing: 1.00, vision: 0.85, technique: 0.95, positioning: 0.75, strength: 0.75, stamina: 1.00, aggression: 0.70, composure: 0.85, set_pieces: 0.65, bravery: 0.75 },
  LW:    { pace: 1.05, shooting: 0.85, passing: 0.85, dribbling: 1.10, tackling: 0.55, heading: 0.55, crossing: 0.90, vision: 0.90, technique: 1.05, positioning: 0.70, strength: 0.70, stamina: 0.90, aggression: 0.60, composure: 0.85, set_pieces: 0.75, bravery: 0.65 },
  RW:    { pace: 1.05, shooting: 0.85, passing: 0.85, dribbling: 1.10, tackling: 0.55, heading: 0.55, crossing: 0.90, vision: 0.90, technique: 1.05, positioning: 0.70, strength: 0.70, stamina: 0.90, aggression: 0.60, composure: 0.85, set_pieces: 0.75, bravery: 0.65 },
  ST:    { pace: 1.05, shooting: 1.15, passing: 0.80, dribbling: 1.00, tackling: 0.40, heading: 0.90, crossing: 0.50, vision: 0.80, technique: 1.00, positioning: 0.50, strength: 0.85, stamina: 0.85, aggression: 0.70, composure: 0.95, set_pieces: 0.50, bravery: 0.55 },
};

const FORMATIONS: any = { '4-4-2': ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'], '4-3-3': ['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'], '4-5-1': ['GK','LB','CB','CB','RB','LM','CM','CM','CM','RM','ST'], '3-5-2': ['GK','CB','CB','CB','LM','CM','CM','CM','RM','ST','ST'], '4-2-3-1':['GK','LB','CB','CB','RB','CDM','CDM','CAM','LM','RM','ST'], '5-3-2': ['GK','LWB','CB','CB','CB','RWB','CM','CM','CM','ST','ST'], '3-4-3': ['GK','CB','CB','CB','LM','CM','CM','RM','LW','ST','RW'], '4-1-2-1-2':['GK','LB','CB','CB','RB','CDM','CM','CM','CAM','ST','ST'] };

const ERA_MODIFIERS: any = { '1966-1975': { technique: 3, composure: 3 }, '1976-1985': { strength: 2, aggression: 2 }, '1986-1995': { pace: 2, stamina: 2 }, '1996-2005': { passing: 2, vision: 2 } };

const FIRST_NAMES = ['Marco','Luca','Gianni','Andrea','Paolo','Roberto','Stefano','Antonio','Giuseppe','Bruno','Sergio','Franco','Alessandro','Giovanni','Massimo','Davide','Salvatore','Vincenzo','Tommaso','Raffaele','Maurizio','Claudio','Enrico','Daniele','Federico','Matteo','Lorenzo','Riccardo','Simone','Fabio','Nicola','Pietro','Carlo','Giorgio','Mario','Dino','Renzo','Ezio','Romolo','Felice','Adriano','Aldo','Giancarlo','Oscar'];
const LAST_NAMES = ['Rossi','Bianchi','Romano','Ferrari','Esposito','Russo','Bruno','Greco','Carrara','Conti','De Luca','Costa','Mancini','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Marino','Galli','Rinaldi','Moro','Colombo','Ricci','Benedetti','Vitale','De Rosa','Coppola','Ferri','Riva','Lupi','Boni','Pia','Sala','Motta','Parisi'];

function mulberry32(seed: number) { let a = seed >>> 0; return function() { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function hashStringToSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }

function clampStat(v: number): number { return Math.max(1, Math.min(99, Math.round(v))); }

function computeOverall(stats: any, position: string): number {
  const weights: any = position === 'GK' ? { handling: 0.25, reflexes: 0.25, one_on_ones: 0.20, positioning: 0.10, kicking: 0.05, aerial_reach: 0.05, composure: 0.05, communication: 0.05 } : { pace: 0.10, shooting: 0.12, passing: 0.12, dribbling: 0.10, tackling: 0.10, heading: 0.08, crossing: 0.06, vision: 0.08, technique: 0.06, positioning: 0.06, strength: 0.06, stamina: 0.06 };
  let total = 0; for (const [k, w] of Object.entries(weights)) total += (stats[k] || 50) * (w as number); return Math.round(total);
}

function buildPlayer(slot: string, slotIndex: number, base: number, eraMod: any, rarityBonus: number, bonus: number, rand: () => number, isSub: boolean): any {
  const isGK = slot === 'GK';
  const template = OUTFIELD_TEMPLATES[slot] || OUTFIELD_TEMPLATES.CM;
  const stats: any = {};
  if (isGK) {
    stats.handling = clampStat(base * template.handling + (rand() * 10 - 5) + rarityBonus + bonus);
    stats.reflexes = clampStat(base * template.reflexes + (rand() * 10 - 5) + rarityBonus + bonus);
    stats.kicking = clampStat(base * template.kicking + (rand() * 10 - 5) + rarityBonus + bonus);
    stats.one_on_ones = clampStat(base * template.one_on_ones + (rand() * 10 - 5) + rarityBonus + bonus);
    stats.aerial_reach = clampStat(base * template.aerial_reach + (rand() * 10 - 5) + rarityBonus + bonus);
    stats.communication = clampStat(base * template.communication + (rand() * 10 - 5) + rarityBonus + bonus);
    stats.composure = clampStat(base * template.composure + (eraMod.composure || 0) + (rand() * 10 - 5) + rarityBonus + bonus);
    stats.positioning = clampStat(base * template.positioning + (rand() * 10 - 5) + rarityBonus + bonus);
  } else {
    const keys = ['pace','shooting','passing','dribbling','tackling','heading','crossing','vision','technique','positioning','strength','stamina','aggression','composure','set_pieces','bravery'];
    for (const k of keys) stats[k] = clampStat(base * (template[k] || 0.7) + (eraMod[k] || 0) + (rand() * 10 - 5) + rarityBonus + bonus);
  }
  stats.fatigue = 0;
  const firstName = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
  const squadNumber = isSub ? (12 + slotIndex) : (slotIndex === 0 ? 1 : Math.floor(rand() * 20) + 2);
  const overall = computeOverall(stats, isGK ? 'GK' : 'OUT');
  let positionCategory = 'Midfielder';
  if (isGK) positionCategory = 'Goalkeeper';
  else if (['ST','LW','RW'].includes(slot)) positionCategory = 'Forward';
  else if (['CB','LB','RB','LWB','RWB'].includes(slot)) positionCategory = 'Defender';
  return { slot_index: slotIndex, is_substitute: isSub, player_name: `${firstName} ${lastName}`, squad_number: squadNumber, position: positionCategory, specific_position: slot, ...stats, overall_rating: overall };
}

function generateSquad(team: any, formationKey: string, bonus: number): any[] {
  const formation = FORMATIONS[formationKey] || FORMATIONS['4-4-2'];
  const seed = hashStringToSeed(`${team.id}::${formationKey}`);
  const rand = mulberry32(seed);
  const eraMod = ERA_MODIFIERS[team.era] || {};
  const base = team.base_rating ?? 60;
  const players: any[] = [];
  for (let i = 0; i < 11; i++) players.push(buildPlayer(formation[i], i, base, eraMod, 0, bonus, rand, false));
  const subSlots = ['CM','CB','ST'];
  for (let i = 0; i < 3; i++) players.push(buildPlayer(subSlots[i], 11 + i, base, eraMod, 0, bonus, rand, true));
  return players;
}

async function supabaseFetch(path: string, init: any = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: init.prefer || 'return=representation', ...(init.headers || {}) } });
  if (!res.ok) { const text = await res.text(); throw new Error(`supabase ${path} ${res.status}: ${text}`); }
  return res.json();
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('POST required', { status: 405, headers: cors });
  try {
    const body = await req.json();
    const { collection_id, formation } = body;
    if (!collection_id) return new Response('collection_id required', { status: 400, headers: cors });
    const cols: any[] = await supabaseFetch(`collections?id=eq.${collection_id}&select=*`);
    const collection = cols && cols[0];
    if (!collection) return new Response('collection not found', { status: 404, headers: cors });
    const teams: any[] = await supabaseFetch(`teams?id=eq.${collection.team_id}&select=*`);
    const team = teams && teams[0];
    if (!team) return new Response('team not found', { status: 404, headers: cors });
    const photoBonus = collection.is_verified ? 3 : 0;
    const formationKey = formation || '4-4-2';
    const players = generateSquad(team, formationKey, photoBonus);
    await supabaseFetch(`team_players?collection_id=eq.${collection_id}`, { method: 'DELETE', prefer: 'return=minimal' });
    const rows = players.map((p) => ({ ...p, collection_id, team_id: team.id }));
    const inserted = await supabaseFetch('team_players', { method: 'POST', body: JSON.stringify(rows) });
    return new Response(JSON.stringify({ players: inserted, formation: formationKey, team }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};