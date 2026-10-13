import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { submitPublication, publicationStatus, verifyPublication, signPublication, PublicationFailure } from './publication.mjs';
import { handleRequest } from './index.mjs';
import { sealSession, sessionCookie } from './manager.mjs';
const env = { CMS_ORIGIN: 'https://bathos.org', OAUTH_ORIGIN: 'https://bathos.org', GITHUB_REPOSITORY: 'sighmoan1/bathos', SESSION_SECRET: btoa('12345678901234567890123456789012') };
const id = '11111111-1111-4111-8111-111111111111', base = 'a'.repeat(40), merge = 'd'.repeat(40);
const body = { message: 'Create post: post', content: Buffer.from('A safe post 🍰').toString('base64') };
const error = status => Object.assign(Error('Simulated lost upstream response'), { status });
const deployment = (sha, runs) => ({ state: runs.length ? 'success' : 'unknown' });
function githubModel(fault = '') {
  const state = { ref: null, messages: new Map([[base, 'Existing main commit']]), pull: null, files: [], checks: [], creates: 0, writes: 0, pulls: 0, queues: 0, updates: 0, calls: [], visible: true };
  let failed = false;
  function lose(stage) { if (!failed && fault.startsWith(stage)) { failed = true; if (fault.endsWith('-late')) state.visible = false; throw error(502); } }
  const github = async (path, method = 'GET', data) => {
    state.calls.push({ path, method, data });
    if (path.startsWith('/pulls?head=')) return state.pull && state.visible ? [state.pull] : [];
    if (path === '/git/ref/heads/main') return { object: { sha: base } };
    if (path.startsWith('/git/ref/heads/codex/publish-')) { if (!state.ref || !state.visible) throw error(404); return { object: { sha: state.ref } }; }
    if (path === '/git/refs') { state.creates++; state.branch = data.ref.slice(11); state.ref = base; lose('branch'); return { object: { sha: state.ref } }; }
    if (path.startsWith('/git/commits/')) return { message: state.messages.get(path.split('/').pop()) || 'Unsigned unrelated commit' };
    if (path.startsWith('/compare/main...')) return { status: state.comparison || 'identical' };
    if (path.startsWith('/contents/content/post.md') && method !== 'GET') {
      state.writes++; state.ref = 'b'.repeat(40); state.messages.set(state.ref, data.message);
      const bytes = data.content ? Buffer.from(data.content, 'base64') : null;
      const sha = bytes ? createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') : data.sha;
      state.files = [{ filename: 'content/post.md', sha, status: method === 'DELETE' ? 'removed' : data.sha ? 'modified' : 'added' }];
      lose('content'); return { content: bytes ? { sha } : null, commit: { sha: state.ref } };
    }
    if (path === '/pulls' && method === 'POST') {
      state.pulls++; state.pull = { number: 12, node_id: 'PR_12', changed_files: 1, user: { login: 'writer' }, state: 'open', mergeable_state: 'blocked', base: { ref: 'main', repo: { full_name: env.GITHUB_REPOSITORY } }, head: { ref: data.head, sha: state.ref, repo: { full_name: env.GITHUB_REPOSITORY } } };
      lose('pull'); return state.pull;
    }
    if (path === '/pulls/12') return state.pull;
    if (path === '/pulls/12/files?per_page=100') return state.files;
    if (path === '/pulls/12/merge') { assert.equal(data.sha, state.pull.head.sha); throw error(405); }
    if (path === '/pulls/12/update-branch') { assert.equal(data.expected_head_sha, state.pull.head.sha); state.updates++; return {}; }
    if (path.startsWith('/commits?sha=')) return [...state.messages].map(([sha,message]) => ({ sha, commit: { message } }));
    if (path.includes('/check-runs')) return { check_runs: state.checks };
    assert.fail(`Unexpected ${method} ${path}`);
  };
  const graphql = async (query, variables) => {
    assert.ok(query.includes('expectedHeadOid:$head')); assert.equal(variables.head, state.pull.head.sha);
    state.queues++; state.pull.auto_merge = { enabled_by: { login: 'writer' } }; lose('queue');
    return { enablePullRequestAutoMerge: { pullRequest: { number: 12 } } };
  };
  return { state, github, graphql };
}
const submit = (model, value = body, method = 'PUT') => submitPublication(env, 'writer', id, 'post', method, value, model.github, model.graphql);
const status = (model, publication, mutate = false, login = 'writer', number = 12, receipt = publication.receipt) => publicationStatus(env, login, number, receipt, mutate, model.github, model.graphql, deployment);

