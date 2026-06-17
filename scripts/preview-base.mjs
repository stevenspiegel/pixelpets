// Launch the Base preview harness on web: starts Expo with EXPO_PUBLIC_PREVIEW
// set so App.tsx renders <BasePreview> (a sample-decorated base) instead of the
// normal auth-gated app. Cross-platform (sets the env here rather than inline in
// package.json, which wouldn't work on Windows). Run: npm run preview:base
import { spawn } from 'child_process';

const child = spawn('npx', ['expo', 'start', '--web'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_PREVIEW: 'base' },
});
child.on('exit', (code) => process.exit(code ?? 0));
