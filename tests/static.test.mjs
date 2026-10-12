import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const publicPath = new URL('../public/', import.meta.url);
const worker = await readFile(new URL('sw.js', publicPath), 'utf8');
const assets = JSON.parse(worker.match(/const ASSETS = (\[.*\]);/)[1]);
test('every offline asset exists; version is content-derived; install icons have valid PNG dimensions', async () => {
  const hash = createHash('sha256');
  for (const asset of assets) {
    assert.ok(asset.startsWith('./'));
    const content = await readFile(new URL(asset, publicPath));
    assert.ok(content.length > 0, asset); hash.update(content);
  }
  assert.ok(worker.includes(hash.digest('hex').slice(0, 12)), 'Run npm run build when public assets change.');
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', publicPath), 'utf8'));
  assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './'); assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const bytes = await readFile(new URL(icon.src, publicPath));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
  }
});
test('service worker precaches, serves offline navigation under a subpath, and leaves unrelated caches intact', async () => {
  const handlers = {}, deleted = [], precached = [];
  let claimed = false, fetches = 0;
  const cache = { addAll: async files => precached.push(...files), match: async key => String(key) === 'https://example.test/poker/index.html' ? { cached: true } : null };
  const prefix = 'river:https://example.test/poker/:';
  const current = prefix + worker.match(/const CACHE = PREFIX \+ '([^']+)'/)[1];
  vm.runInNewContext(worker, {
    self: { location: { origin: 'https://example.test' }, registration: { scope: 'https://example.test/poker/' }, clients: { claim: async () => { claimed = true; } }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches: { open: async () => cache, keys: async () => ['other-app', 'river:https://example.test/:old', prefix + 'previous', current], delete: async key => { deleted.push(key); } },
    fetch: async () => { fetches++; return { network: true }; }, URL, Promise,
  });
  let pending;
  handlers.install({ waitUntil: promise => { pending = promise; } }); await pending;
  assert.deepEqual(precached, assets);
  handlers.activate({ waitUntil: promise => { pending = promise; } }); await pending;
  assert.equal(claimed, true); assert.deepEqual(deleted, [prefix + 'previous']);
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/poker/', mode: 'navigate' }, respondWith: promise => { pending = promise; } });
  assert.deepEqual(await pending, { cached: true }); assert.equal(fetches, 0);
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/poker/uncached.txt', mode: 'cors' }, respondWith: promise => { pending = promise; } });
  assert.deepEqual(await pending, { network: true });
  let intercepted = false;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/elsewhere/', mode: 'navigate' }, respondWith: () => { intercepted = true; } });
  handlers.fetch({ request: { method: 'POST', url: 'https://example.test/poker/' }, respondWith: () => { intercepted = true; } });
  handlers.fetch({ request: { method: 'GET', url: 'https://external.test/' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});
test('production bundle is small and has no external runtime requests', async () => {
  let total = 0;
  for (const file of assets) total += (await stat(new URL(file, publicPath))).size;
  assert.ok(total < 1_000_000, `Asset budget exceeded: ${total} bytes`);
  const source = await readFile(new URL('app.js', publicPath), 'utf8');
  assert.ok(!/fetch\(['"]https?:/.test(source));
  assert.ok(!/https?:\/\//.test(await readFile(new URL('index.html', publicPath), 'utf8')));
});

test('all CSS keyframes animate only transform and opacity', async () => {
  const css = await readFile(new URL('style.css', publicPath), 'utf8');
  for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1, end = match.index + match[0].length;
    const start = end;
    while (depth && end < css.length) { if (css[end] === '{') depth++; if (css[end] === '}') depth--; end++; }
    const properties = [...css.slice(start, end - 1).matchAll(/(?:\{|;)\s*([\w-]+)\s*:/g)].map(m => m[1]);
    assert.ok(properties.length > 0, match[1]);
    assert.ok(properties.every(p => ['transform', 'opacity'].includes(p)), `${match[1]} animates ${properties}`);
  }
  assert.ok(!/transition:\s*(?:all|color|width|height)/.test(css));
});
