// Scheduled Web Push sender — run by .github/workflows/push-notify.yml.
//
// Reads push subscriptions + pet/profile state with the Supabase SERVICE ROLE
// (bypasses RLS) and sends two kinds of reminder:
//   • care   — a pet is projected hungry/dirty/sick (throttled to once / 6h)
//   • streak — late in the UTC day, you have a streak but haven't checked in
// Per-user dedupe lives on profiles so multi-device users get one push/event.
//
// Required env (GitHub Actions secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. Optional: VAPID_SUBJECT, APP_URL.
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:admin@pixelpetsworld.com',
  APP_URL = 'https://pixelpetsworld.com/',
} = process.env;

for (const [k, v] of Object.entries({
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
})) {
  if (!v) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Care decay — MUST mirror src/state/usePet.ts (applyDecay / scaleElapsed).
const HUNGER_DRAIN = 0.01;
const CLEAN_DRAIN = 0.005;
const OFFLINE_THRESHOLD_SEC = 30;
const OFFLINE_MULTIPLIER = 0.1;
const CARE_THROTTLE_MS = 6 * 60 * 60 * 1000;
const STREAK_HOUR_UTC = 23; // send streak reminders in the last hour of the day

const scaleElapsed = (raw) =>
  raw <= OFFLINE_THRESHOLD_SEC
    ? raw
    : OFFLINE_THRESHOLD_SEC + (raw - OFFLINE_THRESHOLD_SEC) * OFFLINE_MULTIPLIER;

// Project a pet's current care state from its last synced tick, and return the
// most urgent care message if it needs attention — otherwise null.
const careMessage = (pet, now) => {
  if (pet.stage === 'egg' || pet.stage === 'dead') return null;
  const elapsed = Math.max(0, (now - Number(pet.last_tick)) / 1000);
  const scaled = scaleElapsed(elapsed);
  const hunger = pet.hunger - scaled * HUNGER_DRAIN * (pet.asleep ? 0.25 : 1);
  const clean = pet.cleanliness - scaled * CLEAN_DRAIN;
  if (pet.sick) return `🤒 ${pet.name} isn't feeling well — check on them!`;
  if (hunger <= 20) return `🍔 ${pet.name} is getting hungry — time for a snack!`;
  if (clean <= 15) return `🧼 ${pet.name}'s space needs a cleaning!`;
  return null;
};

const sendTo = async (subs, payload) => {
  const dead = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(s.endpoint);
        else console.warn(`push failed (${err.statusCode}) for ${s.endpoint.slice(0, 40)}…`);
      }
    })
  );
  return dead;
};

const main = async () => {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const hourUtc = new Date(now).getUTCHours();

  const { data: subs, error: subErr } = await db
    .from('push_subscriptions')
    .select('endpoint, owner, p256dh, auth');
  if (subErr) throw subErr;
  if (!subs || subs.length === 0) {
    console.log('No subscriptions; nothing to do.');
    return;
  }

  const ownerIds = [...new Set(subs.map((s) => s.owner))];
  const subsByOwner = new Map();
  for (const s of subs) {
    if (!subsByOwner.has(s.owner)) subsByOwner.set(s.owner, []);
    subsByOwner.get(s.owner).push(s);
  }

  const [{ data: profiles }, { data: pets }] = await Promise.all([
    db
      .from('profiles')
      .select('id, streak, streak_date, notif_streak_date, notif_care_at')
      .in('id', ownerIds),
    db
      .from('pets')
      .select('owner, name, stage, hunger, cleanliness, sick, asleep, last_tick')
      .in('owner', ownerIds),
  ]);

  const petsByOwner = new Map();
  for (const p of pets ?? []) {
    if (!petsByOwner.has(p.owner)) petsByOwner.set(p.owner, []);
    petsByOwner.get(p.owner).push(p);
  }

  let sent = 0;
  const deadEndpoints = [];

  for (const prof of profiles ?? []) {
    const ownerSubs = subsByOwner.get(prof.id) ?? [];
    if (ownerSubs.length === 0) continue;

    // Care reminder (throttled per user).
    if (now - Number(prof.notif_care_at || 0) > CARE_THROTTLE_MS) {
      let msg = null;
      for (const pet of petsByOwner.get(prof.id) ?? []) {
        msg = careMessage(pet, now);
        if (msg) break;
      }
      if (msg) {
        deadEndpoints.push(
          ...(await sendTo(ownerSubs, {
            title: 'Pixel Pets', body: msg, url: APP_URL, tag: 'care',
          }))
        );
        await db.from('profiles').update({ notif_care_at: now }).eq('id', prof.id);
        sent++;
      }
    }

    // Streak reminder (last hour of the UTC day, once per day).
    if (
      hourUtc >= STREAK_HOUR_UTC &&
      (prof.streak || 0) > 0 &&
      prof.streak_date !== today &&
      prof.notif_streak_date !== today
    ) {
      deadEndpoints.push(
        ...(await sendTo(ownerSubs, {
          title: 'Pixel Pets',
          body: `🔥 Don't lose your ${prof.streak}-day streak! Claim today's check-in.`,
          url: APP_URL,
          tag: 'streak',
        }))
      );
      await db.from('profiles').update({ notif_streak_date: today }).eq('id', prof.id);
      sent++;
    }
  }

  if (deadEndpoints.length > 0) {
    await db.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
  }
  console.log(`Done. Notified ${sent} user(s); pruned ${deadEndpoints.length} dead subscription(s).`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
