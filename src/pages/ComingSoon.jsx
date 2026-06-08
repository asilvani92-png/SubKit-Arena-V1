import { motion } from 'framer-motion';
import { Zap, Flame } from 'lucide-react';

export default function ComingSoon({ title = 'Matchnight', subtitle = 'This feature is coming soon!' }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-3"
        >
          <div className="flex justify-center">
            <div className="relative">
              <Flame className="w-16 h-16 text-gold animate-pulse" />
              <Zap className="w-8 h-8 text-gold absolute top-2 right-0 animate-bounce" />
            </div>
          </div>

          <h1 className="font-display text-4xl font-black text-foreground">
            {title}
          </h1>
          <p className="text-lg text-muted-foreground font-heading tracking-wide uppercase">
            {subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <p className="text-foreground/70 leading-relaxed">
            We're building the ultimate competitive experience. Async turn-by-turn matches,
            rarity-based power systems, and seasonal rankings are all in development.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-gold/10 border border-gold/30">
              <p className="text-xs font-heading text-gold tracking-widest uppercase font-bold">Matches</p>
              <p className="text-[10px] text-muted-foreground mt-1">Turn-based gameplay</p>
            </div>
            <div className="p-3 rounded-lg bg-gold/10 border border-gold/30">
              <p className="text-xs font-heading text-gold tracking-widest uppercase font-bold">Stats</p>
              <p className="text-[10px] text-muted-foreground mt-1">Live rankings</p>
            </div>
            <div className="p-3 rounded-lg bg-gold/10 border border-gold/30">
              <p className="text-xs font-heading text-gold tracking-widest uppercase font-bold">Boosts</p>
              <p className="text-[10px] text-muted-foreground mt-1">Rarity powers</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 font-heading">
            In the meantime, build your collection and prepare your squad.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
