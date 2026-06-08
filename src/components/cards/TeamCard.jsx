import RarityBadge from './RarityBadge';
import { Shield, Star } from 'lucide-react';

const rarityBorderClass = {
  Common:       'border-border',
  Uncommon:     'border-blue-700/60',
  Rare:         'border-blue-500',
  'Ultra Rare': 'border-gold',
  Legend:       'border-purple-400',
};

const rarityGlowClass = {
  Common:       '',
  Uncommon:     '',
  Rare:         'shadow-[0_0_12px_hsl(217_91%_60%/0.25)]',
  'Ultra Rare': 'shadow-[0_0_16px_hsl(43_68%_52%/0.35)]',
  Legend:       'shadow-[0_0_20px_hsl(270_80%_60%/0.4)]',
};

export default function TeamCard({ team, onClick, owned = false, compact = false }) {
  const border = rarityBorderClass[team.rarity] || rarityBorderClass.Common;
  const glow = rarityGlowClass[team.rarity] || '';

  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg border-2 ${border} ${glow} bg-card overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:brightness-110 ${compact ? 'p-3' : 'p-4'}`}
    >
      {/* Vintage top stripe */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        team.rarity === 'Legend' ? 'shimmer-legend' :
        team.rarity === 'Ultra Rare' ? 'shimmer-rare' :
        team.rarity === 'Rare' ? 'bg-blue-500' :
        'bg-border'
      }`} />

      {owned && (
        <div className="absolute top-2 right-2">
          <Star className="w-4 h-4 text-gold fill-gold" />
        </div>
      )}

      <div className="flex items-start gap-3 mt-1">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 border border-border">
          {team.image_url ? (
            <img src={team.image_url} alt={team.name} className="w-10 h-10 object-contain rounded-full" />
          ) : (
            <Shield className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-bold text-foreground uppercase tracking-wide leading-tight truncate">{team.name}</p>
          {team.ref_number && (
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">REF #{team.ref_number}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{team.era}</p>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <RarityBadge rarity={team.rarity} size="xs" />
            {team.market_value_gbp && (
              <span className="text-[9px] text-gold font-heading">£{team.market_value_gbp}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}