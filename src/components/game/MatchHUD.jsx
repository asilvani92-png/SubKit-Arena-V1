import { Clock, Zap } from 'lucide-react';

export default function MatchHUD({ homeTeam, awayTeam, homeScore, awayScore, currentMinute, status, speed, onSpeedChange, homeAP, awayAP, isHome }) {
  const formatMinute = (m) => {
    const min = Math.min(90, Math.floor(m || 0));
    const sec = Math.floor(((m || 0) - min) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-card/90 backdrop-blur border-b border-border/60 px-3 py-2">
      {/* Score and clock */}
      <div className="flex items-center justify-between">
        {/* Home team */}
        <div className="flex items-center gap-2 w-1/3">
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: homeTeam?.primary_colour || '#3b82f6' }} />
          <span className="font-heading text-xs font-bold truncate text-right">{homeTeam?.name || 'Home'}</span>
        </div>

        {/* Score + clock */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3">
            <span className="font-heading text-2xl font-black text-foreground">{homeScore ?? 0}</span>
            <span className="font-heading text-xs text-muted-foreground">-</span>
            <span className="font-heading text-2xl font-black text-foreground">{awayScore ?? 0}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="font-heading text-xs text-muted-foreground">
              {status === 'completed' ? "FT" : status === 'half_time' ? "HT" : formatMinute(currentMinute)}
            </span>
            {status === 'active' && (
              <div className="flex items-center gap-1">
                {['slow','normal','fast'].map(s => (
                  <button
                    key={s}
                    onClick={() => onSpeedChange(s)}
                    className={`text-[8px] px-1.5 py-0.5 rounded font-heading tracking-wider uppercase ${
                      speed === s ? 'bg-gold text-background' : 'text-muted-foreground hover:text-foreground bg-secondary'
                    }`}
                  >
                    {s === 'normal' ? '1x' : s === 'slow' ? '0.5x' : '2x'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 w-1/3 justify-end">
          <span className="font-heading text-xs font-bold truncate">{awayTeam?.name || 'Away'}</span>
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: awayTeam?.primary_colour || '#ef4444' }} />
        </div>
      </div>

      {/* AP counter */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          <Zap className={`w-3 h-3 ${isHome ? 'text-blue-400' : 'text-muted-foreground'}`} />
          <span className={`font-heading text-xs ${isHome ? 'text-blue-400 font-bold' : 'text-muted-foreground'}`}>
            AP: {homeAP ?? 6}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`font-heading text-xs ${!isHome ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>
            AP: {awayAP ?? 6}
          </span>
          <Zap className={`w-3 h-3 ${!isHome ? 'text-red-400' : 'text-muted-foreground'}`} />
        </div>
      </div>
    </div>
  );
}
