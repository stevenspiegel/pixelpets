import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Token bundles. DISPLAY ONLY — price and token amounts are enforced server-side
// in the create-checkout Edge Function (BUNDLES there is the source of truth).
// Keep the ids/values in sync with that function.
export type Bundle = { id: string; tokens: number; price: string; label: string; tag?: string };

export const BUNDLES: Bundle[] = [
  { id: 'starter', tokens: 150, price: '$0.99', label: 'Starter Pouch' },
  { id: 'plus', tokens: 500, price: '$2.99', label: 'Big Bag', tag: 'POPULAR' },
  { id: 'mega', tokens: 1200, price: '$5.99', label: 'Treasure Chest', tag: 'BEST VALUE' },
];

// Buying is web-only: native apps must use Apple/Google in-app purchase for
// digital goods, so we hide the store off the web (and when there's no backend).
export const purchasesAvailable = (): boolean => Platform.OS === 'web' && !!supabase;

// Create a Stripe Checkout session for a bundle and return its hosted URL.
export const startCheckout = async (bundleId: string): Promise<string | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { bundle: bundleId },
  });
  if (error) {
    console.warn('[pixelpets] checkout error:', error.message);
    return null;
  }
  return (data as { url?: string })?.url ?? null;
};