test('create, update and delete issue a scoped receipt and never write main', async () => {
  for (const [method,value] of [['PUT',body],['PUT',{...body,sha:base}],['DELETE',{message:'Delete post: post',sha:base}]]) {
    const model = githubModel(), result = await submit(model, value, method), claims = await verifyPublication(env, result.publication.receipt);
    assert.equal(model.state.creates, 1); assert.equal(model.state.writes, 1); assert.equal(model.state.pulls, 1); assert.equal(model.state.queues, 1);
    assert.equal(claims.number, 12); assert.equal(claims.nodeId, 'PR_12'); assert.equal(claims.target, 'post'); assert.equal(claims.login, 'writer'); assert.equal(claims.blob, model.state.files[0].sha);
    const write = model.state.calls.find(call => call.path.startsWith('/contents/'));
    assert.equal(write.data.branch, `codex/publish-writer-post-${id}`); assert.notEqual(write.data.branch, 'main');
    assert.match(write.data.message, /Bathos-Publication: /);
  }
});

test('lost responses at every mutation stage recover exactly one branch, write and PR', async () => {
  for (const fault of ['branch','content','pull','queue','branch-late','content-late','pull-late']) {
    const model = githubModel(fault);
    try { await submit(model); } catch (failure) { assert.equal(failure.status, 502); }
    model.state.visible = true;
    const recovered = await submit(model);
    assert.equal(recovered.publication.number, 12, fault); assert.equal(model.state.creates, 1, fault); assert.equal(model.state.writes, 1, fault); assert.equal(model.state.pulls, 1, fault); assert.equal(model.state.queues, 1, fault);
    assert.ok(await verifyPublication(env, recovered.publication.receipt));
  }
});

test('the same operation with changed content fails closed without another write or PR', async () => {
  const model = githubModel(); await submit(model);
  await assert.rejects(submit(model, {...body,content:Buffer.from('Different post').toString('base64')}), PublicationFailure);
  assert.equal(model.state.writes, 1); assert.equal(model.state.pulls, 1); assert.equal(model.state.queues, 1);
});

test('an unsigned preexisting publishing branch cannot introduce unrelated code', async () => {
  const model = githubModel(); model.state.ref = 'c'.repeat(40); model.state.comparison = 'ahead';
  await assert.rejects(submit(model), PublicationFailure); assert.equal(model.state.writes, 0); assert.equal(model.state.pulls, 0); assert.equal(model.state.queues, 0);
});

test('a fresh publication can follow a main commit containing an older valid receipt',async()=>{
  const first=githubModel();const prior=await submit(first);const previous=await verifyPublication(env,prior.publication.receipt);
  for(const method of ['PUT','DELETE']) {
    const model=githubModel();model.state.messages.set(base,`Previous publication\n\nBathos-Publication: ${await signPublication(env,{...previous,operationId:'22222222-2222-4222-8222-222222222222',branch:'codex/publish-writer-older'})}`);
    const result=await submit(model,method==='DELETE'?{message:'Delete post: post',sha:base}:body,method);
    assert.equal(result.publication.number,12);assert.equal(model.state.writes,1);assert.equal(model.state.pulls,1);
  }
});

