import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Bot, Users, Plus } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import HOUSE_TEAMS from '@/data/house-teams.json';

export default function Matches() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: cols } = await supabase
          .from('UserCollection')
          .select('*')
          .eq('user_id', user.id)
          .order('created_date', { ascending: false });
        if (cols) setCollections(cols);

        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .eq('home_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        if (matches) setRecentMatches(matches);
      } catch (e) { console.warn(e); }
      setLoading(false);
    })();
  }, [user]);

  const startAIMatch = async () => {
    if (!user || collections.length === 0) return;
    try {
      const collection = collections[0];
      const houseTeam = HOUSE_TEAMS[Math.floor(Math.random() * HOUSE_TEAMS.length)];

      const match = {
        home_user_id: user.id,
        home_collection_id: collection.id,
        home_team_name: collection.team_name,
        away_team_name: houseTeam.name,
        match_type: 'ai',
        status: 'pending',
        is_ai_match: true,
        home_formation: '4-4-2',
        away_formation: '4-4-2',
        home_tactic: 'balanced',
        away_tactic: 'balanced',
        home_ap_remaining: 8,
        away_ap_remaining: 8,
        action_log: [],
      };

      const { data, error } = await supabase.from('matches').insert([match]).select('*');
      if (error) throw error;
      if (data && data[0]) {
        navigate(`/match/${data[0].id}/arena`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startFriendly = async () => {
    navigate('/find');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-secondary rounded" />
          <div className="h-32 bg-secondary rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gold tracking-widest uppercase flex items-center gap-2">
            <Flame className="w-5 h-5" />
            Matchnight
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Flicker Club Match Night</p>
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-heading text-muted-foreground mb-2">You need a verified team to play</p>
          <p className="text-xs text-muted-foreground/60 mb-6">Add a Subbuteo team to your collection and complete the photo verification process.</p>
          <button
            onClick={() => navigate('/catalogue')}
            className="px-4 py-2 bg-gold text-background font-heading text-xs tracking-widest rounded hover:bg-gold-light transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Browse Catalogue
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* AI Match */}
          <button
            onClick={startAIMatch}
            className="bg-card border border-border hover:border-gold/40 rounded-xl p-6 text-left transition-all group"
          >
            <Bot className="w-8 h-8 text-gold mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-heading font-bold text-sm mb-1">Quick AI Match</h3>
            <p className="text-xs text-muted-foreground">
              Play against one of {HOUSE_TEAMS.length} classic house teams. No waiting.
            </p>
            <p className="text-[10px] text-gold mt-2 font-heading">
              Using: {collections[0]?.team_name || 'Your team'}
            </p>
          </button>

          {/* Friendly / Ranked */}
          <button
            onClick={startFriendly}
            className="bg-card border border-border hover:border-gold/40 rounded-xl p-6 text-left transition-all group"
          >
            <Users className="w-8 h-8 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-heading font-bold text-sm mb-1">Challenge a Player</h3>
            <p className="text-xs text-muted-foreground">
              Find opponents, send challenges, and play ranked or friendly matches.
            </p>
            <p className="text-[10px] text-blue-400 mt-2 font-heading">
              {collections.length} team{collections.length !== 1 ? 's' : ''} available
            </p>
          </button>
        </div>
      )}

      {/* Recent matches */}
      {recentMatches.length > 0 && (
        <div>
          <h3 className="font-heading text-xs tracking-widest text-muted-foreground uppercase mb-3">Recent Matches</h3>
          <div className="space-y-2">
            {recentMatches.map((m) => (
              <div
                key={m.id}
                className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-heading text-xs font-bold">{m.home_team_name || 'Home'}</span>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <span className="font-heading text-xs font-bold">{m.away_team_name || 'Away'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-sm font-black">
                    {m.home_score ?? '?'} — {m.away_score ?? '?'}
                  </span>
                  {m.status === 'pending' && (
                    <button
                      onClick={() => navigate(`/match/${m.id}/arena`)}
                      className="text-[9px] px-2 py-1 bg-gold text-background rounded font-heading tracking-wider"
                    >
                      Resume
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
