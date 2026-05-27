// Supabase Edge Function: Stripe webhook. On a paid checkout.session.completed
// it credits the purchased tokens via record_purchase (service role, idempotent
// by session id). This is the ONLY thing that grants paid tokens — the client
// is never trusted to say "I paid".
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
//          (Stripe sends no Supabase JWT; the Stripe signature is the auth.)
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. SUPABASE_URL /
//          SERVICE_ROLE_KEY are injected automatically.
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${(e as Error).message}`, {
      status: 400,
    });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    const userId = s.metadata?.user_id;
    const tokens = parseInt(s.metadata?.tokens ?? '0', 10);
    const bundle = s.metadata?.bundle ?? '';
    const amount = parseInt(s.metadata?.amount ?? '0', 10);
    if (userId && tokens > 0 && s.payment_status === 'paid') {
      const { error } = await supabase.rpc('record_purchase', {
        p_session: s.id,
        p_owner: userId,
        p_bundle: bundle,
        p_tokens: tokens,
        p_amount: amount,
      });
      if (error) {
        console.error('record_purchase failed:', error);
        return new Response('record_purchase failed', { status: 500 });
      }
    }
  }
  return new Response('ok', { status: 200 });
});
