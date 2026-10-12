import { mkdir, readdir, readFile, rm, cp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { generate } from './generate.mjs';
import { generateIcons } from './icons.mjs';

await generateIcons();
const data = generate();
data.rules = JSON.parse(await readFile('public/rules.json', 'utf8'));
await writeFile('public/spots.json', JSON.stringify(data));
const assets = [];
async function collect(dir = '') {
  for (const entry of await readdir(`public/${dir}`, { withFileTypes: true })) {
    const path = dir + entry.name;
    if (entry.isDirectory()) await collect(path + '/');
    else if (entry.name !== 'sw.js' && entry.name !== 'OFL.txt') assets.push('./' + path);
  }
}
await collect();
assets.sort();
const hash = createHash('sha256');
for (const asset of assets) hash.update(await readFile(`public/${asset.slice(2)}`));
const version = hash.digest('hex').slice(0, 12);
const worker = `const PREFIX = 'river:' + self.registration.scope + ':';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const key = event.request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : event.request;
    const cached = await cache.match(key);
    return cached || fetch(event.request);
  }));
});
`;
await writeFile('public/sw.js', worker);
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await cp('public', 'dist', { recursive: true });
console.log(`Built ${assets.length} offline assets. Exact answers for ${['equity', 'outs', 'pot', 'range'].reduce((n, t) => n + data[t].length, 0)} spots. Cache ${version}.`);
