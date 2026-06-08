import db from '../lib/db';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Link } from 'react-router-dom';
import { Camera, Printer, ChevronRight, Trophy, Plus, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RarityBadge from '@/components/cards/RarityBadge';
import PlayerSticker from '@/components/cards/PlayerSticker';
import PhotoCapture from '@/components/camera/PhotoCapture';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import supabase from '@/lib/supabaseClient';

function CollectionCard({ col, onOpen }) {
  const total = col.player_slots?.length || 0;
  const captured = col.player_slots?.filter(s => s.photo_url).length || 0;
  const pct = total > 0 ? Math.round((captured / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="border border-border rounded-xl bg-card p-4 cursor-pointer hover:border-gold/40 hover:bg-gold/5 transition-all"
      onClick={() => onOpen(col)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-sm text-foreground uppercase tracking-wide truncate">{col.team_name}</p>
          <div className="mt-1 flex items-center gap-2">
            <RarityBadge rarity={col.team_rarity || 'Common'} size="xs" />
            <span className="text-[10px] text-muted-foreground">{col.condition}</span>
          </div>
        </div>
        {col.is_complete && <CheckCircle className="w-4 h-4 text-gold flex-shrink-0" />}
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </div>
      {/* Progress */}
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground font-heading">
          <span>PHOTOS</span>
          <span>{captured} / {total}</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </motion.div>
  );
}

function TeamShootList({ col, onClose, onPhotoSaved }) {
  const [captureSlot, setCaptureSlot] = useState(null);
  const qc = useQueryClient();

  const handleCapture = async (slot_index, fileUrl) => {
    const updated = col.player_slots.map(s =>
      s.slot_index === slot_index
        ? { ...s, photo_url: fileUrl, photo_captured_at: new Date().toISOString() }
        : s
    );
    const allDone = updated.every(s => s.photo_url);
    await db.entities.UserCollection.update(col.id, {
      player_slots: updated,
      is_complete: allDone,
    });
    qc.invalidateQueries({ queryKey: ['my-collection'] });
    setCaptureSlot(null);
    toast.success('Photo saved!');
  };

  const handlePrint = () => {
    window.print();
  };

  const [submitting, setSubmitting] = useState(false);

  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleSubmitForVerification = async () => {
    if (captured !== total) { toast.error('Complete all photos before submitting'); return; }
    setSubmitting(true);
    try {
      // upload each photo to Supabase Storage
      const photo_urls = [];
      for (const slot of col.player_slots) {
        const url = slot.photo_url;
        if (!url) continue;
        // If it's already a hosted URL, leave it
        if (url.startsWith('http')) { photo_urls.push(url); continue; }
        const file = dataURLtoFile(url, `collection_${col.id}_slot_${slot.slot_index}.jpg`);
        const path = `player-photos/${col.id}/slot_${slot.slot_index}.jpg`;
        const { data, error } = await supabase.storage.from('player-photos').upload(path, file, { upsert: true });
        if (error) throw error;
        const { publicURL } = supabase.storage.from('player-photos').getPublicUrl(path);
        photo_urls.push(publicURL);
      }

      // create verification row
      const { data: vdata, error } = await supabase.from('team_verifications').insert([{ collection_id: col.id, user_id: col.user_id || null, team_name: col.team_name, status: 'pending', photo_urls }]).select('*');
      if (error) throw error;
      toast.success('Submitted for verification — admin will review within 24h');
      // invalidate collection list
      qc.invalidateQueries({ queryKey: ['my-collection'] });
      // try to invoke edge function to notify admin (optional)
      try {
        if (supabase.functions) {
          const vid = (vdata && vdata[0] && vdata[0].id) || null;
          if (vid) {
            await supabase.functions.invoke('verify-team', { body: { verification_id: vid } });
          }
        }
      } catch (e) {
        // ignore function invocation errors
        console.warn('Edge function invoke failed', e);
      }
    } catch (e) {
      console.error(e);
      toast.error('Submission failed');
    }
    setSubmitting(false);
  };

  const captured = col.player_slots?.filter(s => s.photo_url).length || 0;
  const total = col.player_slots?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      {captureSlot && (
        <PhotoCapture
          slot={captureSlot}
          onCapture={(url) => handleCapture(captureSlot.slot_index, url)}
          onClose={() => setCaptureSlot(null)}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 no-print">
          <div>
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground font-heading tracking-wide mb-1">← BACK</button>
            <h2 className="font-heading text-2xl font-bold text-gold uppercase tracking-wider">{col.team_name}</h2>
            <p className="text-sm text-muted-foreground">{captured}/{total} players photographed</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="border-gold/40 text-gold hover:bg-gold/10 font-heading tracking-wide text-xs">
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              PRINT SHEET
            </Button>
            {captured === total && !col.is_verified && (
              <Button onClick={handleSubmitForVerification} disabled={submitting} className="bg-gold text-background font-heading tracking-widest text-xs">
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                {submitting ? 'SUBMITTING...' : 'SUBMIT FOR VERIFICATION'}
              </Button>
            )}
          </div>
        </div>

        {/* Sticker Grid — 5 columns like a Panini album */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sticker-sheet">
          {(col.player_slots || []).map((slot) => (
            <PlayerSticker
              key={slot.slot_index}
              slot={slot}
              rarity={col.team_rarity || 'Common'}
              teamName={col.team_name}
              onCapture={() => setCaptureSlot(slot)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Collection() {
  const [openCol, setOpenCol] = useState(null);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['my-collection'],
    queryFn: () => db.entities.UserCollection.list('-created_date', 100),
  });

  if (openCol) {
    return (
      <TeamShootList
        col={openCol}
        onClose={() => setOpenCol(null)}
        onPhotoSaved={() => {}}
      />
    );
  }

  const complete = collections.filter(c => c.is_complete).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gold tracking-widest uppercase">My Collection</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {collections.length} teams · {complete} complete
          </p>
        </div>
        <Link
          to="/catalogue"
          className="flex items-center gap-1.5 text-xs text-gold font-heading tracking-wide border border-gold/30 px-3 py-1.5 rounded hover:bg-gold/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          ADD TEAM
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-28 rounded-xl bg-secondary animate-pulse" />)}
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="font-heading tracking-wide text-muted-foreground">Your collection is empty</p>
          <Link to="/catalogue">
            <Button className="bg-gold text-background font-heading tracking-widest hover:bg-gold-light">
              BROWSE CATALOGUE
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <AnimatePresence>
            {collections.map(col => (
              <CollectionCard key={col.id} col={col} onOpen={setOpenCol} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}