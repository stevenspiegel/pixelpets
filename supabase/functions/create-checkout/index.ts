// Supabase Edge Function: create a Stripe Checkout Session for a token bundle.
// The client calls this with its Supabase JWT (via supabase.functions.invoke);
// we identify the user, look up the bundle's price + tokens SERVER-SIDE (so the
// client can't tamper with either), and return the hosted Checkout URL.
//
// Deploy:  supabase functions deploy create-checkout
// Secrets: STRIPE_SECRET_KEY (and optional APP_URL). SUPABASE_URL / _ANON_KEY
//          are injected automatically.
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Canonical bundles — the ONLY source of truth for price + token amount.
const BUNDLES: Record<string, { tokens: number; amount: number; name: string }> = {
  starter: { tokens: 150, amount: 99, name: '150 Pixel Tokens' },
  plus: { tokens: 500, amount: 299, name: '500 Pixel Tokens' },
  mega: { tokens: 1200, amount: 599, name: '1200 Pixel Tokens' },
};

const APP_URL = Deno.env.get('APP_URL') ?? 'https://pixelpetsworld.com/';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { bundle } = await req.json();
    const b = BUNDLES[bundle];
    if (!b) return json({ error: 'Unknown bundle' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: 'Not authenticated' }, 401);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: b.amount,
            product_data: { name: b.name },
          },
        },
      ],
      client_reference_id: user.id,
      metadata: { user_id: user.id, bundle, tokens: String(b.tokens), amount: String(b.amount) },
      success_url: `${APP_URL}?purchase=success`,
      cancel_url: `${APP_URL}?purchase=cancel`,
    });
    return json({ url: session.url }, 200);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
