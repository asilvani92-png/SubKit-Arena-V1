import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import supabase from '@/lib/supabaseClient';
import db from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { RealtimeMatchManager } from '@/lib/pvp';
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

  // Substitution state
  const [showSubModal, setShowSubModal] = useState(false);
  const [subOffIndex, setSubOffIndex] = useState(null);
  const [subOnIndex, setSubOnIndex] = useState(null);

  const engineRef = useRef(null);
  const intervalRef = useRef(null);
  const awaitingTimerRef = useRef(null);
  const realtimeMgrRef = useRef(null);
  const realtimeMgrRef = useRef(null);

  // Start match
  const startMatch = useCallback(() => {
    if (!homeTeam || !awayTeam) return;
    const isPvP = !matchState?.is_ai_match && matchState?.away_user_id && !awaitingOpponent;
    const state = simulateFullMatch(
      homeTeam,
      awayTeam,
      matchState?.home_formation || '4-4-2',
      matchState?.away_formation || '4-4-2',
      matchState?.home_tactic || 'balanced',
      matchState?.away_tactic || 'balanced',
      matchState?.match_type || 'friendly',
      Date.now() % 65536
    );
    engineRef.current = state;
    setEngineState(state);
    setEvents(state.events);
    setPaused(false);

    // Start PvP realtime sync if applicable
    if (isPvP && user && matchState) {
      realtimeMgrRef.current = new RealtimeMatchManager(
        matchId,
        user.id,
        (newState) => setEngineState(prev => ({ ...(prev || engineRef.current), ...newState })),
        (ev, allEvts) => {
          if (ev) setEvents(prev => [...prev, ev]);
          if (allEvts) setEvents(allEvts);
        }
      );
      realtimeMgrRef.current.start(engineRef.current);
    }
  }, [homeTeam, awayTeam, matchState, awaitingOpponent, matchId, user]); 

  // Match completion handler
  const handleMatchComplete = useCallback(async (finalState) => {
    try {
      // 1. Save match results to DB
      await db.updateMatch(matchId, {
        home_score: finalState.home?.score || 0,
        away_score: finalState.away?.score || 0,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // 2. Calculate XP and ELO changes
      const homeScore = finalState.home?.score || 0;
      const awayScore = finalState.away?.score || 0;
      
      let xpGain = 100; // Base XP for playing
      let eloChange = 0;

      if (homeScore > awayScore) {
        xpGain += 50;
        eloChange = 20;
      } else if (homeScore < awayScore) {
        xpGain += 20;
        eloChange = -15;
      } else {
        xpGain += 30;
        eloChange = 0;
      }

      // 3. Update user's flicker club stats
      if (user?.id) {
        // This is simplified; in a real app, we'd fetch current ELO first
        // but for now, we'll just use upsert with the delta logic handled by a function or just simplistic addition
        // Since we don't have a "increment" helper in db.js, we'll just do a simple update
        const { data: club } = await supabase
          .from('flicker_clubs')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (club) {
          await db.updateFlickerClub(user.id, {
            xp: (club.xp || 0) + xpGain,
            elo_rating: (club.elo_rating || 1000) + eloChange,
            wins: homeScore > awayScore ? (club.wins || 0) + 1 : (club.wins || 0),
            draws: homeScore === awayScore ? (club.draws || 0) + 1 : (club.draws || 0),
            losses: homeScore < awayScore ? (club.losses || 0) + 1 : (club.losses || 0),
          });
        } else {
          // Create club if it doesn't exist
          await db.updateFlickerClub(user.id, {
            xp: xpGain,
            elo_rating: 1000 + eloChange,
            wins: homeScore > awayScore ? 1 : 0,
            draws: homeScore === awayScore ? 1 : 0,
            losses: homeScore < awayScore ? 1 : 0,
          });
        }
      }
    } catch (e) {
      console.error('Error persisting match results:', e);
    }
  }, [matchId, user]);

  // Tick engine at set interval
  useEffect(() => {
    if (!engineState || paused || showResult) return;
    
    if (speed === 'instant') {
      // Instant mode: immediately jump to completion
      const finalState = { ...engineRef.current, status: 'completed', minute: 90 };
      setEngineState(finalState);
      setEvents([...finalState.events]);
      setShowResult(true);
      setPaused(true);
      handleMatchComplete(finalState);
      return;
    }

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
        handleMatchComplete(state);
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
  }, [engineState, paused, speed, showResult, handleMatchComplete]);

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

  const handleSubstitution = () => {
    if (!engineRef.current || subOffIndex === null || subOnIndex === null) return;
    
    const result = applyUserAction(engineRef.current, 'home', 'substitution', {
      offIndex: subOffIndex,
      onIndex: subOnIndex
    });

    if (result.success) {
      engineRef.current.events.push({
        minute: Math.floor(engineRef.current.minute),
        eventType: 'user_action',
        team: 'home',
        commentary: `[SUB] ${engineRef.current.home.players[subOnIndex]?.player_name} replaces ${engineRef.current.home.players[subOffIndex]?.player_name}`,
        is_user_action: true,
      });
      setEngineState({ ...engineRef.current });
      setEvents([...engineRef.current.events]);
      setShowSubModal(false);
      setSubOffIndex(null);
      setSubOnIndex(null);
    } else {
      alert(result.error || 'Substitution failed');
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
          
          <div className="space-y-2">
            <p className="text-[10px] font-heading text-muted-foreground uppercase tracking-widest">Select Formation</p>
            <select 
              value={matchState?.home_formation || '4-4-2'}
              onChange={async (e) => {
                const formation = e.target.value;
                await db.updateMatch(matchId, { home_formation: formation });
                setMatchState(prev => ({ ...prev, home_formation: formation }));
              }}
              className="w-full p-2 bg-secondary border border-border rounded text-xs font-heading text-foreground outline-none"
            >
              {['4-4-2', '4-3-3', '4-5-1', '3-5-2', '4-2-3-1', '5-3-2', '3-4-3', '4-1-2-1-2'].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

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
            onSub={() => setShowSubModal(true)}
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

      {/* Substitution Modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-6">
            <h3 className="font-heading text-lg font-bold text-gold uppercase tracking-wider text-center">Substitution</h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Out Player */}
              <div className="space-y-2">
                <p className="text-[10px] font-heading text-muted-foreground uppercase text-center">Player Out</p>
                <div className="space-y-1 max-h-60 overflow-y-auto border border-border rounded-lg p-1">
                  {homeTeam.players.slice(0, 11).map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setSubOffIndex(i)}
                      className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${subOffIndex === i ? 'bg-gold text-background font-bold' : 'hover:bg-secondary text-foreground'}`}
                    >
                      {p.player_name} <span className="text-[9px] opacity-60">({p.specific_position})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* In Player */}
              <div className="space-y-2">
                <p className="text-[10px] font-heading text-muted-foreground uppercase text-center">Player In</p>
                <div className="space-y-1 max-h-60 overflow-y-auto border border-border rounded-lg p-1">
                  {homeTeam.players.slice(11).map((p, i) => (
                    <button
                      key={i + 11}
                      onClick={() => setSubOnIndex(i + 11)}
                      className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${subOnIndex === i + 11 ? 'bg-gold text-background font-bold' : 'hover:bg-secondary text-foreground'}`}
                    >
                      {p.player_name} <span className="text-[9px] opacity-60">({p.specific_position})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubModal(false)}
                className="flex-1 py-2 border border-border text-muted-foreground font-heading text-xs rounded hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubstitution}
                disabled={subOffIndex === null || subOnIndex === null}
                className="flex-1 py-2 bg-gold text-background font-heading font-bold tracking-wider text-xs rounded disabled:opacity-50 hover:bg-gold-light transition-colors"
              >
                Confirm Sub
              </button>
            </div>
          </div>
        </div>
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
