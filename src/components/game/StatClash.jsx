import { Zap, Shield, Wind, Target, Heart, RotateCcw, Crosshair } from 'lucide-react';

const STATS = [
  { key: 'stat_speed',         label: 'Speed',          icon: Wind,       color: 'text-blue-400' },
  { key: 'stat_shooting',      label: 'Shooting',       icon: Target,     color: 'text-red-400' },
  { key: 'stat_passing',       label: 'Passing',        icon: Crosshair,  color: 'text-green-400' },
  { key: 'stat_tackling',      label: 'Tackling',       icon: Shield,     color: 'text-yellow-400' },
  { key: 'stat_stamina',       label: 'Stamina',        icon: Heart,      color: 'text-pink-400' },
  { key: 'stat_spin',          label: 'Spin',           icon: RotateCcw,  color: 'text-purple-400' },
  { key: 'stat_flick_accuracy',label: 'Flick',          icon: Zap,        color: 'text-gold' },
];

function StatBar({ value, max = 100, winner }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className={`h-2 rounded-full overflow-hidden bg-secondary ${winner ? 'ring-1 ring-gold' : ''}`}>
      <div
        className={`h-full rounded-full transition-all ${winner ? 'bg-gold' : 'bg-muted-foreground/40'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function StatClash({ attacker, defender, boostActive = false }) {
  if (!attacker || !defender) return null;

  const boost = boostActive ? 1.15 : 1.0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-heading text-xs text-blue-400 uppercase tracking-widest">
          {attacker.player_name || 'Attacker'}
        </span>
        <span className="text-[10px] text-muted-foreground font-heading">VS</span>
        <span className="font-heading text-xs text-red-400 uppercase tracking-widest">
          {defender.player_name || 'Defender'}
        </span>
      </div>

      {STATS.map(({ key, label, icon: Icon, color }) => {
        const aVal = Math.min(100, Math.round((attacker[key] || 50) * boost));
        const dVal = defender[key] || 50;
        const aWins = aVal >= dVal;
        return (
          <div key={key} className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className={`font-heading font-bold ${aWins ? 'text-foreground' : ''}`}>{aVal}</span>
              <div className={`flex items-center gap-1 ${color}`}>
                <Icon className="w-3 h-3" />
                <span className="font-heading tracking-wide">{label}</span>
              </div>
              <span className={`font-heading font-bold ${!aWins ? 'text-foreground' : ''}`}>{dVal}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex justify-end">
                <div className="w-full">
                  <StatBar value={aVal} winner={aWins} />
                </div>
              </div>
              <div>
                <StatBar value={dVal} winner={!aWins} />
              </div>
            </div>
          </div>
        );
      })}

      {boostActive && (
        <div className="flex items-center gap-1 justify-center mt-2">
          <Zap className="w-3 h-3 text-gold" />
          <span className="text-[10px] text-gold font-heading tracking-wide">RARITY BOOST ACTIVE +15%</span>
        </div>
      )}
    </div>
  );
}