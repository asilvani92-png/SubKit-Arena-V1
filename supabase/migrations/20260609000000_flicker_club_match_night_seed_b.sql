-- Flicker Club Match Night - PART 5: House team seed (2 of 2)
-- Run after seed_a in the same SQL editor.

INSERT INTO public.teams (id, name, ref_number, country, era, manufacturer, rarity, base_rating, primary_colour, secondary_colour, is_house_team, ai_difficulty_tier) VALUES
  ('00000000-0000-0000-0000-000000000011', 'Barcelona 2009', '131', 'Spain', 'Modern 2000s', 'Subbuteo', 'Uncommon', 86, '#a50044', '#004d9e', true, 3),
  ('00000000-0000-0000-0000-000000000012', 'Real Madrid 1960', '132', 'Spain', '1966-1975', 'Subbuteo', 'Common', 90, '#ffffff', '#f5c518', true, 3),
  ('00000000-0000-0000-0000-000000000013', 'Celtic 1967', '201', 'Scotland', '1966-1975', 'Subbuteo', 'Common', 78, '#009a44', '#ffffff', true, 1),
  ('00000000-0000-0000-0000-000000000014', 'Borussia Dortmund 1997', '141', 'Germany', '1996-2005', 'Subbuteo', 'Common', 80, '#f5c518', '#000000', true, 2),
  ('00000000-0000-0000-0000-000000000015', 'Ajax 1971', '161', 'Netherlands', '1966-1975', 'Subbuteo', 'Common', 82, '#c8102e', '#ffffff', true, 2),
  ('00000000-0000-0000-0000-000000000016', 'Inter Milan 2010', '062', 'Italy', 'Modern 2000s', 'Subbuteo', 'Common', 83, '#000000', '#0046ad', true, 2),
  ('00000000-0000-0000-0000-000000000017', 'Scotland 1982', '005', 'Scotland', '1976-1985', 'Subbuteo', 'Common', 72, '#003d88', '#ffffff', true, 1),
  ('00000000-0000-0000-0000-000000000018', 'Wales 1976', '006', 'Wales', '1966-1975', 'Subbuteo', 'Common', 68, '#c8102e', '#ffffff', true, 1),
  ('00000000-0000-0000-0000-000000000019', 'Ireland 1994', '008', 'Ireland', '1986-1995', 'Subbuteo', 'Common', 70, '#009a44', '#ffffff', true, 1),
  ('00000000-0000-0000-0000-000000000020', 'Porto 2004', '181', 'Portugal', 'Modern 2000s', 'Subbuteo', 'Common', 78, '#0046ad', '#ffffff', true, 1)
ON CONFLICT (id) DO NOTHING;
