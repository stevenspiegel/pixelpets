// Post-export step: Expo's web build only emits a favicon link, so add the
// home-screen install bits (apple-touch-icon + web manifest + theme/meta) to
// the exported index.html. The referenced files live in public/ and are copied
// to the web root by `expo export`. Run by .github/workflows/deploy.yml.
import fs from 'fs';

const file = process.argv[2] || 'dist/index.html';
let html = fs.readFileSync(file, 'utf8');

const tags = [
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>',
  '<link rel="manifest" href="/manifest.webmanifest"/>',
  '<meta name="theme-color" content="#1565ad"/>',
  '<meta name="apple-mobile-web-app-capable" content="yes"/>',
  '<meta name="mobile-web-app-capable" content="yes"/>',
  '<meta name="apple-mobile-web-app-title" content="Pixel Pets"/>',
].join('');

if (html.includes('rel="manifest"')) {
  console.log('PWA head tags already present in', file);
} else {
  html = html.replace('</head>', tags + '</head>');
  fs.writeFileSync(file, html);
  console.log('Injected PWA head tags into', file);
}
