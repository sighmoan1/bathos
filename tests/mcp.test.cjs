const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const handler = import('../workers/mcp/handler.mjs');
const catalog = { version: 1, articles: [
  { slug: 'older', title: 'Agentic flooding', summary: 'Public services', tags: ['AI'], date: '2026-10-12', canonicalUrl: 'https://bathos.org/posts/older/', content: 'Claims and agents helping people access services.' },
  { slug: 'newer', title: 'Software factories', summary: 'Building software', tags: ['code'], date: '2026-10-15', canonicalUrl: 'https://bathos.org/posts/newer/', content: 'Software factories are useful. ' + 'x'.repeat(999) + '😀' + 'y'.repeat(41000) },
] };
const request = (body, headers = {}, method = 'POST') => new Request('https://bathos.org/mcp', { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
async function rpc(method, params, id = 1, headers = {}) {
  const response = await (await handler).handleMcp(request({ jsonrpc: '2.0', id, method, params }, headers), async () => catalog);
  return { response, data: response.status === 202 ? null : await response.json() };
}
test('MCP negotiates versions and exposes three read-only tools', async () => {
  const initialized = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal(initialized.data.result.protocolVersion, '2025-06-18');
  assert.equal(initialized.response.headers.get('cache-control'), 'no-store');
  assert.equal((await rpc('initialize', { protocolVersion: 'future', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).data.result.protocolVersion, '2025-11-25');
  assert.equal((await rpc('initialize', {})).data.error.code, -32602);
  const listed = await rpc('tools/list');
  assert.deepEqual(listed.data.result.tools.map(tool => tool.name), ['list_posts', 'search_posts', 'get_post']);
  assert.ok(listed.data.result.tools.every(tool => tool.annotations.readOnlyHint));
  assert.deepEqual((await rpc('ping')).data.result, {});
});
test('MCP lists, filters, searches full text, and returns complete paginated post source', async () => {
  const listed = (await rpc('tools/call', { name: 'list_posts', arguments: { limit: 1 } })).data.result.structuredContent;
  assert.equal(listed.posts[0].slug, 'newer'); assert.equal(listed.nextOffset, 1);
  assert.equal(listed.posts[0].content, undefined);
  const filtered = (await rpc('tools/call', { name: 'list_posts', arguments: { tag: 'ai' } })).data.result.structuredContent;
  assert.equal(filtered.total, 1);
  const search = (await rpc('tools/call', { name: 'search_posts', arguments: { query: 'claims' } })).data.result.structuredContent;
  assert.equal(search.posts[0].slug, 'older'); assert.match(search.posts[0].excerpt, /Claims/);
  let offset = 0, content = '';
  do {
    const page = (await rpc('tools/call', { name: 'get_post', arguments: { slug: 'newer', offset, maxChars: 1000 } })).data.result.structuredContent;
    content += page.content; offset = page.nextOffset;
  } while (offset !== null);
  assert.equal(content, catalog.articles[1].content);
  assert.equal((await rpc('tools/call', { name: 'get_post', arguments: { slug: '../../private' } })).data.result.isError, true);
});
test('MCP returns protocol errors for invalid tools and parameters', async () => {
  for (const params of [
    { name: 'delete_post' }, { name: 'get_post', arguments: { slug: 'older', url: 'http://localhost' } },
    { name: 'get_post', arguments: { slug: 'older', maxChars: 1 } }, { name: 'get_post', arguments: { slug: 'older', offset: -1 } },
    { name: 'list_posts', arguments: { limit: 101 } }, { name: 'search_posts', arguments: { query: ' ' } },
    { name: 'search_posts', arguments: { query: '!!!' } }, { name: 'search_posts', arguments: { query: 'x'.repeat(301) } },
    { name: 'get_post', arguments: [] },
  ]) assert.equal((await rpc('tools/call', params)).data.error.code, -32602);
  assert.equal((await rpc('not/a/method')).data.error.code, -32601);
});
test('MCP validates origins, MIME, accept, version, JSON and body bounds before loading data', async () => {
  const handle = (await handler).handleMcp;
  const load = () => { throw Error('must not load'); };
  for (const [req, status] of [
    [request('{}', { Origin: 'https://evil.example' }), 403],
    [request('{}', { 'Content-Type': 'text/plain' }), 415], [request('{}', { Accept: 'application/json' }), 406],
    [request('{}', { 'MCP-Protocol-Version': 'invalid' }), 400], [request('{broken'), 400],
    [request('[]'), 400], [request('x'.repeat(17000)), 413], [request({}, {}, 'GET'), 405],
    [request({ jsonrpc: '2.0', id: null, method: 'ping' }), 400],
  ]) assert.equal((await handle(req, load)).status, status);
  assert.equal((await handle(request({ jsonrpc: '2.0', method: 'notifications/initialized' }), load)).status, 202);
  const allowed = await handle(request({}, { Origin: 'https://chatgpt.com' }, 'OPTIONS'), load);
  assert.equal(allowed.status, 204); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://chatgpt.com');
  const down = await handle(request({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_posts' } }), async () => { throw Error('secret details'); });
  assert.equal(down.status, 503); assert.doesNotMatch(await down.text(), /secret details/);
});
test('Pages adapter uses its deployment asset binding, never a client supplied URL', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../functions/mcp.js'), 'utf8');
  const { onRequest } = await import('data:text/javascript;base64,' + Buffer.from(source.replace("'../workers/mcp/handler.mjs'", JSON.stringify(new URL('../workers/mcp/handler.mjs', `file://${__filename}`).href))).toString('base64'));
  let fetched;
  const response = await onRequest({ request: request({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_posts' } }), env: { ASSETS: { fetch: async url => { fetched = String(url); return Response.json(catalog); } } } });
  assert.equal(response.status, 200); assert.equal(fetched, 'https://bathos.org/agent-posts.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, '../public/_routes.json'))).include, ['/mcp', '/mcp/']);
});
