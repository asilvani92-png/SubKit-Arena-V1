import db from '../lib/db';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Swords, Clock, Trophy, XCircle, Play, Zap, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PitchGrid from '@/components/game/PitchGrid';
import StatClash from '@/components/game/StatClash';
import { toast } from 'sonner';

const ACTION_LABELS = { pass: 'PASS', shoot: 'SHOOT', tackle: 'TACKLE', boost: 'BOOST' };

function statusColor(status) {
  if (status === 'active') return 'text-green-400';
  if (status === 'completed') return 'text-gold';
  if (status === 'pending') return 'text-blue-400';
  return 'text-muted-foreground';
}

function MatchRow({ match, userId, onOpen }) {
  const isHome = match.home_user_id === userId;
  const myTurn = (match.current_turn === 'home' && isHome) || (match.current_turn === 'away' && !isHome);
  return (
    <div
      onClick={() => onOpen(match)}
      className={`border rounded-xl p-4 cursor-pointer transition-all hover:brightness-110 ${myTurn && match.status === 'active' ? 'border-gold/60 bg-gold/5 animate-pulse-gold' : 'border-border bg-card'}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-heading font-bold">
            <span className="text-blue-400 truncate">{match.home_team_name}</span>
            <span className="text-muted-foreground text-xs">vs</span>
            <span className="text-red-400 truncate">{match.away_team_name}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span className={`font-heading uppercase tracking-wide ${statusColor(match.status)}`}>{match.status}</span>
            <span>Turn {match.turn_number}/{match.max_turns}</span>
            {myTurn && match.status === 'active' && (
              <span className="text-gold font-heading tracking-wide font-bold">YOUR TURN</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading font-bold text-xl text-foreground">
            {match.home_score} – {match.away_score}
          </p>
        </div>
      </div>
    </div>
  );
}

function MatchDetail({ match, userId, onClose, onUpdate }) {
  const isHome = match.home_user_id === userId;
  const myTurn = (match.current_turn === 'home' && isHome) || (match.current_turn === 'away' && !isHome);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const board = match.board_state || {
    home_positions: Array.from({ length: 11 }, (_, i) => ({ id: i, name: `H${i}`, pos: `${i + 1},1` })),
    away_positions: Array.from({ length: 11 }, (_, i) => ({ id: i, name: `A${i}`, pos: `${i + 1},12` })),
    ball_position: { row: 7, col: 5 },
  };

  const doMove = async (newPos) => {
    if (!selectedPlayer || submitting) return;
    setSubmitting(true);
    const side = isHome ? 'home_positions' : 'away_positions';
    const updated = board[side].map(p => p.id === selectedPlayer.id ? { ...p, pos: newPos } : p);
    const newBoard = { ...board, [side]: updated };
    const nextTurn = match.current_turn === 'home' ? 'away' : 'home';
    const logEntry = {
      turn: match.turn_number + 1,
      player: selectedPlayer.name,
      action: pendingAction || 'move',
      from: selectedPlayer.pos,
      to: newPos,
      result: 'moved',
      timestamp: new Date().toISOString(),
    };
    await db.entities.Match.update(match.id, {
      board_state: newBoard,
      current_turn: nextTurn,
      turn_number: match.turn_number + 1,
      action_log: [...(match.action_log || []), logEntry],
    });
    setSelectedPlayer(null);
    setPendingAction(null);
    onUpdate();
    setSubmitting(false);
    toast.success('Move made!');
  };

  const doShoot = async () => {
    if (submitting) return;
    setSubmitting(true);
    const isGoal = Math.random() > 0.6;
    const nextHome = isHome && isGoal ? match.home_score + 1 : match.home_score;
    const nextAway = !isHome && isGoal ? match.away_score + 1 : match.away_score;
    const nextTurn = match.current_turn === 'home' ? 'away' : 'home';
    const logEntry = {
      turn: match.turn_number + 1,
      player: selectedPlayer?.name || '?',
      action: 'shoot',
      result: isGoal ? 'GOAL!' : 'Saved',
      timestamp: new Date().toISOString(),
    };
    await db.entities.Match.update(match.id, {
      home_score: nextHome,
      away_score: nextAway,
      current_turn: nextTurn,
      turn_number: match.turn_number + 1,
      action_log: [...(match.action_log || []), logEntry],
    });
    onUpdate();
    setSubmitting(false);
    toast.success(isGoal ? '⚽ GOAL!' : 'Shot saved!');
    setSelectedPlayer(null);
  };

  const doBoost = async () => {
    if (submitting) return;
    const boostField = isHome ? 'home_boost_used' : 'away_boost_used';
    await db.entities.Match.update(match.id, { [boostField]: true });
    onUpdate();
    toast.success('Rarity Boost activated! +15% stats this turn.');
  };

  const canBoost = isHome ? !match.home_boost_used : !match.away_boost_used;
  const boostActive = isHome ? match.home_boost_used : match.away_boost_used;

  return (
    <div className="space-y-4">
      {/* Score bar */}
      <div className="flex items-center justify-between bg-secondary rounded-lg p-3">
        <div className="text-left">
          <p className="font-heading text-xs text-blue-400 uppercase tracking-wide">{match.home_team_name}</p>
          <p className="font-heading text-2xl font-bold text-foreground">{match.home_score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-heading">TURN {match.turn_number}/{match.max_turns}</p>
          <p className={`text-xs font-heading font-bold uppercase tracking-wide mt-0.5 ${myTurn ? 'text-gold' : 'text-muted-foreground'}`}>
            {myTurn ? 'YOUR TURN' : `${match.current_turn.toUpperCase()} PLAYS`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-heading text-xs text-red-400 uppercase tracking-wide">{match.away_team_name}</p>
          <p className="font-heading text-2xl font-bold text-foreground">{match.away_score}</p>
        </div>
      </div>

      {/* Pitch */}
      <PitchGrid
        homePlayers={board.home_positions}
        awayPlayers={board.away_positions}
        ballPosition={board.ball_position}
        isMyTurn={myTurn && match.status === 'active'}
        isHome={isHome}
        selectedPlayer={selectedPlayer}
        onSelectPlayer={setSelectedPlayer}
        onMovePlayer={doMove}
        onAction={(action, data) => { setPendingAction(action); }}
      />

      {/* Action buttons */}
      {myTurn && match.status === 'active' && (
        <div className="flex flex-wrap gap-2">
          {canBoost && (
            <Button size="sm" variant="outline" onClick={doBoost} className="border-gold/40 text-gold hover:bg-gold/10 font-heading text-xs tracking-wide">
              <Zap className="w-3 h-3 mr-1" />
              USE BOOST
            </Button>
          )}
          {selectedPlayer && (
            <Button size="sm" onClick={doShoot} className="bg-red-trim text-foreground font-heading text-xs tracking-wide hover:opacity-80">
              <Play className="w-3 h-3 mr-1" />
              SHOOT
            </Button>
          )}
          {boostActive && (
            <span className="flex items-center gap-1 text-[11px] text-gold font-heading">
              <Zap className="w-3 h-3" /> BOOST ACTIVE
            </span>
          )}
        </div>
      )}

      {/* Action log */}
      {(match.action_log?.length > 0) && (
        <div className="border border-border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
          <p className="text-[10px] text-muted-foreground font-heading tracking-widest mb-2">ACTION LOG</p>
          {[...(match.action_log || [])].reverse().slice(0, 20).map((log, i) => (
            <div key={i} className="text-[11px] text-foreground/70 flex items-center gap-2">
              <span className="text-muted-foreground font-mono w-6">{log.turn}</span>
              <span className="font-heading text-gold">{log.player}</span>
              <span>{log.action}</span>
              {log.result && <span className="text-green-400 font-bold">{log.result}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Matches() {
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [viewMatch, setViewMatch] = useState(null);
  const [opponentId, setOpponentId] = useState('');
  const [myTeamId, setMyTeamId] = useState('');
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });

  const { data: matches = [], isLoading, refetch } = useQuery({
    queryKey: ['matches'],
    queryFn: () => db.entities.Match.list('-created_date', 50),
  });

  const { data: myCollections = [] } = useQuery({
    queryKey: ['my-collections-complete'],
    queryFn: () => db.entities.UserCollection.filter({ is_complete: true }),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => db.entities.User.list(),
  });

  const userId = currentUser?.id;
  const myMatches = matches.filter(m => m.home_user_id === userId || m.away_user_id === userId);

  const createChallenge = async () => {
    if (!opponentId || !myTeamId) { toast.error('Select your team and an opponent'); return; }
    const myCol = myCollections.find(c => c.id === myTeamId);
    setCreating(true);
    const initPositions = (prefix, startCol) =>
      Array.from({ length: 11 }, (_, i) => ({ id: i, name: `${prefix}${i}`, pos: `${i + 1},${startCol}` }));
    await db.entities.Match.create({
      home_user_id: userId,
      away_user_id: opponentId,
      home_user_name: currentUser?.full_name || 'You',
      away_user_name: users.find(u => u.id === opponentId)?.full_name || 'Opponent',
      home_collection_id: myTeamId,
      away_collection_id: '',
      home_team_name: myCol?.team_name || 'Home',
      away_team_name: 'TBD',
      status: 'pending',
      current_turn: 'home',
      home_score: 0,
      away_score: 0,
      turn_number: 0,
      max_turns: 90,
      board_state: {
        home_positions: initPositions('H', 1),
        away_positions: initPositions('A', 12),
        ball_position: { row: 7, col: 5 },
      },
      action_log: [],
    });
    setCreating(false);
    setChallengeOpen(false);
    refetch();
    toast.success('Challenge sent!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-turf to-background">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero banner */}
        <div className="mb-12 text-center space-y-4">
          <div className="inline-block">
            <div className="text-5xl md:text-6xl font-heading font-black text-gold tracking-tighter uppercase mb-2 animate-pulse">
              ⚽ FLICKER CLUB
            </div>
            <div className="text-2xl md:text-3xl font-heading font-bold text-gold-light tracking-widest uppercase">
              MATCHNIGHT
            </div>
            <div className="h-1 w-24 bg-gradient-to-r from-gold via-gold-light to-gold mx-auto mt-3 rounded-full" />
          </div>
          <p className="text-sm text-muted-foreground font-heading tracking-wide max-w-md mx-auto mt-4">
            {myMatches.length} matches in progress • Step onto the pitch and claim your victory
          </p>
        </div>

        {/* Action CTA */}
        <div className="flex justify-center mb-12">
          <Button 
            onClick={() => setChallengeOpen(true)} 
            className="px-8 py-6 text-lg font-heading tracking-widest uppercase bg-gradient-to-r from-gold to-gold-light text-background hover:shadow-lg hover:shadow-gold/40 transition-all transform hover:scale-105"
          >
            <Flame className="w-5 h-5 mr-2" />
            ISSUE A CHALLENGE
          </Button>
        </div>

      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-20 rounded-xl bg-secondary animate-pulse" />)}</div>
      ) : myMatches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-3">
          <Swords className="w-10 h-10 mx-auto opacity-20" />
          <p className="font-heading tracking-wide">No matches yet — challenge someone!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {myMatches.map(m => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <MatchRow match={m} userId={userId} onOpen={setViewMatch} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Challenge dialog */}
      <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-gold tracking-widest uppercase">New Challenge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-muted-foreground font-heading tracking-wide block mb-1.5">YOUR TEAM</label>
              <Select value={myTeamId} onValueChange={setMyTeamId}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select completed team" />
                </SelectTrigger>
                <SelectContent>
                  {myCollections.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.team_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-heading tracking-wide block mb-1.5">OPPONENT</label>
              <Select value={opponentId} onValueChange={setOpponentId}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select opponent" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.id !== userId).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createChallenge} disabled={creating} className="w-full bg-gold text-background font-heading tracking-widest hover:bg-gold-light">
              {creating ? 'SENDING...' : 'SEND CHALLENGE'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Match detail dialog */}
      <Dialog open={!!viewMatch} onOpenChange={() => setViewMatch(null)}>
        <DialogContent className="bg-card border-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-gold tracking-widest uppercase text-sm">Match</DialogTitle>
          </DialogHeader>
          {viewMatch && (
            <MatchDetail
              match={viewMatch}
              userId={userId}
              onClose={() => setViewMatch(null)}
              onUpdate={() => { refetch(); setViewMatch(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}