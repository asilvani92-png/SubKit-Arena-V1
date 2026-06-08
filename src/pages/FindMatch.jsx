import React, { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';

export default function FindMatch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [myCollections, setMyCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { (async () => {
    try {
      const me = (await supabase.auth.getUser()).data?.user;
      if (!me) return;
      const { data, error } = await supabase.from('UserCollection').select('*').eq('user_id', me.id).eq('is_verified', true).order('created_date', { ascending: false });
      if (!error) {
        setMyCollections(data || []);
        if ((data || []).length > 0) setSelectedCollection(data[0].id);
      }
    } catch (e) { console.warn(e); }
  })(); }, []);

  const search = async () => {
    try {
      const { data, error } = await supabase.from('users').select('id,username,display_name').ilike('username', `%${query}%`).limit(20);
      if (error) throw error;
      setResults(data || []);
    } catch (e) { console.error(e); toast.error('Search failed'); }
  };

  const sendChallenge = async (user) => {
    try {
      const me = (await supabase.auth.getUser()).data?.user;
      if (!me) { toast.error('You must be logged in'); return; }
      if (!selectedCollection) { toast.error('Select your verified team first'); return; }

      // check opponent has at least one verified collection
      const { data: oppCols, error: oppErr } = await supabase.from('UserCollection').select('*').eq('user_id', user.id).eq('is_verified', true).limit(1);
      if (oppErr) throw oppErr;
      if (!oppCols || oppCols.length === 0) { toast.error('Opponent has no verified teams'); return; }

      const awayCollectionId = oppCols[0].id;

      // create match record in pending status and include collections in board_state
      const match = { world_id: null, home_user: me.id, away_user: user.id, board_state: { home_collection_id: selectedCollection, away_collection_id: awayCollectionId }, action_log: [], current_turn: 0, status: 'pending' };
      const { data, error } = await supabase.from('matches').insert([match]).select('*');
      if (error) throw error;
      const matchId = data && data[0] && data[0].id;
      toast.success('Challenge created — navigating to arena');
      if (matchId) navigate(`/match/${matchId}/arena`);
    } catch (e) { console.error(e); toast.error('Failed to send challenge'); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-2xl text-gold mb-4">Find Opponents</h1>
      {myCollections.length > 0 ? (
        <div className="mb-4">
          <label className="text-xs text-muted-foreground block mb-1">Select your verified team</label>
          <select value={selectedCollection || ''} onChange={e => setSelectedCollection(e.target.value)} className="bg-secondary border-border p-2 rounded">
            {myCollections.map(c => <option key={c.id} value={c.id}>{c.team_name}</option>)}
          </select>
        </div>
      ) : (
        <div className="mb-4 text-sm text-muted-foreground">You have no verified teams — complete a team and submit it for verification before playing online.</div>
      )}
      <div className="flex gap-2 mb-4">
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search username" />
        <Button onClick={search} className="bg-gold">Search</Button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {results.map(u => (
          <div key={u.id} className="border border-border rounded-xl p-3 bg-card flex items-center justify-between">
            <div>
              <div className="font-heading font-bold">{u.display_name || u.username}</div>
              <div className="text-xs text-muted-foreground">{u.username}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => sendChallenge(u)}>Challenge</Button>
              <Link to={`/user/${u.id}`} className="text-sm text-gold">Profile</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
