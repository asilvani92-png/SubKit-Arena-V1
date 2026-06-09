import { useRef, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';

export default function CommentaryFeed({ events = [] }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="w-full bg-card/80 rounded-lg border border-border/60 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-muted/30">
        <MessageCircle className="w-3 h-3 text-gold" />
        <span className="font-heading text-[10px] tracking-widest text-muted-foreground uppercase">Commentary</span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-y-auto h-40 md:h-56 px-3 py-2 space-y-1"
        style={{ scrollBehavior: 'smooth' }}
      >
        {events.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">Match about to begin...</p>
        )}
        {events.map((ev, i) => (
          <p
            key={i}
            className={
              ev.eventType === 'goal' ? 'text-gold font-bold' :
              ev.eventType === 'yellow_card' || ev.eventType === 'red_card' ? 'text-yellow-400' :
              ev.team === 'home' ? 'text-blue-300' :
              ev.team === 'away' ? 'text-red-300' :
              'text-muted-foreground'
            }
          >
            {ev.commentary || `${ev.minute || '?'}' - ${ev.eventType}`}
          </p>
        ))}
      </div>
    </div>
  );
}
