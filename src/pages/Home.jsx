import { Link } from 'react-router-dom';
import { BookOpen, Trophy, Swords, BarChart2, ArrowRight, Star, Zap, Camera } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: BookOpen,
    title: 'FULL CATALOGUE',
    desc: 'Browse every Subbuteo team ever made — by era, rarity & value.',
    link: '/catalogue',
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-800/40',
  },
  {
    icon: Camera,
    title: 'SHOOT YOUR SQUAD',
    desc: 'Guided photo capture for each player. Print-ready sticker sheets.',
    link: '/collection',
    color: 'text-gold',
    bg: 'bg-gold/10 border-gold/30',
  },
  {
    icon: Swords,
    title: 'CHALLENGE',
    desc: 'Face off in async turn-by-turn matches. Stats meet the pitch.',
    link: '/matches',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-800/40',
  },
  {
    icon: BarChart2,
    title: 'LEAGUE TABLE',
    desc: 'Climb the global rankings season by season.',
    link: '/league',
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-800/40',
  },
];

const rarityInfo = [
  { tier: 'COMMON', color: 'text-muted-foreground', boost: '×1.0', bg: 'bg-secondary' },
  { tier: 'UNCOMMON', color: 'text-blue-300', boost: '×1.1', bg: 'bg-blue-900/40' },
  { tier: 'RARE', color: 'text-blue-400', boost: '×1.25', bg: 'bg-blue-900/60' },
  { tier: 'ULTRA RARE', color: 'text-gold', boost: '×1.5', bg: 'bg-gold/20' },
  { tier: 'LEGEND', color: 'text-purple-300', boost: '×2.0', bg: 'bg-purple-900/50' },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden turf-bg py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/80 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center space-y-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 mb-4">
              <Star className="w-3 h-3 text-gold" />
              <span className="text-[11px] text-gold font-heading tracking-widest uppercase">The Collector's Platform</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-black text-foreground leading-none">
              SUB<span className="text-gold">KIT</span>
            </h1>
            <p className="font-heading text-lg md:text-xl text-muted-foreground mt-3 tracking-wide uppercase">
              Collect. Photograph. Play. Compete.
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-base text-foreground/80 max-w-xl mx-auto leading-relaxed"
          >
            The ultimate Subbuteo digital companion. Build your sticker album, photograph
            your squad with guided camera tools, print collector-grade sheets, then take
            your team online in async chess-style matches where <strong className="text-gold">rarity means power</strong>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              to="/catalogue"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gold text-background font-heading font-bold tracking-widest uppercase rounded hover:bg-gold-light transition-colors text-sm"
            >
              <BookOpen className="w-4 h-4" />
              BROWSE CATALOGUE
            </Link>
            <Link
              to="/collection"
              className="flex items-center justify-center gap-2 px-6 py-3 border border-gold/40 text-gold font-heading font-bold tracking-widest uppercase rounded hover:bg-gold/10 transition-colors text-sm"
            >
              <Trophy className="w-4 h-4" />
              MY COLLECTION
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-14 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map(({ icon: Icon, title, desc, link, color, bg }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
          >
            <Link
              to={link}
              className={`group flex flex-col gap-3 rounded-xl border ${bg} p-5 hover:brightness-110 transition-all duration-200`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-6 h-6 ${color}`} />
                <ArrowRight className={`w-4 h-4 ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
              <div>
                <h3 className={`font-heading font-bold tracking-widest text-sm uppercase ${color}`}>{title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </section>

      {/* Rarity System */}
      <section className="max-w-3xl mx-auto px-4 pb-14">
        <div className="border border-border/60 rounded-xl p-6 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-gold" />
            <h2 className="font-heading font-bold text-sm tracking-widest uppercase text-gold">Rarity Boost System</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            The rarer your physical team, the stronger it is in-game. Market value and
            rarity tier set your team's power multiplier — curated by our admin team from
            real-world collector prices.
          </p>
          <div className="space-y-2">
            {rarityInfo.map(({ tier, color, boost, bg }) => (
              <div key={tier} className={`flex items-center justify-between px-3 py-2 rounded ${bg}`}>
                <span className={`font-heading text-xs font-bold tracking-widest ${color}`}>{tier}</span>
                <span className={`font-mono text-xs font-bold ${color}`}>BOOST {boost}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}