import { Link, useLocation, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X, Trophy, BookOpen, Swords, BarChart2, ShieldCheck, Home, Globe, Flame } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/worlds', label: 'Worlds', icon: Globe },
  { path: '/catalogue', label: 'Catalogue', icon: BookOpen },
  { path: '/collection', label: 'My Collection', icon: Trophy },
  { path: '/matches', label: 'Matchnight', icon: Flame },
  { path: '/league', label: 'League', icon: BarChart2 },
];

export default function AppLayout({ user }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center">
              <span className="text-background font-heading font-bold text-sm">SK</span>
            </div>
            <span className="font-heading text-xl font-bold text-gold tracking-widest uppercase">SubKit</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-heading tracking-wide transition-all ${
                  location.pathname === path
                    ? 'bg-gold text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-heading tracking-wide transition-all ml-2 border border-gold/40 ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-gold text-background'
                    : 'text-gold hover:bg-gold/10'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-heading tracking-wide transition-all ${
                  location.pathname === path
                    ? 'bg-gold text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm font-heading tracking-wide text-gold hover:bg-gold/10"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Panel
              </Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground font-heading tracking-wider">
        SUBKIT &copy; {new Date().getFullYear()} — THE COLLECTOR'S PLATFORM
      </footer>
    </div>
  );
}