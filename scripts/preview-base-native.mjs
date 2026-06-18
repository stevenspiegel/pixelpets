// Launch the Base preview harness on a device/emulator via Expo Go: starts Expo
// (native, with the QR code) with EXPO_PUBLIC_PREVIEW set so App.tsx renders
// <BasePreview> (a sample-decorated base) instead of the normal auth-gated app —
// the phone lands straight on the Base screen, handy for testing the pinch-zoom /
// pan viewport and wall auto-tiling without logging in. Sets the env here rather
// than inline (which wouldn't work on Windows). Extra CLI args are forwarded, so
// `npm run preview:base:native -- --tunnel` works when the phone isn't on the LAN.
//
// Run: npm run preview:base:native   (then scan the QR with Expo Go / iOS Camera)
import { spawn } from 'child_process';

const child = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_PREVIEW: 'base' },
});
child.on('exit', (code) => process.exit(code ?? 0));
