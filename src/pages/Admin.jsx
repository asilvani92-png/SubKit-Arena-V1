import db from '../lib/db';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, Plus, Pencil, Save, Search, Trash2, AlertTriangle } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import RarityBadge from '@/components/cards/RarityBadge';
import { toast } from 'sonner';

const ERAS = ['Heavyweight 1960s', 'Heavyweight 1970s', 'Lightweight 1970s', 'Lightweight 1980s', 'Lightweight 1990s', 'Modern 2000s', 'Modern 2010s', 'Modern 2020s', 'Special Edition', 'Unknown'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legend'];
const BRANDS = ['Subbuteo', 'Zeugo', 'Astrobase', 'Newfooty', 'Top Spin', 'Other'];

const EMPTY_TEAM = {
  name: '', ref_number: '', era: 'Lightweight 1980s', country: '', kit_description: '',
  player_count: 11, rarity: 'Common', market_value_gbp: 0, boost_modifier: 1.0,
  image_url: '', brand: 'Subbuteo', notes: '', is_published: true,
};

function TeamForm({ team, onSave, onCancel }) {
  const [form, setForm] = useState(team || EMPTY_TEAM);
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name) { toast.error('Team name required'); return; }
    setSaving(true);
    try {
      if (team?.id) {
        await db.entities.SubbuteoTeam.update(team.id, form);
        toast.success('Team updated');
      } else {
        await db.entities.SubbuteoTeam.create(form);
        toast.success('Team created');
      }
      onSave();
    } catch (e) {
      toast.error('Save failed');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">TEAM NAME *</label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} className="bg-secondary border-border text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">REF NUMBER</label>
          <Input value={form.ref_number} onChange={e => set('ref_number', e.target.value)} className="bg-secondary border-border text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">ERA</label>
          <Select value={form.era} onValueChange={v => set('era', v)}>
            <SelectTrigger className="bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{ERAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">BRAND</label>
          <Select value={form.brand} onValueChange={v => set('brand', v)}>
            <SelectTrigger className="bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">RARITY</label>
          <Select value={form.rarity} onValueChange={v => set('rarity', v)}>
            <SelectTrigger className="bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{RARITIES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">MARKET VALUE (£)</label>
          <Input type="number" value={form.market_value_gbp} onChange={e => set('market_value_gbp', parseFloat(e.target.value))} className="bg-secondary border-border text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">BOOST MODIFIER</label>
          <Input type="number" step="0.05" min="1" max="3" value={form.boost_modifier} onChange={e => set('boost_modifier', parseFloat(e.target.value))} className="bg-secondary border-border text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">PLAYER COUNT</label>
          <Input type="number" min="1" max="20" value={form.player_count} onChange={e => set('player_count', parseInt(e.target.value))} className="bg-secondary border-border text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">COUNTRY</label>
          <Input value={form.country} onChange={e => set('country', e.target.value)} className="bg-secondary border-border text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">PUBLISHED</label>
          <Select value={form.is_published ? 'yes' : 'no'} onValueChange={v => set('is_published', v === 'yes')}>
            <SelectTrigger className="bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes — visible</SelectItem>
              <SelectItem value="no">No — hidden</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Verification Queue */}
      <div className="mt-8 border border-border rounded-xl p-4 bg-card">
        <h2 className="font-heading text-lg text-gold mb-3">Team Verification Queue</h2>
        <p className="text-sm text-muted-foreground mb-3">Review teams submitted by users for online play. Approve to allow matches, or reject with a reason.</p>
        <div>
          <Button onClick={async () => {
            try {
              const { data, error } = await supabase.from('team_verifications').select('*').eq('status', 'pending').order('submitted_at', { ascending: false });
              if (error) throw error;
              setVerifications(data || []);
            } catch (e) { console.error(e); toast.error('Failed to load queue'); }
          }} className="mb-3">Load Queue</Button>

          {verifications.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending verifications loaded.</div>
          ) : (
            <div className="divide-y divide-border max-h-[40vh] overflow-y-auto">
              {verifications.map(v => (
                <div key={v.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-heading text-sm font-bold">{v.team_name}</p>
                    <p className="text-[11px] text-muted-foreground">Submitted: {new Date(v.submitted_at).toLocaleString()}</p>
                    <div className="mt-2 flex gap-2">
                      {(v.photo_urls || []).slice(0,6).map((p,i) => <img key={i} src={p} className="w-20 h-20 object-cover rounded" alt="player" />)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={async () => {
                      try {
                        const { error } = await supabase.from('team_verifications').update({ status: 'approved', reviewed_by: me?.id, reviewed_at: new Date().toISOString() }).eq('id', v.id);
                        if (error) throw error;
                        // mark the user collection as verified
                        if (v.collection_id) {
                          const { error: uerr } = await supabase.from('UserCollection').update({ is_verified: true }).eq('id', v.collection_id);
                          if (uerr) console.warn('Failed to mark collection verified', uerr);
                        }
                        toast.success('Approved');
                      } catch (e) { console.error(e); toast.error('Approve failed'); }
                    }} className="bg-gold text-background">Approve</Button>

                    <Button onClick={async () => {
                      const reason = prompt('Reason for rejection (optional)');
                      try {
                        const { error } = await supabase.from('team_verifications').update({ status: 'rejected', reviewed_by: me?.id, reviewed_at: new Date().toISOString(), rejection_reason: reason }).eq('id', v.id);
                        if (error) throw error;
                        toast.success('Rejected');
                      } catch (e) { console.error(e); toast.error('Reject failed'); }
                    }} variant="outline">Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">KIT DESCRIPTION</label>
        <Input value={form.kit_description} onChange={e => set('kit_description', e.target.value)} className="bg-secondary border-border text-sm" />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">IMAGE URL</label>
        <Input value={form.image_url} onChange={e => set('image_url', e.target.value)} className="bg-secondary border-border text-sm" placeholder="https://..." />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground font-heading tracking-wide block mb-1">ADMIN NOTES</label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="bg-secondary border-border text-sm h-20" />
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 border-border font-heading tracking-wide text-xs">CANCEL</Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gold text-background font-heading tracking-widest text-xs hover:bg-gold-light">
          {saving ? 'SAVING...' : <><Save className="w-3.5 h-3.5 mr-1" />SAVE</>}
        </Button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [search, setSearch] = useState('');
  const [editTeam, setEditTeam] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [appSettings, setAppSettings] = useState({});
  const qc = useQueryClient();
  const [verifications, setVerifications] = useState([]);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['admin-teams'],
    queryFn: () => db.entities.SubbuteoTeam.list('name', 500),
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });

  if (me && me.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-red-trim mx-auto" />
        <h2 className="font-heading text-xl text-red-trim uppercase tracking-widest">Access Denied</h2>
        <p className="text-muted-foreground text-sm">Admin role required.</p>
      </div>
    );
  }

  useEffect(() => {
    // load app settings from Supabase
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('app_settings').select('*').eq('id', 'singleton').limit(1).single();
        if (!error && data && mounted) {
          setAppSettings(data);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false };
  }, []);

  const filtered = teams.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.ref_number?.includes(search)
  );

  const afterSave = () => {
    setEditTeam(null);
    setCreateOpen(false);
    qc.invalidateQueries({ queryKey: ['admin-teams'] });
    qc.invalidateQueries({ queryKey: ['catalogue'] });
  };

  const handleDelete = async (team) => {
    if (!confirm(`Delete "${team.name}"? This cannot be undone.`)) return;
    await db.entities.SubbuteoTeam.delete(team.id);
    qc.invalidateQueries({ queryKey: ['admin-teams'] });
    toast.success('Team deleted');
  };

  const stats = {
    total: teams.length,
    published: teams.filter(t => t.is_published).length,
    legend: teams.filter(t => t.rarity === 'Legend').length,
    ultraRare: teams.filter(t => t.rarity === 'Ultra Rare').length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gold" />
          <h1 className="font-heading text-2xl font-bold text-gold tracking-widest uppercase">Admin Panel</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-gold text-background font-heading text-xs tracking-widest hover:bg-gold-light">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          ADD TEAM
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'TOTAL TEAMS', val: stats.total },
          { label: 'PUBLISHED', val: stats.published },
          { label: 'ULTRA RARE', val: stats.ultraRare },
          { label: 'LEGEND', val: stats.legend },
        ].map(({ label, val }) => (
          <div key={label} className="border border-border rounded-lg p-3 bg-card text-center">
            <p className="font-heading text-2xl font-bold text-gold">{val}</p>
            <p className="text-[10px] text-muted-foreground font-heading tracking-widest mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-secondary border-border"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="grid grid-cols-[1fr_5rem_7rem_4rem_4rem_5rem_5.5rem] gap-2 px-4 py-2 bg-secondary text-[10px] text-muted-foreground font-heading tracking-widest uppercase border-b border-border">
          <div>Name</div>
          <div>Ref</div>
          <div>Era</div>
          <div className="text-right">Players</div>
          <div className="text-right">Value</div>
          <div className="text-center">Rarity</div>
          <div className="text-center">Actions</div>
        </div>

        {isLoading ? (
          Array(10).fill(0).map((_, i) => <div key={i} className="h-12 border-b border-border bg-secondary/30 animate-pulse" />)
        ) : (
          <div className="divide-y divide-border/60 max-h-[60vh] overflow-y-auto">
            {filtered.map(team => (
              <div key={team.id} className={`grid grid-cols-[1fr_5rem_7rem_4rem_4rem_5rem_5.5rem] gap-2 items-center px-4 py-2.5 hover:bg-secondary/40 transition-colors ${!team.is_published ? 'opacity-50' : ''}`}>
                <div>
                  <p className="font-heading text-xs font-bold text-foreground truncate">{team.name}</p>
                  <p className="text-[9px] text-muted-foreground">{team.brand}</p>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">{team.ref_number || '—'}</div>
                <div className="text-[10px] text-muted-foreground truncate">{team.era}</div>
                <div className="text-right text-xs font-mono text-foreground">{team.player_count}</div>
                <div className="text-right text-xs font-mono text-gold">£{team.market_value_gbp || 0}</div>
                <div className="flex justify-center"><RarityBadge rarity={team.rarity} size="xs" /></div>
                <div className="flex items-center justify-center gap-1.5">
                  <button onClick={() => setEditTeam(team)} className="p-1 text-muted-foreground hover:text-gold transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(team)} className="p-1 text-muted-foreground hover:text-red-trim transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTeam} onOpenChange={() => setEditTeam(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-gold tracking-widest uppercase text-sm">Edit Team</DialogTitle>
          </DialogHeader>
          {editTeam && <TeamForm team={editTeam} onSave={afterSave} onCancel={() => setEditTeam(null)} />}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-gold tracking-widest uppercase text-sm">Add New Team</DialogTitle>
          </DialogHeader>
          <TeamForm onSave={afterSave} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Supabase setup & app settings */}
      <div className="mt-8 border border-border rounded-xl p-4 bg-card">
        <h2 className="font-heading text-lg text-gold mb-2">Supabase Setup & App Settings</h2>
        <p className="text-sm text-muted-foreground mb-3">We recommend Supabase as the free backend for SubKit. Follow <a className="text-gold underline" href="/docs/supabase-setup.md">the setup guide</a> to create a project, run the SQL schema, and configure environment variables.</p>
        <div className="text-sm text-muted-foreground mb-3">
          <strong>Quick steps:</strong>
          <ul className="list-disc pl-5 mt-2">
            <li>Create a free Supabase project at <a className="text-gold underline" href="https://supabase.com">supabase.com</a> (free tier available).</li>
            <li>Open SQL editor and run <code>supabase/schema.sql</code> from this repo to create tables.</li>
            <li>Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` and restart the app.</li>
            <li>Configure Storage bucket `player-photos` and SMTP for email delivery (Sendinblue/Mailgun/SendGrid free tiers).</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Admin verification email</label>
            <Input value={appSettings.admin_email || ''} onChange={e => setAppSettings(s => ({ ...s, admin_email: e.target.value }))} className="bg-secondary border-border text-sm" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Verification turnaround (hours)</label>
            <Input type="number" value={appSettings.verification_turnaround_hours || 24} onChange={e => setAppSettings(s => ({ ...s, verification_turnaround_hours: parseInt(e.target.value || '24') }))} className="bg-secondary border-border text-sm" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Points multiplier</label>
            <Input type="number" step="0.1" value={appSettings.points_multiplier || 1.0} onChange={e => setAppSettings(s => ({ ...s, points_multiplier: parseFloat(e.target.value || '1') }))} className="bg-secondary border-border text-sm" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={async () => {
            // Save to Supabase app_settings (singleton id = 'singleton')
            try {
              const { data, error } = await supabase.from('app_settings').upsert([{ id: 'singleton', ...appSettings }], { returning: 'representation' });
              if (error) throw error;
              toast.success('Settings saved');
            } catch (e) {
              console.error(e);
              toast.error('Failed to save settings');
            }
          }} className="bg-gold text-background">Save Settings</Button>

          <Button onClick={async () => {
            // Test Supabase connection by reading users table
            try {
              const { data, error } = await supabase.from('users').select('id').limit(1);
              if (error) throw error;
              toast.success('Supabase connection OK');
            } catch (e) {
              console.error(e);
              toast.error('Supabase test failed — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
            }
          }} variant="outline">Test Connection</Button>
        </div>
      </div>
    </div>
  );
}