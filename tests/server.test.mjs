import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('static server serves local assets, MIME types, HEAD, errors and traversal boundaries', async () => {
  const server = spawn(process.execPath, ['scripts/serve.mjs', 'public'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const [chunk] = await once(server.stdout, 'data');
    const url = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    const home = await fetch(url);
    assert.equal(home.status, 200); assert.match(await home.text(), /<title>River —/);
    const script = await fetch(url + '/app.js', { method: 'HEAD' });
    assert.equal(script.headers.get('content-type'), 'text/javascript'); assert.equal(await script.text(), '');
    assert.equal((await fetch(url + '/manifest.webmanifest')).headers.get('content-type'), 'application/manifest+json');
    assert.equal((await fetch(url + '/sw.js')).headers.get('cache-control'), 'no-cache');
    assert.equal((await fetch(url + '/missing')).status, 404);
    assert.equal((await fetch(url + '/', { method: 'POST' })).status, 405);
    assert.equal((await fetch(url + '/%2f..%2fpackage.json')).status, 403);
    assert.equal((await fetch(url + '/bad%')).status, 404);
  } finally { server.kill(); await once(server, 'exit'); }
});

test('the same static app serves at /poker/ with a trailing-slash redirect and no root leak', async () => {
  const server = spawn(process.execPath, ['scripts/serve.mjs', 'public'], { env: { ...process.env, PORT: '0', BASE_PATH: '/poker/' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const [chunk] = await once(server.stdout, 'data');
    const url = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    const redirect = await fetch(url + '/poker', { redirect: 'manual' });
    assert.equal(redirect.status, 301); assert.equal(redirect.headers.get('location'), '/poker/');
    assert.equal((await fetch(url + '/poker/')).status, 200);
    assert.match(await (await fetch(url + '/poker/app.js')).text(), /gradeEstimate/);
    assert.equal((await fetch(url + '/app.js')).status, 404);
    assert.equal((await fetch(url + '/poker/%2f..%2fpackage.json')).status, 403);
  } finally { server.kill(); await once(server, 'exit'); }
});
