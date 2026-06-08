import db from '../lib/db';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, SlidersHorizontal, Plus, Check } from 'lucide-react';
import TeamCard from '@/components/cards/TeamCard';
import RarityBadge from '@/components/cards/RarityBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const ERAS = ['All', 'Heavyweight 1960s', 'Heavyweight 1970s', 'Lightweight 1970s', 'Lightweight 1980s', 'Lightweight 1990s', 'Modern 2000s', 'Modern 2010s', 'Modern 2020s', 'Special Edition'];
const RARITIES = ['All', 'Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legend'];

export default function Catalogue() {
  const [search, setSearch] = useState('');
  const [era, setEra] = useState('All');
  const [rarity, setRarity] = useState('All');
  const [addingId, setAddingId] = useState(null);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => db.entities.SubbuteoTeam.filter({ is_published: true }, 'name', 200),
  });

  const { data: myCollections = [], refetch: refetchCollection } = useQuery({
    queryKey: ['my-collection-ids'],
    queryFn: () => db.entities.UserCollection.list('team_name', 200),
  });

  const ownedIds = new Set(myCollections.map(c => c.team_id));

  const filtered = teams.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.ref_number?.includes(search);
    const matchEra = era === 'All' || t.era === era;
    const matchRarity = rarity === 'All' || t.rarity === rarity;
    return matchSearch && matchEra && matchRarity;
  });

  const handleAddToCollection = async (team) => {
    if (ownedIds.has(team.id)) return;
    setAddingId(team.id);
    try {
      const slots = Array.from({ length: team.player_count || 11 }, (_, i) => ({
        slot_index: i,
        position: i === 0 ? 'Goalkeeper' : i <= 4 ? 'Defender' : i <= 7 ? 'Midfielder' : 'Forward',
        player_name: '',
        photo_url: null,
      }));
      await db.entities.UserCollection.create({
        team_id: team.id,
        team_name: team.name,
        team_rarity: team.rarity,
        condition: 'Good',
        is_complete: false,
        player_slots: slots,
      });
      await refetchCollection();
      toast.success(`${team.name} added to your collection!`);
    } catch (e) {
      toast.error('Failed to add team');
    }
    setAddingId(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-gold tracking-widest uppercase">Catalogue</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {teams.length.toLocaleString()} teams documented — browse by era, rarity & value
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search teams or ref number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <Select value={era} onValueChange={setEra}>
          <SelectTrigger className="w-full sm:w-48 bg-secondary border-border">
            <SelectValue placeholder="Era" />
          </SelectTrigger>
          <SelectContent>
            {ERAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={rarity} onValueChange={setRarity}>
          <SelectTrigger className="w-full sm:w-40 bg-secondary border-border">
            <SelectValue placeholder="Rarity" />
          </SelectTrigger>
          <SelectContent>
            {RARITIES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground font-heading tracking-wide">
        <Filter className="w-3 h-3" />
        <span>{filtered.length} teams</span>
        {(search || era !== 'All' || rarity !== 'All') && (
          <button
            onClick={() => { setSearch(''); setEra('All'); setRarity('All'); }}
            className="text-gold hover:underline ml-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array(12).fill(0).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <SlidersHorizontal className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-heading tracking-wide">No teams match your filters</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((team, i) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="relative"
              >
                <TeamCard team={team} owned={ownedIds.has(team.id)} />
                <div className="absolute bottom-3 right-3">
                  {ownedIds.has(team.id) ? (
                    <span className="flex items-center gap-1 text-[10px] text-gold font-heading bg-gold/10 border border-gold/30 rounded px-1.5 py-0.5">
                      <Check className="w-3 h-3" /> OWNED
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddToCollection(team)}
                      disabled={addingId === team.id}
                      className="flex items-center gap-1 text-[10px] font-heading bg-gold/20 border border-gold/40 text-gold rounded px-1.5 py-0.5 hover:bg-gold/30 transition-colors disabled:opacity-50"
                    >
                      {addingId === team.id ? (
                        <span className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      ADD
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}