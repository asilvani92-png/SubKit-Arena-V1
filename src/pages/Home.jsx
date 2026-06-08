import { Link } from 'react-router-dom';
import { BookOpen, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <section className="turf-bg min-h-[calc(100vh-7.5rem)] flex items-center justify-center px-4 py-16">
      <div className="max-w-3xl mx-auto text-center space-y-7 [text-shadow:_0_3px_18px_rgb(0_0_0_/_0.8)]">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="font-heading text-xs md:text-sm text-gold font-bold tracking-[0.35em] uppercase mb-4">
            The Collector's Platform
          </p>
          <h1 className="font-display text-6xl md:text-8xl font-black text-foreground leading-none">
            SUB<span className="text-gold">KIT</span>
          </h1>
          <p className="font-heading text-lg md:text-2xl text-foreground mt-4 tracking-wide uppercase">
            Collect. Photograph. Play. Compete.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-base md:text-lg text-foreground/90 max-w-2xl mx-auto leading-relaxed"
        >
          Build your Subbuteo catalogue, photograph your squad, print collector-grade
          sticker sheets, and take your teams into matchnight.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center [text-shadow:none]"
        >
          <Link
            to="/catalogue"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gold text-background font-heading font-bold tracking-widest uppercase rounded hover:bg-gold-light transition-colors text-sm"
          >
            <BookOpen className="w-4 h-4" />
            Browse Catalogue
          </Link>
          <Link
            to="/collection"
            className="flex items-center justify-center gap-2 px-6 py-3 border border-gold/70 text-gold font-heading font-bold tracking-widest uppercase rounded hover:bg-gold/10 transition-colors text-sm"
          >
            <Trophy className="w-4 h-4" />
            My Collection
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
