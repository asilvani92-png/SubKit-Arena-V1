import supabase from './supabaseClient';

const TICK_MS = 500;
const POLL_MS = 3000;
const SYNC_DEBOUNCE_MS = 200;

export class RealtimeMatchManager {
  constructor(matchId, userId, onState, onEvent, onOpponentLeft) {
    this.matchId = matchId;
    this.userId = userId;
    this.onState = onState;
    this.onEvent = onEvent;
    this.onOpponentLeft = onOpponentLeft;

    this.localState = null;
    this.localEvents = [];
    this.channel = null;
    this.pollTimer = null;
    this.stateTimer = null;
    this.lastEventCount = 0;
    this.lastHash = '';
    this.syncing = false;
  }

  start(initialState) {
    this.localState = { ...initialState };
    this.onState(this.localState);
    this.subscribeRealtime();
    this.startPolling();
  }

  subscribeRealtime() {
    this.channel = supabase.channel(`match:${this.matchId}`)
      .on('broadcast', { event: 'user_action' }, ({ payload }) => {
        this.handleRemoteAction(payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${this.matchId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE' || !payload.new) {
          this.cleanup();
          this.onOpponentLeft?.();
          return;
        }
        this.syncFromDb(payload.new);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_events',
        filter: `match_id=eq.${this.matchId}`,
      }, ({ new: ev }) => {
        this.localEvents.push(ev);
        this.onEvent(ev);
      })
      .subscribe();
  }

  startPolling() {
    this.pollTimer = setInterval(() => this.syncFromDb(), POLL_MS);
  }

  async syncFromDb(matchRow) {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const row = matchRow || await this.fetchMatchRow();
      if (!row) return;
      const hash = this.hashState(row);
      if (hash !== this.lastHash) {
        this.lastHash = hash;
        this.localState = { ...this.localState, ...row };
        this.onState(this.localState);
      }
      const { data: evts } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', this.matchId)
        .order('minute', { ascending: true })
        .order('created_at', { ascending: true });
      if (evts && evts.length > 0 && evts.length !== this.lastEventCount) {
        this.lastEventCount = evts.length;
        this.localEvents = evts;
        this.onEvent(null, evts);
      }
    } catch (e) {
      console.warn('PvP sync failed', e);
    } finally {
      this.syncing = false;
    }
  }

  async applyAction(actionType, detail = {}) {
    if (!this.localState) return;
    this.localState = {
      ...this.localState,
      ...this.resolveClientSide(actionType, detail),
    };
    this.onState(this.localState);
    this.broadcast({ actionType, detail, by: this.userId, ts: Date.now() });
    this.persistToDb({ actionType, detail });
    await this.recordMatchAction(actionType, detail);
  }

  broadcast(payload) {
    this.channel?.send({ type: 'broadcast', event: 'user_action', payload });
  }

  handleRemoteAction(payload) {
    if (payload.by === this.userId) return;
    this.localState = {
      ...this.localState,
      ...this.resolveClientSide(payload.actionType, payload.detail || {}),
    };
    this.onState(this.localState);
  }

  resolveClientSide(actionType, detail) {
    if (!this.localState) return {};
    const isHome = this.userId === this.localState.home_user_id;
    const key = isHome ? 'home' : 'away';
    const oppKey = isHome ? 'away' : 'home';
    const state = { ...this.localState };
    const apKey = key === 'home' ? 'home_ap_remaining' : 'away_ap_remaining';
    const oppApKey = oppKey === 'home' ? 'home_ap_remaining' : 'away_ap_remaining';
    const momKey = key === 'home' ? 'home_momentum' : 'away_momentum';
    const subKey = key === 'home' ? 'home_subs_used' : 'away_subs_used';

    if (['shout','demand_shot','killer_ball','hard_tackle'].includes(actionType)) {
      const cost = actionType === 'shout' ? 1 : 2;
      if (state[apKey] >= cost) {
        state[apKey] -= cost;
      }
    } else if (actionType === 'substitution') {
      if (state[subKey] < 3) {
        state[subKey] += 1;
      }
    }

    state[momKey] = Math.min(100, (state[momKey] || 0) + 5);
    state.possession = key;
    state.ball_zone = this.advanceZone(state.ball_zone || 'MID_C');

    return state;
  }

