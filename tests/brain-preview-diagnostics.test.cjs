// Temporary release investigation for PR #138. Remove before merge: ordinary
// unit/release tests must not depend on a superseded preview or external uptime.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const base = 'https://056a116b.bathos-web.pages.dev';
test('diagnose the deployed preview MCP with actual HTTP POST requests', { timeout: 90000 }, async () => {
  const outcomes = [];
  for (const [method, params] of [
    ['initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'bathos-release-check', version: '1' } }],
    ['tools/list', {}],
    ['tools/call', { name: 'list_posts', arguments: { limit: 1 } }],
    ['tools/call', { name: 'search_brain', arguments: { query: 'privacy', limit: 1 } }],
    ['tools/call', { name: 'get_brain_thread', arguments: { thread: 'authority-and-curiosity', limit: 1 } }],
    ['tools/call', { name: 'get_brain_dialogue', arguments: { thread: 'authority-and-curiosity' } }],
  ]) {
    try {
      const response = await fetch(`${base}/mcp`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12000), redirect: 'manual' });
      const raw = await response.text();
      let data; try { data = JSON.parse(raw); } catch {}
      const outcome = { method, tool: params.name, status: response.status, location: response.headers.get('location'), type: response.headers.get('content-type'), ok: response.ok && !!data?.result && !data.result.isError, body: raw.slice(0, 1800) };
      outcomes.push(outcome); console.log('PREVIEW_HTTP', JSON.stringify(outcome));
    } catch (error) { const outcome = { method, tool: params.name, ok: false, error: String(error) }; outcomes.push(outcome); console.log('PREVIEW_HTTP', JSON.stringify(outcome)); }
  }
  for (const url of [`${base}/brain.json`, 'https://api.github.com/repos/sighmoan1/bathos/issues/137/comments?per_page=50&page=1']) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Bathos-release-check', Accept: 'application/json' } }); console.log('PREVIEW_GET', JSON.stringify({ url, status: response.status, body: (await response.text()).slice(0, 500) })); } catch (error) { console.log('PREVIEW_GET', JSON.stringify({url, error: String(error)})); }
  }
  assert.ok(outcomes.every(item => item.ok), 'The deployed MCP must successfully return actual results, not just a handled error. See PREVIEW_HTTP diagnostics.');
});
