const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Miniflare } = require('../workers/webmention/node_modules/miniflare');
const { buildSync } = require('../workers/webmention/node_modules/esbuild');

test('actual Workers runtime reads public replies and rejects redirects without following them', { timeout: 30000 }, async () => {
  const outgoing = [];
  const script = buildSync({ stdin: { contents: `
    import { handleMcp } from './workers/mcp/handler.mjs';
    const brain = { version: 1, readers: [], entries: [], threads: [{id:'topic', issue:137}] };
    export default { fetch(request) { return handleMcp(request, async () => ({articles:[]}), { loadBrain: async () => brain }); } };
  `, resolveDir: path.resolve(__dirname, '..'), sourcefile: 'brain-runtime-fixture.mjs' }, bundle: true, format: 'esm', platform: 'neutral', write: false }).outputFiles[0].text;
  const mf = new Miniflare({
    modules: true,
    script,
    compatibilityDate: '2026-10-01',
    outboundService: async request => {
      outgoing.push(request.url);
      if (request.method !== 'GET') return new Response('Unexpected method', { status: 405 });
      if (request.url === 'https://api.github.com/repos/sighmoan1/bathos/issues/137/comments?per_page=50&page=1') return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      if (request.url === 'https://api.github.com/repos/sighmoan1/bathos/issues/137/comments?per_page=50&page=2') return new Response('', { status: 302, headers: { Location: 'https://example.invalid/do-not-follow' } });
      return new Response('Unexpected destination', { status: 500 });
    },
  });
  const call = async page => {
    const response = await mf.dispatchFetch('https://bathos.org/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({jsonrpc:'2.0', id:1, method:'tools/call', params:{name:'get_brain_dialogue', arguments:{thread:'topic',page}}}) });
    assert.equal(response.status, 200);
    return (await response.json()).result;
  };
  try {
    const available = await call(1);
    assert.equal(available.isError, undefined);
    assert.equal(available.structuredContent.status, 'available');
    assert.equal(available.structuredContent.complete, true);
    assert.deepEqual(available.structuredContent.comments, []);
    const redirected = await call(2);
    assert.equal(redirected.isError, true);
    assert.equal(redirected.structuredContent.reason, 'github-http-302');
    assert.equal(redirected.structuredContent.complete, false);
    assert.deepEqual(outgoing, [
      'https://api.github.com/repos/sighmoan1/bathos/issues/137/comments?per_page=50&page=1',
      'https://api.github.com/repos/sighmoan1/bathos/issues/137/comments?per_page=50&page=2',
    ]);
  } finally { await mf.dispose(); }
});
