import { Camera, User } from 'lucide-react';
import RarityBadge from './RarityBadge';

const positionColors = {
  Goalkeeper: 'text-yellow-400',
  Defender:   'text-blue-400',
  Midfielder: 'text-green-400',
  Forward:    'text-red-trim',
};

export default function PlayerSticker({ slot, rarity = 'Common', teamName, onCapture, printMode = false }) {
  const hasPhoto = !!slot?.photo_url;
  const posColor = positionColors[slot?.position] || 'text-muted-foreground';

  return (
    <div className={`sticker-card rounded-lg bg-card overflow-hidden flex flex-col ${printMode ? 'print-sticker' : ''}`}
      style={{ aspectRatio: '2/3' }}>
      {/* Photo area */}
      <div className="flex-1 relative bg-turf overflow-hidden">
        {hasPhoto ? (
          <img
            src={slot.photo_url}
            alt={slot.player_name || 'Player'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 turf-bg">
            <User className="w-8 h-8 text-muted-foreground/40" />
            {!printMode && onCapture && (
              <button
                onClick={onCapture}
                className="flex items-center gap-1 px-2 py-1 bg-gold/20 border border-gold/40 rounded text-gold text-[10px] font-heading tracking-wide hover:bg-gold/30 transition-colors"
              >
                <Camera className="w-3 h-3" />
                CAPTURE
              </button>
            )}
          </div>
        )}

        {/* Position badge */}
        <div className={`absolute top-1 left-1 text-[8px] font-heading font-bold tracking-widest ${posColor} bg-background/70 px-1 rounded`}>
          {slot?.position?.[0] || '?'}
        </div>
      </div>

      {/* Card footer */}
      <div className="px-2 py-1.5 bg-card border-t border-gold/20">
        <p className="font-heading text-[10px] font-bold text-foreground uppercase tracking-wide truncate leading-tight">
          {slot?.player_name || 'UNNAMED'}
        </p>
        <p className="text-[8px] text-muted-foreground truncate">{teamName}</p>
        <div className="mt-0.5">
          <RarityBadge rarity={rarity} size="xs" />
        </div>
      </div>
    </div>
  );
}