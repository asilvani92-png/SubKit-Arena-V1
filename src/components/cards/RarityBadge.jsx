const config = {
  Common:      { bg: 'bg-secondary',          text: 'text-muted-foreground', label: 'COMMON' },
  Uncommon:    { bg: 'bg-secondary',          text: 'text-foreground',       label: 'UNCOMMON' },
  Rare:        { bg: 'bg-blue-900/60',        text: 'text-blue-300',         label: 'RARE' },
  'Ultra Rare':{ bg: 'bg-gold/20',           text: 'text-gold',             label: 'ULTRA RARE' },
  Legend:      { bg: 'bg-purple-900/60',      text: 'text-purple-300',       label: 'LEGEND' },
};

export default function RarityBadge({ rarity, size = 'sm' }) {
  const c = config[rarity] || config.Common;
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${c.bg} ${c.text} font-heading ${textSize} font-bold tracking-widest uppercase`}>
      {c.label}
    </span>
  );
}