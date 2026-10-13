const encoder = new TextEncoder();
const validSha = sha => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha);
export const validOperation = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const encode = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));
const pending = message => ({ state: 'pending', message });
export class PublicationFailure extends Error {}
const denied = () => { throw new PublicationFailure('This publishing request changed or needs attention in GitHub. Your draft is kept.'); };
async function key(env) {
  const bytes = decode(env.SESSION_SECRET || '');
  if (bytes.length !== 32) throw Error('Invalid publication configuration');
  const material = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('bathos-publication-v1'), info: encoder.encode('publication-receipt-signing') }, material, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
}
export async function signPublication(env, claims) {
  const payload = encode(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await key(env), encoder.encode(`bathos-publication-v1.${payload}`));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function verifyPublication(env, receipt) {
  try {
    if (typeof receipt !== 'string' || receipt.length > 4096) return null;
    const [payload, signature, extra] = receipt.split('.');
    if (extra !== undefined || !await crypto.subtle.verify('HMAC', await key(env), decode(signature), encoder.encode(`bathos-publication-v1.${payload}`))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    return claims.version === 1 && Number.isFinite(claims.expires) && claims.expires > Date.now() ? claims : null;
  } catch { return null; }
}
async function digest(value, algorithm = 'SHA-256') {
  return Array.from(new Uint8Array(await crypto.subtle.digest(algorithm, value)), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function blobSha(content) {
  const bytes = Uint8Array.from(atob(content), character => character.charCodeAt(0));
  const prefix = encoder.encode(`blob ${bytes.length}\0`), value = new Uint8Array(prefix.length + bytes.length);
  value.set(prefix); value.set(bytes, prefix.length);
  return digest(value, 'SHA-1');
}
async function optional(github, path) {
  try { return await github(path); } catch (error) { if (error.status === 404) return null; throw error; }
}
async function validateScope(repository, login, pull, claims, github) {
  if (pull.user?.login !== login || pull.base?.ref !== 'main' || pull.base?.repo?.full_name !== repository || pull.head?.repo?.full_name !== repository || pull.head?.ref !== claims.branch || pull.changed_files !== 1 || !validSha(pull.head?.sha)) denied();
  const files = await github(`/pulls/${pull.number}/files?per_page=100`);
  if (!Array.isArray(files) || files.length !== 1 || files[0].filename !== `content/${claims.target}.md` || files[0].sha !== claims.blob || files[0].status !== claims.status) denied();
}
async function queuePublication(pull, github, graphql) {
  try {
    await graphql('mutation($id:ID!,$head:GitObjectID!){enablePullRequestAutoMerge(input:{pullRequestId:$id,expectedHeadOid:$head,mergeMethod:SQUASH}){pullRequest{number}}}', { id: pull.node_id, head: pull.head.sha });
    return true;
  } catch {
    // Exact-head REST merging still honors GitHub's required checks for admins.
    try { return (await github(`/pulls/${pull.number}/merge`, 'PUT', { merge_method: 'squash', sha: pull.head.sha })).merged === true; } catch { return false; }
  }
}
async function operationFromCommit(env, sha, github) {
  const commit = await github(`/git/commits/${sha}`);
  const marker = commit.message?.match(/\nBathos-Publication: ([A-Za-z0-9_.-]+)$/)?.[1];
  return marker ? verifyPublication(env, marker) : null;
}

export async function submitPublication(env, login, operationId, target, method, body, github, graphql) {
  const repository = env.GITHUB_REPOSITORY;
  if (!validOperation(operationId)) denied();
  const branch = `codex/publish-${login}-${target}-${operationId}`;
  const hash = await digest(encoder.encode(JSON.stringify({ target, method, body })));
  const blob = method === 'DELETE' ? body.sha : await blobSha(body.content);
  const status = method === 'DELETE' ? 'removed' : body.sha ? 'modified' : 'added';
  if (method === 'PUT' && body.sha === blob) {
    const file = await github(`/contents/content/${target}.md?ref=main`);
    if (file.sha !== blob) denied();
    const main = await github('/git/ref/heads/main');
    return { result: { commit: { sha: main.object.sha }, content: { sha: blob } } };
  }
  const owner = repository.split('/')[0];
  const matches = await github(`/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&base=main&state=all&per_page=100`);
  if (!Array.isArray(matches)) throw Error('Invalid publication listing');
  let pull = matches.filter(item => item.head?.ref === branch).sort((a,b) => a.number - b.number)[0];
  let ref = pull ? { object: { sha: pull.head.sha } } : await optional(github, `/git/ref/heads/${branch}`);
  if (!ref) {
    const base = await github('/git/ref/heads/main');
    if (!validSha(base.object?.sha)) throw Error('Invalid base revision');
    // A lost response recovers the same deterministic ref on the next retry.
    try { ref = await github('/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: base.object.sha }); }
    catch (error) { ref = await optional(github, `/git/ref/heads/${branch}`); if (!ref) throw error; }
  }
  if (!validSha(ref.object?.sha)) throw Error('Invalid publication revision');
  let claims = await operationFromCommit(env, ref.object.sha, github);
  if (claims && (claims.operationId !== operationId || claims.branch !== branch)) claims = null;
  if (!claims && pull) {
    const commits = await github(`/commits?sha=${pull.head.sha}&per_page=100`);
    for (const commit of commits) {
      const marker = commit.commit?.message?.match(/\nBathos-Publication: ([A-Za-z0-9_.-]+)$/)?.[1];
      if (marker) { const candidate = await verifyPublication(env, marker); if (candidate?.operationId === operationId && candidate.branch === branch) { claims = candidate; break; } }
    }
  }
  if (claims) {
    if (claims.repository !== repository || claims.login !== login || claims.operationId !== operationId || claims.branch !== branch || claims.hash !== hash || claims.blob !== blob || claims.status !== status || claims.target !== target) denied();
  } else {
    if (pull) denied();
    // Only an untouched ancestor of main can be an interrupted ref creation.
    const comparison = await github(`/compare/main...${ref.object.sha}`);
    if (!['identical','behind'].includes(comparison.status)) denied();
    claims = { version: 1, repository, login, operationId, branch, target, method, hash, blob, status, expires: Date.now() + 30 * 86400000 };
    const receipt = await signPublication(env, claims);
    try {
      const result = await github(`/contents/content/${target}.md`, method, { ...body, branch, message: `${body.message}\n\nBathos-Publication: ${receipt}` });
      ref = { object: { sha: result.commit.sha } };
    } catch (error) {
      const recovered = await optional(github, `/git/ref/heads/${branch}`);
      const signed = recovered && await operationFromCommit(env, recovered.object.sha, github);
      if (!signed) throw error;
      if (signed.hash !== hash || signed.branch !== branch || signed.repository !== repository || signed.login !== login || signed.operationId !== operationId || signed.blob !== blob || signed.target !== target || signed.status !== status) denied();
      claims = signed; ref = recovered;
    }
  }
  if (!pull) {
    // PR creation is reconciled by the exact head query on a retry.
    try { pull = await github('/pulls', 'POST', { title: body.message, head: branch, base: 'main', body: 'Authenticated Bathos publication. Required CI and Cloudflare checks must pass before auto-merge; no protection bypass.' }); }
    catch (error) {
      const recovered = await github(`/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&base=main&state=all&per_page=100`);
      pull = recovered.find(item => item.head?.ref === branch);
      if (!pull) throw error;
    }
  }
  pull = await github(`/pulls/${pull.number}`);
  await validateScope(repository, login, pull, claims, github);
  const receipt = await signPublication(env, { ...claims, number: pull.number, nodeId: pull.node_id });
  const queued = pull.merged || pull.state !== 'open' ? false : pull.auto_merge ? true : await queuePublication(pull, github, graphql);
  return { result: { commit: { sha: ref.object.sha }, content: method === 'DELETE' ? null : { sha: blob } }, publication: { number: pull.number, url: `https://github.com/${repository}/pull/${pull.number}`, queued, receipt } };
}

export async function publicationStatus(env, login, number, receipt, canUpdate, github, graphql, deploymentState) {
  const repository = env.GITHUB_REPOSITORY, claims = await verifyPublication(env, receipt);
  if (!claims || claims.repository !== repository || claims.login !== login || claims.number !== number || !validOperation(claims.operationId)) denied();
  const pull = await github(`/pulls/${number}`);
  if (pull.node_id !== claims.nodeId) denied();
  await validateScope(repository, login, pull, claims, github);
  if (pull.merged === true && validSha(pull.merge_commit_sha)) return { ...deploymentState(pull.merge_commit_sha, (await github(`/commits/${pull.merge_commit_sha}/check-runs?per_page=100`)).check_runs || []), commitSha: pull.merge_commit_sha, merged: true };
  if (pull.state !== 'open') return { state: 'failure', closed: true, message: 'Publication was closed without publishing. Your draft is kept.' };
  if (pull.mergeable_state === 'dirty') return { state: 'failure', message: 'The post changed while publishing. Resolve the conflict in GitHub before publishing.' };
  const runs = (await github(`/commits/${pull.head.sha}/check-runs?per_page=100`)).check_runs || [];
  const relevant = runs.filter(run => (run.name === 'Release checks' && run.app?.slug === 'github-actions') || (run.name === 'Cloudflare Pages' && run.app?.slug === 'cloudflare-workers-and-pages'));
  const newest = new Map();
  for (const run of relevant.sort((a,b) => Number(a.id) - Number(b.id))) newest.set(`${run.app.slug}:${run.name}`, run);
  if ([...newest.values()].some(run => run.status === 'completed' && ['failure','timed_out','cancelled','action_required','startup_failure'].includes(run.conclusion))) return { state: 'failure', message: 'Publishing checks failed. Your changes are saved in GitHub and your draft is kept.' };
  if (canUpdate && pull.mergeable_state === 'behind') {
    try { await github(`/pulls/${number}/update-branch`, 'PUT', { expected_head_sha: pull.head.sha }); } catch { return pending('Waiting for the latest site changes. Your publication is saved in GitHub.'); }
    return pending('Checking your post against the latest site changes…');
  }
  if (canUpdate && !pull.auto_merge) await queuePublication(pull, github, graphql);
  return pending('Your post is saved. Publishing automatically after checks pass…');
}
