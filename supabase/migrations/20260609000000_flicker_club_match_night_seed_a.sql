-- Flicker Club Match Night - PART 4: House team seed (1 of 2)
-- Run after part3 in the same SQL editor.

INSERT INTO public.teams (id, name, ref_number, country, era, manufacturer, rarity, base_rating, primary_colour, secondary_colour, is_house_team, ai_difficulty_tier) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Brazil 1970', '003', 'Brazil', '1966-1975', 'Subbuteo', 'Legend', 92, '#f5c518', '#006400', true, 3),
  ('00000000-0000-0000-0000-000000000002', 'Juventus 1985', '056', 'Italy', '1976-1985', 'Subbuteo', 'Ultra Rare', 86, '#000000', '#ffffff', true, 3),
  ('00000000-0000-0000-0000-000000000003', 'England 1990', '001', 'England', '1986-1995', 'Subbuteo', 'Rare', 80, '#ffffff', '#c8102e', true, 2),
  ('00000000-0000-0000-0000-000000000004', 'AC Milan 1989', '061', 'Italy', '1976-1985', 'Subbuteo', 'Rare', 88, '#000000', '#c8102e', true, 3),
  ('00000000-0000-0000-0000-000000000005', 'West Germany 1974', '007', 'Germany', '1966-1975', 'Subbuteo', 'Uncommon', 85, '#ffffff', '#000000', true, 2),
  ('00000000-0000-0000-0000-000000000006', 'Argentina 1986', '009', 'Argentina', '1976-1985', 'Subbuteo', 'Uncommon', 83, '#75aadb', '#ffffff', true, 2),
  ('00000000-0000-0000-0000-000000000007', 'France 1998', '012', 'France', '1996-2005', 'Subbuteo', 'Uncommon', 84, '#002395', '#ffffff', true, 2),
  ('00000000-0000-0000-0000-000000000008', 'Netherlands 1988', '015', 'Netherlands', '1976-1985', 'Subbuteo', 'Uncommon', 82, '#ff6600', '#ffffff', true, 2),
  ('00000000-0000-0000-0000-000000000009', 'Manchester United 1999', '102', 'England', '1996-2005', 'Subbuteo', 'Rare', 87, '#c8102e', '#ffffff', true, 3),
  ('00000000-0000-0000-0000-000000000010', 'Liverpool 1984', '104', 'England', '1976-1985', 'Subbuteo', 'Rare', 85, '#c8102e', '#f5c518', true, 2)
ON CONFLICT (id) DO NOTHING;
