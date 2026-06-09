import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import MatchPitch from '@/components/game/MatchPitch';
import MatchHUD from '@/components/game/MatchHUD';
import CommentaryFeed from '@/components/game/CommentaryFeed';
import ActionBar from '@/components/game/ActionBar';
import MatchResult from '@/components/game/MatchResult';
import { simulateFullMatch, applyShout, applyUserAction, applyHalfTimeTalk, generateCommentary } from '../../packages/game-engine/src/index.js';
import HOUSE_TEAMS from '@/data/house-teams.json';

export default function GameArena() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [matchState, setMatchState] = useState(null);
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [engineState, setEngineState] = useState(null);
  const [events, setEvents] = useState([]);
  const [speed, setSpeed] = useState('normal');
  const [showHalfTime, setShowHalfTime] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [paused, setPaused] = useState(true);

  const engineRef = useRef(null);
  const intervalRef = useRef(null);

  // Load match data
  useEffect(() => {
    if (!matchId || !user) return;
    (async () => {
      try {
        const { data: match, error: matchErr } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();
        if (matchErr) throw matchErr;

        // Load home team players
        const { data: homePlayers } = await supabase
          .from('PlayerCard')
          .select('*')
          .eq('collection_id', match.home_collection_id);

        // If AI match, pick a random house team
        let awayPlayers = [];
        let awayTeamData = { team_name: 'AI Opponent', primary_colour: '#3b82f6', secondary_colour: '#1d4ed8' };
        if (match.is_ai_match) {
          const houseTeam = HOUSE_TEAMS[Math.floor(Math.random() * HOUSE_TEAMS.length)];
          awayTeamData = { ...houseTeam, team_name: houseTeam.name };
          // Generate basic players for the house team (simplified in-memory version)
          awayPlayers = generateBasicSquad(houseTeam, match.away_formation || '4-4-2');
        } else if (match.away_collection_id) {
          const { data: awayP } = await supabase
            .from('PlayerCard')
            .select('*')
            .eq('collection_id', match.away_collection_id);
          if (awayP) awayPlayers = awayP;
        }

        setHomeTeam({
          ...match,
          team_name: match.home_team_name,
          players: homePlayers || [],
          collection_id: match.home_collection_id,
        });
        setAwayTeam({
          ...awayTeamData,
          players: awayPlayers,
        });
        setMatchState(match);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError(e.message);
        setLoading(false);
      }
    })();
  }, [matchId, user]);

  // Generate basic squad for house teams (in-memory version of the Edge Function)
  function generateBasicSquad(team, formation) {
    const FORMATIONS = { '4-4-2': ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'], '4-3-3': ['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'], '4-5-1': ['GK','LB','CB','CB','RB','LM','CM','CM','CM','RM','ST'], '3-5-2': ['GK','CB','CB','CB','LM','CM','CM','CM','RM','ST','ST'], '4-2-3-1':['GK','LB','CB','CB','RB','CDM','CDM','CAM','LM','RM','ST'], '5-3-2':['GK','LWB','CB','CB','CB','RWB','CM','CM','CM','ST','ST'], '3-4-3':['GK','CB','CB','CB','LM','CM','CM','RM','LW','ST','RW'], '4-1-2-1-2':['GK','LB','CB','CB','RB','CDM','CM','CM','CAM','ST','ST']};
    const positions = FORMATIONS[formation] || FORMATIONS['4-4-2'];
    const base = team.base_rating || 60;
    const names = ['Rossi','Bianchi','Romano','Ferrari','Esposito','Russo','Bruno','Greco','Conti','Mancini','Rizzo','Lombardi','Moretti'];
    return positions.map((pos, i) => ({
      player_name: `Player ${i + 1}`,
      specific_position: pos,
      position: pos === 'GK' ? 'Goalkeeper' : (['CB','LB','RB','LWB','RWB'].includes(pos) ? 'Defender' : (['ST','LW','RW'].includes(pos) ? 'Forward' : 'Midfielder')),
      is_substitute: false,
      slot_index: i,
      pace: clampStat(base * (Math.random() * 0.4 + 0.6)),
      shooting: clampStat(base * (Math.random() * 0.4 + 0.6)),
      passing: clampStat(base * (Math.random() * 0.4 + 0.6)),
      dribbling: clampStat(base * (Math.random() * 0.4 + 0.6)),
      tackling: clampStat(base * (Math.random() * 0.4 + 0.6)),
      heading: clampStat(base * (Math.random() * 0.4 + 0.6)),
      crossing: clampStat(base * (Math.random() * 0.4 + 0.6)),
      vision: clampStat(base * (Math.random() * 0.4 + 0.6)),
      technique: clampStat(base * (Math.random() * 0.4 + 0.6)),
      positioning: clampStat(base * (Math.random() * 0.4 + 0.6)),
      strength: clampStat(base * (Math.random() * 0.4 + 0.6)),
      stamina: clampStat(base * (Math.random() * 0.4 + 0.6)),
      aggression: clampStat(base * (Math.random() * 0.4 + 0.6)),
      composure: clampStat(base * (Math.random() * 0.4 + 0.6)),
      set_pieces: clampStat(base * (Math.random() * 0.4 + 0.6)),
      bravery: clampStat(base * (Math.random() * 0.4 + 0.6)),
      fatigue: 0,
      overall_rating: base,
    }));
  }

  function clampStat(v) { return Math.max(1, Math.min(99, Math.round(v))); }

  // Start match
  const startMatch = useCallback(() => {
    if (!homeTeam || !awayTeam) return;
    const state = simulateFullMatch(
      homeTeam,
      awayTeam,
      matchState?.home_formation || '4-4-2',
      matchState?.away_formation || '4-4-2',
      matchState?.home_tactic || 'balanced',
      'balanced',
      matchState?.match_type || 'friendly',
      Date.now() % 65536
    );
    engineRef.current = state;
    setEngineState(state);
    setEvents(state.events);
    setPaused(false);
  }, [homeTeam, awayTeam, matchState]);

  // Tick engine at set interval
  useEffect(() => {
    if (!engineState || paused || showResult) return;
    const tickIntervals = { slow: 800, normal: 500, fast: 250 };
    const interval = tickIntervals[speed] || 500;

    const tick = () => {
      if (!engineRef.current) return;
      const state = engineRef.current;

      // Check if match is done
      if (state.status === 'completed' || state.minute >= 90) {
        state.status = 'completed';
        setEngineState({ ...state });
        setShowResult(true);
        setPaused(true);
        return;
      }

      // Half time pause
      if (state.status === 'half_time') {
        setShowHalfTime(true);
        setPaused(true);
        return;
      }

      engineRef.current = state;
      setEngineState({ ...state });
      setEvents([...state.events]);
    };

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [engineState, paused, speed, showResult]);

  // Always render from full event set
  const displayEvents = events;

  // Speed change
  const handleSpeedChange = (s) => { setSpeed(s); };

  // User actions
  const handleShout = (shoutKey) => {
    if (!engineRef.current) return;
    const result = applyShout(engineRef.current, 'home', shoutKey);
    if (result.success) {
      engineRef.current.events.push({
        minute: Math.floor(engineRef.current.minute),
        eventType: 'user_action',
        team: 'home',
        commentary: `[USER ACTION] Tactical shout: ${shoutKey}`,
        is_user_action: true,
      });
      setEngineState({ ...engineRef.current });
      setEvents([...engineRef.current.events]);
    }
  };

  const handleAction = (actionKey) => {
    if (!engineRef.current) return;
    const result = applyUserAction(engineRef.current, 'home', actionKey);
    if (result.success) {
      engineRef.current.events.push({
        minute: Math.floor(engineRef.current.minute),
        eventType: 'user_action',
        team: 'home',
        commentary: `[USER ACTION] ${actionKey.replace(/_/g, ' ')}`,
        is_user_action: true,
      });
      setEngineState({ ...engineRef.current });
      setEvents([...engineRef.current.events]);
    }
  };

  // Half time
  const handleHalfTimeContinue = (talkKey) => {
    if (!engineRef.current) return;
    if (talkKey) applyHalfTimeTalk(engineRef.current, 'home', talkKey);
    engineRef.current.status = 'active';
    engineRef.current.events.push({
      minute: 45, eventType: 'kickoff', team: 'home',
      commentary: generateCommentary('kickoff', null, null, null, '', 45),
    });
    setEngineState({ ...engineRef.current });
    setEvents([...engineRef.current.events]);
    setShowHalfTime(false);
    setPaused(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
          <span className="font-heading text-xs text-muted-foreground tracking-widest">LOADING MATCH...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="font-heading text-red-400 mb-2">Error loading match</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button onClick={() => navigate('/matches')} className="mt-4 text-gold text-xs font-heading">Back to Matches</button>
        </div>
      </div>
    );
  }

  if (!engineState) {
    // Pre-match screen
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6">
          <TrophyIcon className="w-12 h-12 text-gold mx-auto" />
          <h2 className="font-heading text-xl font-bold text-gold tracking-widest uppercase">Match Day</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto border-2" style={{ backgroundColor: matchState?.home_team_name?.includes('AI') ? '#3b82f6' : '#3b82f6' }} />
              <p className="font-heading text-xs mt-2">{matchState?.home_team_name || 'Home'}</p>
            </div>
            <span className="font-heading text-lg text-muted-foreground">vs</span>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto border-2" style={{ backgroundColor: '#ef4444' }} />
              <p className="font-heading text-xs mt-2">{matchState?.away_team_name || 'Away'}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {matchState?.away_team_name ? `vs ${matchState.away_team_name}` : 'vs AI Opponent'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={startMatch}
              className="px-6 py-2 bg-gold text-background font-heading font-bold tracking-widest text-sm rounded hover:bg-gold-light transition-colors"
              disabled={!homeTeam || !awayTeam}
            >
              Kick Off!
            </button>
            <button
              onClick={() => navigate('/matches')}
              className="px-4 py-2 border border-border text-muted-foreground font-heading text-xs rounded hover:text-foreground"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quarter of the match clock
  const currentMinute = engineState.minute || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HUD */}
      <MatchHUD
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeScore={engineState.home?.score || 0}
        awayScore={engineState.away?.score || 0}
        currentMinute={currentMinute}
        status={engineState.status}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        homeAP={engineState.home?.apRemaining || 6}
        awayAP={engineState.away?.apRemaining || 6}
        isHome={true}
      />

      {/* Main area: pitch + commentary */}
      <div className="flex-1 flex flex-col md:flex-row gap-2 p-2 overflow-hidden">
        {/* Pitch */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <MatchPitch
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              events={displayEvents}
              currentMinute={currentMinute}
            />
          </div>
        </div>

        {/* Commentary sidebar */}
        <div className="w-full md:w-64">
          <CommentaryFeed events={displayEvents} />
        </div>
      </div>

      {/* Action bar */}
      {engineState.status === 'active' && (
        <div className="sticky bottom-0">
          <ActionBar
            teamKey="home"
            minute={currentMinute}
            apRemaining={engineState.home?.apRemaining || 6}
            possession={engineState.possession}
            activeShout={engineState.home?.activeShout}
            scoreDiff={(engineState.home?.score || 0) - (engineState.away?.score || 0)}
            canSub={engineState.home?.subsUsed < 3}
            subsUsed={engineState.home?.subsUsed || 0}
            onShout={handleShout}
            onAction={handleAction}
            onSub={() => {}}
          />
        </div>
      )}

      {/* Half Time modal */}
      {showHalfTime && (
        <div className="fixed inset-0 bg-background/90 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <h3 className="font-heading text-lg font-bold text-gold uppercase tracking-wider">Half Time</h3>
            <p className="text-3xl font-black">{engineState.home?.score || 0} — {engineState.away?.score || 0}</p>
            <p className="text-xs text-muted-foreground">Choose a team talk for the second half:</p>
            <div className="space-y-2">
              {[
                { key:'encourage', label:'Encourage', desc:'+3 Composure' },
                { key:'demand_more', label:'Demand More', desc:'+3 Aggression & Shooting' },
                { key:'calm_down', label:'Calm Down', desc:'-5 Aggression, +3 Passing & Positioning' },
                { key:'no_changes', label:'No Changes', desc:'No effect' },
              ].map(talk => (
                <button
                  key={talk.key}
                  onClick={() => handleHalfTimeContinue(talk.key)}
                  className="w-full text-left px-4 py-2 bg-secondary hover:bg-gold/20 rounded-lg transition-colors"
                >
                  <span className="font-heading text-xs font-bold">{talk.label}</span>
                  <p className="text-[9px] text-muted-foreground">{talk.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Result screen */}
      {showResult && (
        <MatchResult
          matchState={engineState}
          onRematch={() => {
            setEngineState(null);
            setEvents([]);
            setShowResult(false);
            setPaused(true);
          }}
          onClose={() => navigate('/matches')}
        />
      )}
    </div>
  );
}

function TrophyIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 2H4v2h1v2c0 4.08 2.44 7.53 6 9.07V18H8v2h8v-2h-3v-2.93c3.56-1.54 6-4.99 6-9.07V4h1V2zm-3 4c0 3.86-2.24 7-5 8.29S7 9.86 7 6V4h10v2z"/>
    </svg>
  );
}
