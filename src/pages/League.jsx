import db from '../lib/db';

import { useQuery } from '@tanstack/react-query';

import { Trophy, Medal, Star } from 'lucide-react';
import { motion } from 'framer-motion';

function PositionIcon({ pos }) {
  if (pos === 1) return <Trophy className="w-4 h-4 text-gold" />;
  if (pos === 2) return <Medal className="w-4 h-4 text-gray-300" />;
  if (pos === 3) return <Medal className="w-4 h-4 text-amber-600" />;
  return <span className="w-4 text-center text-xs text-muted-foreground font-mono">{pos}</span>;
}

function GD({ for: gf, against: ga }) {
  const gd = gf - ga;
  return (
    <span className={`font-mono text-xs ${gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
      {gd > 0 ? '+' : ''}{gd}
    </span>
  );
}

export default function League() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['league'],
    queryFn: () => db.entities.LeagueTable.list('-points', 100),
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });

  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goals_for - a.goals_against;
    const gdB = b.goals_for - b.goals_against;
    if (gdB !== gdA) return gdB - gdA;
    return b.goals_for - a.goals_for;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-gold tracking-widest uppercase">League Table</h1>
        <p className="text-sm text-muted-foreground mt-1">Season 2025–26</p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_3rem] gap-2 px-4 py-2.5 bg-secondary text-[10px] text-muted-foreground font-heading tracking-widest uppercase border-b border-border">
          <div>#</div>
          <div>Team</div>
          <div className="text-center">P</div>
          <div className="text-center">W</div>
          <div className="text-center">D</div>
          <div className="text-center">L</div>
          <div className="text-center">GD</div>
          <div className="text-center text-gold">Pts</div>
        </div>

        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-12 border-b border-border animate-pulse bg-secondary/40" />
          ))
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm font-heading tracking-wide">
            No results yet — play your first match!
          </div>
        ) : (
          sorted.map((row, i) => {
            const pos = i + 1;
            const isMe = row.user_id === me?.id;
            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_3rem] gap-2 items-center px-4 py-3 border-b border-border/60 last:border-0 transition-colors ${isMe ? 'bg-gold/8' : 'hover:bg-secondary/40'}`}
              >
                <div className="flex items-center justify-center">
                  <PositionIcon pos={pos} />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-heading text-sm font-bold truncate ${isMe ? 'text-gold' : 'text-foreground'}`}>
                    {row.username || 'Player'}
                  </span>
                  {isMe && <Star className="w-3 h-3 text-gold flex-shrink-0 fill-gold" />}
                </div>
                <div className="text-center text-xs text-muted-foreground font-mono">{row.played}</div>
                <div className="text-center text-xs text-green-400 font-mono">{row.won}</div>
                <div className="text-center text-xs text-yellow-400 font-mono">{row.drawn}</div>
                <div className="text-center text-xs text-red-400 font-mono">{row.lost}</div>
                <div className="text-center"><GD for={row.goals_for} against={row.goals_against} /></div>
                <div className="text-center font-heading font-bold text-sm text-gold">{row.points}</div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Stats summary for current user */}
      {me && sorted.find(r => r.user_id === me.id) && (
        <div className="mt-6 border border-gold/30 rounded-xl p-4 bg-gold/5">
          <p className="text-xs text-gold font-heading tracking-widest uppercase mb-3">Your Stats</p>
          {(() => {
            const my = sorted.find(r => r.user_id === me.id);
            const pos = sorted.findIndex(r => r.user_id === me.id) + 1;
            return (
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  { label: 'POSITION', val: `#${pos}` },
                  { label: 'POINTS', val: my.points },
                  { label: 'WON', val: my.won },
                  { label: 'GD', val: my.goals_for - my.goals_against > 0 ? `+${my.goals_for - my.goals_against}` : my.goals_for - my.goals_against },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="font-heading text-xl font-bold text-gold">{val}</p>
                    <p className="text-[10px] text-muted-foreground font-heading tracking-widest mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}