const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deploymentState, projectURL } = require('../public/admin/publishing.js');
const sha = 'a'.repeat(40);
const run = { id: 1, head_sha: sha, name: 'Cloudflare Pages', app: { slug: 'cloudflare-workers-and-pages' }, details_url: 'https://dash.cloudflare.com/?to=/account/pages/view/bathos-web/deployment', status: 'completed', conclusion: 'success' };
test('requires exact SHA, app, check name and Pages project', () => {
  for (const override of [{ head_sha: 'b'.repeat(40) }, { app: { slug: 'vercel' } }, { name: 'reader' }, { details_url: 'https://dash.cloudflare.com/?to=/account/pages/view/other/deployment' }]) {
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
