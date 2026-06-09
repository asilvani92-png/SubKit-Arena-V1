import { Trophy, Target, Shield, CornerLeftUp, AlertTriangle } from 'lucide-react';

export default function MatchResult({ matchState, onRematch, onClose }) {
  if (!matchState) return null;
  const { home, away, events, manOfTheMatch } = matchState;

  const homeStats = home?.stats || {};
  const awayStats = away?.stats || {};

  const goals = events?.filter(e => e.eventType === 'goal') || [];
  const keyEvents = events?.filter(e => ['goal','red_card','penalty'].includes(e.eventType)) || [];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-6 space-y-6">
        {/* Title */}
        <div className="text-center">
          <Trophy className="w-8 h-8 text-gold mx-auto mb-2" />
          <h2 className="font-heading text-xl font-bold text-gold tracking-widest uppercase">Full Time</h2>
        </div>

        {/* Score */}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="font-heading text-xs text-muted-foreground">{home?.name || 'Home'}</p>
            <p className="font-heading text-4xl font-black">{home?.score ?? 0}</p>
          </div>
          <span className="font-heading text-2xl text-muted-foreground">-</span>
          <div className="text-center">
            <p className="font-heading text-xs text-muted-foreground">{away?.name || 'Away'}</p>
            <p className="font-heading text-4xl font-black">{away?.score ?? 0}</p>
          </div>
        </div>

        {/* Man of the Match */}
        {manOfTheMatch && (
          <div className="text-center bg-gold/10 border border-gold/30 rounded-lg p-3">
            <p className="text-[10px] font-heading tracking-widest text-gold uppercase">Man of the Match</p>
            <p className="font-heading font-bold text-foreground">{manOfTheMatch}</p>
          </div>
        )}

        {/* Stats comparison */}
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="text-right text-muted-foreground">{homeStats.shots ?? 0}</div>
          <div className="text-center text-muted-foreground font-heading tracking-wider flex items-center justify-center gap-1">
            <Target className="w-3 h-3" /> Shots
          </div>
          <div className="text-left text-muted-foreground">{awayStats.shots ?? 0}</div>

          <div className="text-right text-muted-foreground">{homeStats.shotsOnTarget ?? 0}</div>
          <div className="text-center text-muted-foreground font-heading tracking-wider flex items-center justify-center gap-1">
            <Target className="w-3 h-3" /> On Target
          </div>
          <div className="text-left text-muted-foreground">{awayStats.shotsOnTarget ?? 0}</div>

          <div className="text-right text-muted-foreground">{homeStats.possessionPct ?? 50}%</div>
          <div className="text-center text-muted-foreground font-heading tracking-wider">Possession</div>
          <div className="text-left text-muted-foreground">{awayStats.possessionPct ?? 50}%</div>

          <div className="text-right text-muted-foreground">{homeStats.fouls ?? 0}</div>
          <div className="text-center text-muted-foreground font-heading tracking-wider flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Fouls
          </div>
          <div className="text-left text-muted-foreground">{awayStats.fouls ?? 0}</div>

          <div className="text-right text-muted-foreground">{homeStats.corners ?? 0}</div>
          <div className="text-center text-muted-foreground font-heading tracking-wider flex items-center justify-center gap-1">
            <CornerLeftUp className="w-3 h-3" /> Corners
          </div>
          <div className="text-left text-muted-foreground">{awayStats.corners ?? 0}</div>
        </div>

        {/* Timeline */}
        {keyEvents.length > 0 && (
          <div>
            <p className="font-heading text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Key Events</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {keyEvents.map((ev, i) => (
                <p key={i} className={`text-[10px] ${ev.eventType === 'goal' ? 'text-gold' : ev.eventType === 'red_card' ? 'text-red-400' : ''}`}>
                  {ev.minute ? `${Math.floor(ev.minute)}'` : ''} - {ev.commentary?.replace(/^\d+' — /, '') || ev.eventType}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onRematch}
            className="flex-1 py-2 bg-gold text-background font-heading font-bold tracking-wider text-xs rounded hover:bg-gold-light transition-colors"
          >
            Rematch
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-border text-muted-foreground font-heading text-xs rounded hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
