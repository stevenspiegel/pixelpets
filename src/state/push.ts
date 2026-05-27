import { supabase } from '../lib/supabase';

// Public half of the VAPID keypair — safe to ship. The matching private key is
// a secret on the GitHub Actions sender (scripts/send-push.mjs). If you rotate
// it, regenerate BOTH together and update this constant + the secret.
export const VAPID_PUBLIC_KEY =
  'BIl-oXFZzQniU2xzavZKnN18vJzDlZslDXvZqZzlUelWyvMcRdHgMu2SCJOZpYfAjx0mN0ZF3DgCTfT7Dgv5Vd8';

// Push is a web-only feature (service worker + Push API). On native these
// globals are absent and pushSupported() is false, so the UI hides the toggle.
// Cast through `any` so this compiles without DOM lib types in the RN project.
const w: any = typeof globalThis !== 'undefined' ? globalThis : {};

export type PushState = 'unsupported' | 'denied' | 'on' | 'off';

export const pushSupported = (): boolean =>
  !!w.navigator &&
  'serviceWorker' in w.navigator &&
  !!w.PushManager &&
  !!w.Notification;

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = w.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export const getPushState = async (): Promise<PushState> => {
  if (!pushSupported()) return 'unsupported';
  if (w.Notification.permission === 'denied') return 'denied';
  const reg = await w.navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? 'on' : 'off';
};

export const enablePush = async (): Promise<PushState> => {
  if (!pushSupported()) return 'unsupported';
  const perm = await w.Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await w.navigator.serviceWorker.register('/sw.js');
  await w.navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON();
  if (supabase && json.keys) {
    const { error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
    });
    if (error) {
      console.warn('[pixelpets] save push subscription error:', error.message);
      return 'off';
    }
  }
  return 'on';
};

export const disablePush = async (): Promise<PushState> => {
  if (!pushSupported()) return 'unsupported';
  const reg = await w.navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    if (supabase) {
      await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
    }
    await sub.unsubscribe();
  }
  return 'off';
};