test('tampered, expired and other-user or other-PR receipts are denied before GitHub calls', async () => {
  const model = githubModel(), result = await submit(model), claims = await verifyPublication(env, result.publication.receipt);
  for (const [login,number,receipt] of [['stranger',12,result.publication.receipt],['writer',13,result.publication.receipt],['writer',12,result.publication.receipt+'x'],['writer',12,await signPublication(env,{...claims,expires:Date.now()-1})]]) {
    const count = model.state.calls.length;
    await assert.rejects(status(model,result.publication,true,login,number,receipt),PublicationFailure);
    assert.equal(model.state.calls.length,count); assert.equal(model.state.queues,1);
  }
});

test('changed file scope, content, author or fork fails closed before any update or merge', async () => {
  for (const change of ['extra-file','wrong-file','changed-blob','wrong-author','fork']) {
    const model = githubModel(), {publication} = await submit(model);
    model.state.pull.auto_merge = null; model.state.pull.mergeable_state = 'behind';
    if (change==='extra-file') { model.state.ref='c'.repeat(40);model.state.pull.head.sha=model.state.ref;model.state.messages.set(model.state.ref,'Reconstructed head with extra code');model.state.pull.changed_files=2; model.state.files.push({filename:'.github/workflows/ci.yml'}); }
    if (change==='wrong-file') model.state.files[0].filename='workers/admin-oauth/index.mjs';
    if (change==='changed-blob') model.state.files[0].sha='e'.repeat(40);
    if (change==='wrong-author') model.state.pull.user.login='stranger';
    if (change==='fork') model.state.pull.head.repo.full_name='stranger/bathos';
    await assert.rejects(status(model,publication,true),PublicationFailure);
    assert.equal(model.state.queues,1,change); assert.equal(model.state.updates,0,change);
    // Retrying the original submission cannot bless changed PR content either.
    await assert.rejects(submit(model),PublicationFailure); assert.equal(model.state.writes,1,change);
  }
});

test('GET is read-only and POST updates only the validated exact head', async () => {
  const model=githubModel(),{publication}=await submit(model);model.state.pull.mergeable_state='behind';
  assert.equal((await status(model,publication)).state,'pending');assert.equal(model.state.updates,0);
  assert.equal((await status(model,publication,true)).state,'pending');assert.equal(model.state.updates,1);
});

test('merged publication follows the production merge SHA', async () => {
  const model=githubModel(),{publication}=await submit(model);model.state.pull.merged=true;model.state.pull.merge_commit_sha=merge;model.state.checks=[{}];
  const result=await status(model,publication);assert.equal(result.state,'success');assert.equal(result.commitSha,merge);
  assert.equal(model.state.calls.at(-1).path,`/commits/${merge}/check-runs?per_page=100`);
});

test('closed publication allows device draft recovery without another merge', async()=>{
  const model=githubModel(),{publication}=await submit(model);model.state.pull.state='closed';
  assert.equal((await status(model,publication,true)).closed,true);assert.equal(model.state.queues,1);
});

test('trusted failed checks stop mutation and their successful retry supersedes failure',async()=>{
  const model=githubModel(),{publication}=await submit(model);model.state.pull.auto_merge=null;
  model.state.checks=[{id:1,name:'Release checks',app:{slug:'github-actions'},status:'completed',conclusion:'failure'}];
  assert.equal((await status(model,publication,true)).state,'failure');assert.equal(model.state.queues,1);
  model.state.checks.push({...model.state.checks[0],id:2,conclusion:'success'});
  assert.equal((await status(model,publication,true)).state,'pending');assert.equal(model.state.queues,2);
});

test('publication transport requires authenticated cookies, exact Origin and a signed receipt',async()=>{
  const cookie=sessionCookie(await sealSession(env,'private-token','writer')).split(';')[0];
  for(const [method,headers,expected] of [['GET',{},401],['POST',{Cookie:cookie,Origin:'https://evil.test'},403],['POST',{Cookie:cookie},403],['POST',{Cookie:cookie,Origin:env.CMS_ORIGIN,'X-Bathos-Publication':'forged'},409]]) {
    const response=await handleRequest(new Request('https://bathos.org/api/publication/12',{method,headers}),env,()=>assert.fail('GitHub must not be called'));assert.equal(response.status,expected);
  }
});
