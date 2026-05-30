import { supabase } from '../lib/supabase';

// The species emoji the player has ever owned (persists through release / sale /
// death). Read from profiles.discovered_species, populated server-side by a
// trigger on any pet insert. Returns an empty array in local-only mode or on
// error — the Pixedex then just shows everything as undiscovered.
export const fetchDiscoveredSpecies = async (): Promise<string[]> => {
  if (!supabase) return [];
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('discovered_species')
    .eq('id', uid)
    .maybeSingle();
  if (error) {
    console.warn('[pixelpets] discovered species error:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any)?.discovered_species ?? []) as string[];
};
