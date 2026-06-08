import React, { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Worlds() {
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('worlds').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setWorlds(data || []);
    } catch (e) { console.warn(e); toast.error('Failed to load worlds'); }
    setLoading(false);
  };

  const createWorld = async () => {
    if (!name) { toast.error('Name required'); return; }
    try {
      const { data, error } = await supabase.from('worlds').insert([{ name, description: '', type: 'user_created', is_joinable: true }]).select('*');
      if (error) throw error;
      toast.success('World created');
      setName('');
      load();
    } catch (e) { console.error(e); toast.error('Create failed'); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-2xl text-gold mb-4">Worlds</h1>
      <div className="mb-4 flex gap-2">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Create a new world" />
        <Button onClick={createWorld} className="bg-gold">Create</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {loading ? <div>Loading...</div> : worlds.map(w => (
          <div key={w.id} className="border border-border rounded-xl p-3 bg-card">
            <h3 className="font-heading text-sm font-bold">{w.name}</h3>
            <p className="text-xs text-muted-foreground mb-2">{w.description}</p>
            <div className="flex gap-2">
              <Button onClick={async () => {
                try {
                  await supabase.from('world_memberships').insert([{ world_id: w.id, user_id: (await supabase.auth.getUser()).data?.user?.id || null }]);
                  toast.success('Joined world');
                } catch (e) { console.error(e); toast.error('Join failed'); }
              }}>Join</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
