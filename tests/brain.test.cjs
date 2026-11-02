const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = import('../lib/brain-core.mjs');
const worker = import('../workers/mcp/brain.mjs');
const revision = 'a'.repeat(40);
function fixture() { return { version: 1, readers: [{ id: 'reader', name: 'An AI', model: 'Declared model', run: 'test', provenance: 'One test run, not independent voters.' }], threads: [{ id: 'topic', title: 'A question', summary: 'An open interpretation', issue: 137 }], entries: [{ id: 'first', reader: 'reader', thread: 'topic', kind: 'reading', createdAt: '2026-11-02T00:00:00Z', text: 'A possible reading', scope: 'A particular context', sources: [{ slug: 'one', quote: 'An actual sentence.', revision }], repliesTo: [], revises: [] }] }; }
const articles = [{ slug: 'one', title: 'One', content: 'An actual sentence.' }, { slug: 'two', title: 'Two', content: 'Another.' }];
async function graph() { return (await core).buildBrain(fixture(), articles); }
test('ledger preserves readings, evidence, source versions and explicit backlinks', async () => {
  const { buildBrain } = await core;
  const result = buildBrain(fixture(), articles, [{ from: 'two', to: 'one' }, { from: 'two', to: 'one' }, { from: 'missing', to: 'one' }]);
  assert.equal(result.entries[0].sources[0].status, 'present');
  assert.match(result.entries[0].sources[0].revisionUrl, new RegExp(revision));
  assert.deepEqual(result.articles[0].backlinks, ['two']);
  assert.deepEqual(result.articles[0].threads, ['topic']);
  assert.match(result.principle, /silence/);
  assert.equal(result.readers.length, 1);
  assert.deepEqual(result, buildBrain(fixture(), articles, [{ from: 'two', to: 'one' }]));
});
test('edits and removals mark stale evidence without destroying the historical reading', async () => {
  const { buildBrain } = await core;
  assert.equal(buildBrain(fixture(), [{ slug: 'one', title: 'One', content: 'Changed.' }]).entries[0].sources[0].status, 'changed');
  assert.equal(buildBrain(fixture(), []).entries[0].sources[0].status, 'missing');
  assert.equal(buildBrain(fixture(), articles).entries[0].text, fixture().entries[0].text);
  const pinned = fixture(); pinned.entries[0].sources[0].blob = 'b'.repeat(40);
  const revised = buildBrain(pinned, [{ ...articles[0], blob: 'c'.repeat(40) }]).entries[0].sources[0];
  assert.equal(revised.status, 'changed'); assert.equal(revised.quotePresent, true);
});
test('malformed identities, dates, references and unproven clarifications fail closed', async () => {
  const { validateLedger } = await core;
  for (const mutate of [x => { delete x.readers[0].id; }, x => x.entries.push(x.entries[0]), x => x.entries[0].createdAt = '2026-02-31T00:00:00Z', x => x.entries[0].repliesTo = ['unknown'], x => x.entries[0].sources[0].slug = '../secret', x => x.entries[0].sources[0].revision = 'main', x => x.entries[0].kind = 'clarification', x => x.entries[0].sources = []]) {
    const data = fixture(); mutate(data); assert.throws(() => validateLedger(data), /Invalid brain ledger/);
  }
});
test('a witness can revise itself but cannot overwrite another witness', async () => {
  const { buildBrain, validateLedger } = await core;
  const data = fixture();
  data.entries.push({ ...structuredClone(data.entries[0]), id: 'second', text: 'A revision', revises: ['first'] });
  assert.equal(buildBrain(data, articles).entries[0].revised, true);
  data.readers.push({ ...data.readers[0], id: 'other' }); data.entries[1].reader = 'other';
  assert.throws(() => validateLedger(data), /own earlier reading/);
});
test('only local canonical article links become backlinks', async () => {
  const { articleSlugFromUrl } = await core;
  assert.equal(articleSlugFromUrl('/posts/Gassing/#part'), 'Gassing');
  assert.equal(articleSlugFromUrl('https://bathos.org/read/one/'), 'one');
  assert.equal(articleSlugFromUrl('/posts/one/index.md'), 'one');
  for (const url of ['https://evil.example/posts/one/', 'javascript:alert(1)', '/manage/', '/posts/%ZZ/']) assert.equal(articleSlugFromUrl(url), null);
});
test('brain tools validate arguments before loading; preserve competing records and pagination', async () => {
  const { callBrainTool, brainTools } = await worker;
  assert.ok(brainTools.every(tool => tool.annotations.readOnlyHint));
  for (const args of [{ query: '!!!' }, { query: 'privacy', url: 'http://localhost' }, { query: 'privacy', limit: 99 }]) {
    const result = await callBrainTool('search_brain', args, () => { throw Error('should not load'); });
    assert.equal(result.error.code, -32602);
  }
  const found = await callBrainTool('search_brain', { query: 'possible' }, graph);
  assert.equal(found.result.structuredContent.total, 1);
  const topic = await callBrainTool('get_brain_thread', { thread: 'topic' }, graph);
  assert.equal(topic.result.structuredContent.liveReplies.tool, 'get_brain_dialogue');
  assert.equal((await callBrainTool('get_brain_thread', { thread: 'absent' }, graph)).result.isError, true);
});
test('dialogue fetch is fixed, bounded, paginated and does not equate account with speaker', async () => {
  const { callBrainTool } = await worker;
  let fetched, options;
  const result = await callBrainTool('get_brain_dialogue', { thread: 'topic', page: 2 }, graph, async (url, opts) => {
    fetched = url; options = opts;
    return Response.json([{ id: 42, user: { login: 'sighmoan1' }, body: 'Written by an agent.', created_at: '2026-11-02T00:00:00Z' }], { headers: { link: '<https://evil.example>; rel="next"' } });
  });
  const data = result.result.structuredContent;
  assert.equal(fetched, 'https://api.github.com/repos/sighmoan1/bathos/issues/137/comments?per_page=50&page=2');
  assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, undefined);
  assert.equal(data.nextPage, 3); assert.equal(data.complete, false);
  assert.match(data.comments[0].authorship, /must be established/);
  assert.equal(data.comments[0].url, 'https://github.com/sighmoan1/bathos/issues/137#issuecomment-42');
  const unavailable = await callBrainTool('get_brain_dialogue', { thread: 'topic' }, graph, async () => new Response('', { status: 429 }));
  assert.equal(unavailable.result.isError, true); assert.equal(unavailable.result.structuredContent.complete, false);
  assert.equal(unavailable.result.structuredContent.status, 'unavailable');
});
test('the actual seed ledger is valid and does not invent independent readers or author replies', async () => {
  const seed = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../brain/ledger.json')));
  (await core).validateLedger(seed);
  assert.ok(seed.entries.length > 0);
  for (const entry of seed.entries.filter(entry => entry.kind === 'clarification')) assert.match(entry.testimonyUrl, /#issuecomment-\d+$/);
});
test('brain tools share the existing MCP transport protections and remain read only', async () => {
  const { handleMcp } = await import('../workers/mcp/handler.mjs');
  const request = (method, params, origin) => new Request('https://bathos.org/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const noArticles = async () => { throw Error('Brain reads must not load article data'); };
  const options = { loadBrain: graph };
  const listed = await (await handleMcp(request('tools/list'), noArticles, options)).json();
  assert.equal(listed.result.tools.length, 6); assert.ok(listed.result.tools.every(tool => tool.annotations.readOnlyHint));
  const response = await handleMcp(request('tools/call', { name: 'get_brain_thread', arguments: { thread: 'topic' } }), noArticles, options);
  assert.equal(response.status, 200); assert.equal((await response.json()).result.structuredContent.thread.id, 'topic');
  const rejected = await handleMcp(request('tools/call', { name: 'get_brain_thread', arguments: { thread: 'topic' } }, 'https://evil.example'), noArticles, options);
  assert.equal(rejected.status, 403);
});
