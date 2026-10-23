insert into public.challenges (name, instructions, enabled) values
  ('No-HUD Run', 'Complete a short section of a game with the heads-up display hidden or disabled.', true),
  ('One-Life Challenge', 'Play for the round without using a continue or restarting after a loss.', true),
  ('Random Loadout', 'Use a randomly selected weapon, character, or equipment setup for one match.', true),
  ('Speedrun Sprint', 'Complete a familiar level or objective as quickly as possible.', true),
  ('Blind Controls', 'Ask another player to choose your controls or key bindings for one short round.', true),
  ('Pacifist Attempt', 'Complete a suitable objective while avoiding optional combat.', true),
  ('Mirror Match', 'Use the same character, class, or loadout as your opponent for one round.', true),
  ('Low-Level Victory', 'Attempt a suitable objective while avoiding optional upgrades or levels.', true)
on conflict (name) do nothing;
