// Run with: node scripts/seed-test-team.js <user-id>
// Creates a test team for the given user ID to test matches without photo verification

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function seedTestTeam(userId) {
  if (!userId) {
    console.error('Usage: node scripts/seed-test-team.js <user-id>');
    process.exit(1);
  }

  const slots = Array.from({ length: 11 }, (_, i) => ({
    slot_index: i,
    position: i === 0 ? 'Goalkeeper' : i <= 4 ? 'Defender' : i <= 7 ? 'Midfielder' : 'Forward',
    player_name: `Player ${i + 1}`,
    photo_url: `https://placehold.co/100x100/3b82f6/white?text=${i + 1}`,
    photo_captured_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase.from('collections').insert({
    user_id: userId,
    team_name: 'Test Team',
    team_rarity: 'Common',
    condition: 'Good',
    is_complete: true,
    is_verified: true,
    player_slots: slots,
  }).select('*').single();

  if (error) {
    console.error('Error creating test team:', error);
    process.exit(1);
  }

  console.log('Created test team:', data);
  console.log('You can now start matches at /matches');
}

seedTestTeam(process.argv[2]);