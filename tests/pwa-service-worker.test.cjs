const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const templatePath = path.resolve(__dirname, '../public/manage/sw.js');
function harness(fetchImpl = async request => new Response('network ' + request.url)) {
  const handlers = new Map(), stores = new Map();
  const cache = key => {
    if (!stores.has(key)) stores.set(key, new Map());
    const store = stores.get(key);
    return {
      addAll: async urls => { for (const url of urls) store.set(new URL(url, 'https://bathos.org').href, new Response('cached ' + url)); },
      match: async input => store.get(typeof input === 'string' ? new URL(input, 'https://bathos.org').href : input.url)?.clone(),
      put: async (request, response) => store.set(typeof request === 'string' ? new URL(request, 'https://bathos.org').href : request.url, response.clone()),
    };
  };
  const self = { location: { origin: 'https://bathos.org' }, addEventListener: (event, callback) => handlers.set(event, callback), skipWaiting: async () => {}, clients: { claim: async () => {} } };
  const caches = { open: async key => cache(key), keys: async () => [...stores.keys()], delete: async key => stores.delete(key), match: async req => { for (const key of stores.keys()) { const result = await cache(key).match(req); if (result) return result; } } };
  const source = fs.readFileSync(templatePath, 'utf8').replace(/const CACHE_NAME = [^;]+;/, 'const CACHE_NAME = "bathos-manager-test";').replace(/const PRECACHE = [^;]+;/, 'const PRECACHE = ' + JSON.stringify(['/manage/', '/_next/static/chunks/editor.js']) + ';');
  vm.runInNewContext(source, { self, caches, fetch: fetchImpl, URL, Request, Response, console });
  return { handlers, stores, caches,
    async event(name, fields = {}) { const pending = []; let response; const event = { ...fields, waitUntil: promise => pending.push(promise), respondWith: promise => { response = promise; } }; handlers.get(name)?.(event); await Promise.all(pending); return response && await response; },
  };
}
test('service worker never handles private API, reader, external or mutation requests', async () => {
  const worker = harness();
  await worker.event('install');
  for (const [url, method] of [['https://bathos.org/api/session', 'GET'], ['https://bathos.org/api/posts', 'GET'], ['https://bathos.org/', 'GET'], ['https://example.com/_next/static/editor.js', 'GET'], ['https://bathos.org/manage/', 'POST']]) {
    assert.equal(await worker.event('fetch', { request: new Request(url, { method }) }), undefined, `${method} ${url} must bypass SW`);
  }
  for (const entries of worker.stores.values()) assert.ok([...entries.keys()].every(url => !new URL(url).pathname.startsWith('/api/')));
});
test('offline manager and compiled assets load from the installation cache', async () => {
  const worker = harness(async () => { throw new TypeError('offline'); });
  await worker.event('install');
  for (const url of ['https://bathos.org/manage/', 'https://bathos.org/_next/static/chunks/editor.js']) {
    const result = await worker.event('fetch', { request: new Request(url) });
    assert.ok(result instanceof Response);
    assert.match(await result.text(), /cached/);
  }
});

test('activation removes older manager cache while preserving unrelated reader cache', async () => {
  const worker = harness();
  await worker.caches.open('bathos-manager-old');
  await worker.caches.open('reader-cache');
  await worker.event('install');
  await worker.event('activate');
  assert.deepEqual(await worker.caches.keys(), ['reader-cache', 'bathos-manager-test']);
});
