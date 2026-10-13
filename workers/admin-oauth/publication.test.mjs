import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitPublication, publicationStatus } from './publication.mjs';
import { handleRequest } from './index.mjs';
import { sealSession, sessionCookie } from './manager.mjs';

const repository = 'sighmoan1/bathos', sha = 'a'.repeat(40), mergedSha = 'b'.repeat(40);
const pull = { number: 12, node_id: 'PR_12', user: { login: 'writer' }, base: { ref: 'main', repo: { full_name: repository } }, head: { ref: 'codex/publish-post-random', sha, repo: { full_name: repository } }, state: 'open', mergeable_state: 'blocked', auto_merge: { enabled_by: { login: 'writer' } } };
const deployment = (commit, runs) => ({ state: runs.length ? 'success' : 'unknown' });

test('create, update and delete stage only the selected content file and queue a protected PR', async () => {
  for (const method of ['PUT', 'DELETE']) {
    const calls = [], queries = [];
    const github = async (path, verb, body) => {
      calls.push({ path, verb, body });
      if (path === '/git/ref/heads/main') return { object: { sha } };
      if (path === '/git/refs') return { ref: body.ref };
      if (path === '/contents/content/post.md') return { content: { sha }, commit: { sha } };
      if (path === '/pulls') return pull;
      assert.fail(`Unexpected request ${path}`);
    };
    const { publication } = await submitPublication(repository, 'post', method, { message: 'Update post: post', sha }, github, async (query, variables) => queries.push({ query, variables }));
    assert.match(calls[1].body.ref, /^refs\/heads\/codex\/publish-post-/);
    assert.equal(calls[1].body.sha, sha);
    assert.equal(calls[2].verb, method);
    assert.notEqual(calls[2].body.branch, 'main');
    assert.equal(calls[3].body.base, 'main');
    assert.equal(calls[3].body.head, calls[2].body.branch);
    assert.equal(publication.queued, true);
    assert.deepEqual(queries[0].variables, { id: 'PR_12' });
    assert.ok(queries[0].query.includes('enablePullRequestAutoMerge'));
  }
});

test('conflicting content write cleans up the new branch and never opens a PR', async () => {
  const calls = [], error = new Error('conflict');
  await assert.rejects(submitPublication(repository, 'post', 'PUT', {}, async (path, method) => {
    calls.push({ path, method });
    if (path === '/git/ref/heads/main') return { object: { sha } };
    if (path === '/git/refs') return {};
    if (path.startsWith('/contents/')) throw error;
    if (path.startsWith('/git/refs/heads/codex/publish-')) return null;
    assert.fail(path);
  }, async () => assert.fail('auto-merge attempted')), error);
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.equal(calls.some(call => call.path === '/pulls'), false);
});

test('auto-merge failure never claims publication and exact-head fallback honors GitHub protection', async () => {
  const calls = [];
  const { publication } = await submitPublication(repository, 'post', 'PUT', {}, async (path, method, body) => {
    calls.push({ path, method, body });
    if (path === '/git/ref/heads/main') return { object: { sha } };
    if (path === '/git/refs') return {};
    if (path.startsWith('/contents/')) return { content: { sha }, commit: { sha } };
    if (path === '/pulls') return pull;
    if (path === '/pulls/12/merge') { assert.equal(body.sha, sha); throw Error('Required checks pending'); }
    assert.fail(path);
  }, async () => { throw Error('Not yet mergeable'); });
  assert.equal(publication.queued, false);
  assert.equal(calls.at(-1).path, '/pulls/12/merge');
});

test('publication status refuses other users, forks, bases and unmanaged branches without mutation', async () => {
  for (const change of [{ user: { login: 'stranger' } }, { head: { ...pull.head, repo: { full_name: 'stranger/bathos' } } }, { base: { ...pull.base, ref: 'other' } }, { head: { ...pull.head, ref: 'codex/unrelated' } }]) {
    let calls = 0;
    const result = await publicationStatus(repository, 'writer', 12, true, async path => { calls++; assert.equal(path, '/pulls/12'); return { ...pull, ...change }; }, async () => assert.fail('auto-merge attempted'), deployment);
    assert.equal(result.state, 'failure'); assert.equal(calls, 1);
  }
});

test('merged status tracks production merge SHA rather than the checked branch SHA', async () => {
  const calls = [];
  const result = await publicationStatus(repository, 'writer', 12, false, async path => {
    calls.push(path);
    return path === '/pulls/12' ? { ...pull, merged: true, merge_commit_sha: mergedSha } : { check_runs: [{}] };
  }, async () => assert.fail('mutation attempted'), deployment);
  assert.equal(result.state, 'success'); assert.equal(result.merged, true); assert.equal(result.commitSha, mergedSha);
  assert.equal(calls[1], `/commits/${mergedSha}/check-runs?per_page=100`);
});

test('failed trusted checks stop publication; unrelated checks do not control it', async () => {
  for (const app of ['github-actions', 'unrelated-app']) {
    const result = await publicationStatus(repository, 'writer', 12, false, async path => path === '/pulls/12' ? pull : { check_runs: [{ id: 1, name: 'Release checks', app: { slug: app }, status: 'completed', conclusion: 'failure' }] }, async () => assert.fail('mutation attempted'), deployment);
    assert.equal(result.state, app === 'github-actions' ? 'failure' : 'pending');
  }
});

test('successful retry supersedes an earlier failed check', async () => {
  const runs = ['failure', 'success'].map((conclusion, index) => ({ id: index + 1, name: 'Release checks', app: { slug: 'github-actions' }, status: 'completed', conclusion }));
  const result = await publicationStatus(repository, 'writer', 12, false, async path => path === '/pulls/12' ? pull : { check_runs: runs }, async () => assert.fail('mutation attempted'), deployment);
  assert.equal(result.state, 'pending');
});

test('GET is read-only; POST can update a stale branch against an exact revision', async () => {
  for (const canUpdate of [false, true]) {
    const calls = [];
    const result = await publicationStatus(repository, 'writer', 12, canUpdate, async (path, method, body) => {
      calls.push({ path, method, body });
      if (path === '/pulls/12') return { ...pull, mergeable_state: 'behind' };
      if (path.includes('/check-runs')) return { check_runs: [] };
      assert.equal(path, '/pulls/12/update-branch'); assert.equal(method, 'PUT'); assert.equal(body.expected_head_sha, sha); return {};
    }, async () => assert.fail('unexpected queue'), deployment);
    assert.equal(result.state, 'pending'); assert.equal(calls.length, canUpdate ? 3 : 2);
  }
});

test('publication polling requires a valid session and exact Origin for mutations', async () => {
  const env = { CMS_ORIGIN: 'https://bathos.org', OAUTH_ORIGIN: 'https://bathos.org', GITHUB_REPOSITORY: repository, SESSION_SECRET: btoa('12345678901234567890123456789012') };
  const cookie = sessionCookie(await sealSession(env, 'secret-token', 'writer')).split(';')[0];
  for (const [method, headers, expected] of [['GET', {}, 401], ['POST', { Cookie: cookie, Origin: 'https://evil.test' }, 403], ['POST', { Cookie: cookie }, 403]]) {
    const response = await handleRequest(new Request('https://bathos.org/api/publication/12', { method, headers }), env, () => assert.fail('GitHub must not be called'));
    assert.equal(response.status, expected);
  }
});
