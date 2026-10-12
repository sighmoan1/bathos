const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deploymentState, projectURL } = require('../public/admin/publishing.js');
const sha = 'a'.repeat(40);
const run = { id: 1, pull_requests: [], output: { summary: '' }, head_sha: sha, name: 'Cloudflare Pages', app: { slug: 'cloudflare-workers-and-pages' }, details_url: 'https://dash.cloudflare.com/?to=/account/pages/view/bathos-web/deployment', status: 'completed', conclusion: 'success' };
test('requires exact SHA, app, check name and Pages project', () => {
  for (const override of [{ head_sha: 'b'.repeat(40) }, { app: { slug: 'vercel' } }, { name: 'reader' }, { pull_requests: [{ head: { ref: 'feature' } }] }, { output: { summary: 'Branch Preview URL:' } }, { details_url: 'https://dash.cloudflare.com/?to=/account/pages/view/other/deployment' }]) {
    assert.equal(deploymentState(sha, [{ ...run, ...override }]).state, 'unknown');
  }
  assert.equal(deploymentState(sha, [run]).state, 'success');
});
test('newest retry overrides earlier successful or failed runs', () => {
  assert.equal(deploymentState(sha, [run, { ...run, id: 2, status: 'in_progress', conclusion: null }]).state, 'pending');
  assert.equal(deploymentState(sha, [{ ...run, id: 2, conclusion: 'failure' }, run]).state, 'failure');
});
test('absent, skipped, neutral and unknown conclusions never claim success', () => {
  assert.equal(deploymentState(sha, []).state, 'unknown');
  for (const conclusion of ['skipped', 'neutral', null, 'future-result']) assert.equal(deploymentState(sha, [{ ...run, conclusion }]).state, 'unknown');
});
test('failed, timed out and cancelled deploys surface failure', () => {
  for (const conclusion of ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale']) assert.equal(deploymentState(sha, [{ ...run, conclusion }]).state, 'failure');
});
test('only links to the exact Cloudflare dashboard and project are allowed', () => {
  for (const url of ['javascript:alert(1)', 'https://dash.cloudflare.com.evil.test/?to=/pages/view/bathos-web/a', 'https://dash.cloudflare.com/?to=/pages/view/bathos-web-evil/a', undefined]) assert.equal(projectURL(url), false);
  assert.equal(projectURL(run.details_url), true);
});

const vm = require('node:vm');
const fs = require('node:fs');
function browserHarness() {
  const elements = {};
  const events = {};
  const timers = new Map();
  let now = 1_000_000;
  let nextTimer = 1;
  function element() {
    return { dataset: {}, textContent: '', setAttribute() {}, appendChild() {}, addEventListener(name, handler) { this[name] = handler; },
      set innerHTML(value) { for (const id of ['git-save-status', 'deployment-status', 'deployment-refresh']) elements[id] = element(); } };
  }
  elements['admin-shell'] = { insertAdjacentElement(position, panel) { assert.equal(position, 'afterend'); elements.panel = panel; } };
  const backend = { token: 'test-credential', deleteFiles: () => Promise.resolve('deleted') };
  const factory = { init: () => backend };
  let responses = [];
  let requests = 0;
  const context = {
    URL, Date: { now: () => now },
    document: { hidden: false, createElement: element, getElementById: id => elements[id], body: { prepend() {} } },
    CMS: { getBackend: () => factory, registerEventListener: ({ name, handler }) => { events[name] = handler; } },
    setTimeout: (handler, delay) => { const id = nextTimer++; timers.set(id, { handler, due: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => { requests++; assert.equal(options.headers.Authorization, 'Bearer test-credential'); const body = await responses.shift(); return { ok: true, json: async () => body }; },
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/admin/publishing.js'), 'utf8'), context);
  factory.init();
  return {
    elements, events, backend,
    responses: values => { responses = values; },
    requests: () => requests,
    advance(ms) { now += ms; for (const [id, item] of [...timers]) if (item.due <= now) { timers.delete(id); item.handler(); } },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('save immediately invalidates previous success and checks after throttle', async () => {
  const browser = browserHarness();
  browser.responses([{ sha }, { check_runs: [run] }]);
  browser.elements['deployment-refresh'].click();
  await settle();
  assert.equal(browser.elements.panel.dataset.state, 'success');
  browser.events.postSave();
  assert.equal(browser.elements.panel.dataset.state, 'pending');
  assert.match(browser.elements['deployment-status'].textContent, /not yet been checked/);
  assert.equal(browser.requests(), 2);
  const newer = 'c'.repeat(40);
  browser.responses([{ sha: newer }, { check_runs: [{ ...run, head_sha: newer, conclusion: 'failure' }] }]);
  browser.advance(60000);
  await settle();
  assert.equal(browser.requests(), 4);
  assert.equal(browser.elements.panel.dataset.state, 'failure');
  assert.match(browser.elements['deployment-status'].textContent, /ccccccc/);
});
test('in-flight older success cannot overwrite a new save status', async () => {
  const browser = browserHarness();
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  browser.responses([{ sha }, pending]);
  browser.elements['deployment-refresh'].click();
  await settle();
  browser.events.postSave();
  finish({ check_runs: [run] });
  await settle();
  assert.equal(browser.elements.panel.dataset.state, 'pending');
  assert.match(browser.elements['deployment-status'].textContent, /not yet been checked/);
});
test('successful deletion invalidates build status; signed-out checks make no API requests', async () => {
  const browser = browserHarness();
  browser.backend.token = null;
  browser.elements['deployment-refresh'].click();
  await settle();
  assert.equal(browser.requests(), 0);
  await browser.backend.deleteFiles(['content/post.md']);
  assert.match(browser.elements['git-save-status'].textContent, /Deletion saved to Git/);
  assert.equal(browser.requests(), 0);
});