  advanceZone(zone) {
    const ZONES = ['DEF_L','DEF_C','DEF_R','MID_L','MID_C','MID_R','ATT_L','ATT_C','ATT_R','BOX_L','BOX_C','BOX_R'];
    const ZONE_ROW = { DEF_L:0, DEF_C:0, DEF_R:0, MID_L:1, MID_C:1, MID_R:1, ATT_L:2, ATT_C:2, ATT_R:2, BOX_L:3, BOX_C:3, BOX_R:3 };
    const idx = ZONES.indexOf(zone);
    if (idx < 0) return 'MID_C';
    const row = ZONE_ROW[zone] || 1;
    const nextRow = Math.min(3, row + 1);
    return ZONES[Math.min(ZONES.length - 1, nextRow * 3 + 1)];
  }

  async persistToDb(partial) {
    try {
      await supabase
        .from('matches')
        .update({
          ...partial,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', this.matchId);
    } catch (e) {
      console.warn('persist failed', e);
    }
  }

  async recordMatchAction(actionType, detail) {
    try {
      await supabase.from('match_actions').insert([{
        match_id: this.matchId,
        user_id: this.userId,
        minute: this.localState?.current_minute || 0,
        action_type: actionType,
        action_detail: detail,
      }]);
    } catch (e) {
      console.warn('action log failed', e);
    }
  }

  hashState(matchRow) {
    if (!matchRow) return '';
    return [
      matchRow.status,
      matchRow.current_minute,
      matchRow.home_score,
      matchRow.away_score,
      matchRow.possession,
      matchRow.ball_zone,
      matchRow.home_ap_remaining,
      matchRow.away_ap_remaining,
      matchRow.home_momentum,
      matchRow.away_momentum,
      matchRow.home_subs_used,
      matchRow.away_subs_used,
    ].join('|');
  }

  async fetchMatchRow() {
    const { data } = await supabase.from('matches').select('*').eq('id', this.matchId).single();
    return data;
  }

  cleanup() {
    this.channel?.unsubscribe();
    clearInterval(this.pollTimer);
    this.channel = null;
    this.pollTimer = null;
  }
}

export async function createPvpMatch({ homeUserId, homeCollectionId, opponentUserId, awayCollectionId, matchType = 'ranked' }) {
  const home = await loadTeam(homeCollectionId);
  const away = await loadTeam(awayCollectionId);

  const payload = {
    home_user_id: homeUserId,
    away_user_id: opponentUserId,
    home_collection_id: homeCollectionId,
    away_collection_id: awayCollectionId,
    home_team_name: home?.team_name || 'Home',
    away_team_name: away?.team_name || 'Away',
    match_type: matchType,
    status: 'awaiting_opponent',
    is_ai_match: false,
    is_async: true,
    home_formation: '4-4-2',
    away_formation: '4-4-2',
    home_tactic: 'balanced',
    away_tactic: 'balanced',
    challenge_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  const { data, error } = await supabase.from('matches').insert([payload]).select('*').single();
  if (error) throw error;

  const { error: notifError } = await supabase
    .from('game_messages')
    .insert([{
      match_id: data.id,
      from_user: homeUserId,
      message_type: 'challenge',
      custom_text: `You have been challenged to a ${matchType} match!`,
      is_game_event: false,
    }]);

  return data;
}

export async function acceptChallenge(matchId, userId) {
  const { data, error } = await supabase
    .from('matches')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', matchId)
    .eq('status', 'awaiting_opponent')
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Challenge not found or already expired');

  return data;
}

export async function fetchAwaitingChallenges(userId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*, home:home_user_id(username,display_name), away:away_user_id(username,display_name)')
    .eq('status', 'awaiting_opponent')
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
    .gt('challenge_expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function declineChallenge(matchId, userId) {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'abandoned' })
    .eq('id', matchId)
    .eq('status', 'awaiting_opponent')
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`);

  if (error) throw error;
}

async function loadTeam(collectionId) {
  if (!collectionId) return null;
  const { data, error } = await supabase
    .from('UserCollection')
    .select('*')
    .eq('id', collectionId)
    .single();
  if (error) return null;
  return data;
}
