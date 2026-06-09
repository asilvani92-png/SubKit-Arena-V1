import db from '../lib/db';
import supabase from '@/lib/supabaseClient';

import { useQuery } from '@tanstack/react-query';

import { Trophy, Medal, Star, Swords } from 'lucide-react';
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
    queryFn: () => db.entities.FlickerClub.list('elo_rating', 100),
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });

  const sorted = [...rows].sort((a, b) => {
    if (b.elo_rating !== a.elo_rating) return b.elo_rating - a.elo_rating;
    const gdA = (a.goals_for || 0) - (a.goals_against || 0);
    const gdB = (b.goals_for || 0) - (b.goals_against || 0);
    if (gdB !== gdA) return gdB - gdA;
    return (b.goals_for || 0) - (a.goals_for || 0);
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-gold tracking-widest uppercase flex items-center gap-2">
          <Swords className="w-6 h-6" />
          League Table
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Ranked by ELO rating</p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_5rem] gap-2 px-4 py-2.5 bg-secondary text-[10px] text-muted-foreground font-heading tracking-widest uppercase border-b border-border">
          <div>#</div>
          <div>Club</div>
          <div className="text-center">M</div>
          <div className="text-center">W</div>
          <div className="text-center">D</div>
          <div className="text-center">L</div>
          <div className="text-center">ELO</div>
        </div>

        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-12 border-b border-border animate-pulse bg-secondary/40" />
          ))
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm font-heading tracking-wide">
            No clubs yet — win your first match to appear!
          </div>
        ) : (
          sorted.map((row, i) => {
            const pos = i + 1;
            const isMe = row.user_id === me?.id;
            return (
              <motion.div
                key={row.user_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_5rem] gap-2 items-center px-4 py-3 border-b border-border/60 last:border-0 transition-colors ${isMe ? 'bg-gold/8' : 'hover:bg-secondary/40'}`}
              >
                <div className="flex items-center justify-center">
                  <PositionIcon pos={pos} />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-heading text-sm font-bold truncate ${isMe ? 'text-gold' : 'text-foreground'}`}>
                    {row.club_name || 'Unnamed Club'}
                  </span>
                  {isMe && <Star className="w-3 h-3 text-gold flex-shrink-0 fill-gold" />}
                </div>
                <div className="text-center text-xs text-muted-foreground font-mono">{row.matches_played || 0}</div>
                <div className="text-center text-xs text-green-400 font-mono">{row.wins || 0}</div>
                <div className="text-center text-xs text-yellow-400 font-mono">{row.draws || 0}</div>
                <div className="text-center text-xs text-red-400 font-mono">{row.losses || 0}</div>
                <div className="text-center font-heading font-bold text-sm text-gold">{row.elo_rating || 1000}</div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Stats summary for current user */}
      {me && sorted.find(r => r.user_id === me.id) && (
        <div className="mt-6 border border-gold/30 rounded-xl p-4 bg-gold/5">
          <p className="text-xs text-gold font-heading tracking-widest uppercase mb-3">Your Club</p>
          {(() => {
            const my = sorted.find(r => r.user_id === me.id);
            const pos = sorted.findIndex(r => r.user_id === me.id) + 1;
            return (
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  { label: 'POSITION', val: `#${pos}` },
                  { label: 'ELO', val: my.elo_rating || 1000 },
                  { label: 'WON', val: my.wins || 0 },
                  { label: 'PLAYED', val: my.matches_played || 0 },
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