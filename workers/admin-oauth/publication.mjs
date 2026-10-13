const validSha = sha => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha);
const pending = message => ({ state: 'pending', message });

export async function queuePublication(repository, pull, github, graphql) {
  // Auto-merge is enforced by GitHub's required checks, including for admins.
  try {
    await graphql('mutation($id:ID!){enablePullRequestAutoMerge(input:{pullRequestId:$id,mergeMethod:SQUASH}){pullRequest{number}}}', { id: pull.node_id });
    return true;
  } catch {
    // When all checks have already passed, GitHub may decline auto-merge.
    // The REST merge still honors branch protection and the exact head SHA.
    try {
      const result = await github(`/pulls/${pull.number}/merge`, 'PUT', { merge_method: 'squash', sha: pull.head.sha });
      return result.merged === true;
    } catch { return false; }
  }
}

export async function submitPublication(repository, target, method, body, github, graphql) {
  const base = await github('/git/ref/heads/main');
  if (!validSha(base.object?.sha)) throw Error('Invalid base revision');
  const branch = `codex/publish-${target}-${crypto.randomUUID()}`;
  await github('/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: base.object.sha });
  let result;
  try {
    result = await github(`/contents/content/${target}.md`, method, { ...body, branch });
  } catch (error) {
    try { await github(`/git/refs/heads/${branch}`, 'DELETE'); } catch {}
    throw error;
  }
  const pull = await github('/pulls', 'POST', {
    title: body.message, head: branch, base: 'main',
    body: 'Submitted by the authenticated Bathos post manager. Publication must pass the required CI and Cloudflare checks. No protection bypass is permitted.'
  });
  if (!Number.isSafeInteger(pull.number) || pull.number < 1 || typeof pull.node_id !== 'string' || !validSha(pull.head?.sha)) throw Error('Invalid publication response');
  const queued = await queuePublication(repository, pull, github, graphql);
  return { result, publication: { number: pull.number, url: `https://github.com/${repository}/pull/${pull.number}`, queued } };
}

export async function publicationStatus(repository, login, number, canUpdate, github, graphql, deploymentState) {
  const pull = await github(`/pulls/${number}`);
  // The status endpoint cannot be used to auto-merge unrelated or fork PRs.
  if (pull.user?.login !== login || pull.base?.ref !== 'main' || pull.base?.repo?.full_name !== repository || pull.head?.repo?.full_name !== repository || !/^codex\/publish-[A-Za-z0-9-]+$/.test(pull.head?.ref || '')) {
    return { state: 'failure', message: 'This publication does not belong to your post manager.' };
  }
  if (pull.merged === true && validSha(pull.merge_commit_sha)) {
    return { ...deploymentState(pull.merge_commit_sha, (await github(`/commits/${pull.merge_commit_sha}/check-runs?per_page=100`)).check_runs || []), commitSha: pull.merge_commit_sha, merged: true };
  }
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
  if (canUpdate && !pull.auto_merge) await queuePublication(repository, pull, github, graphql);
  return pending('Your post is saved. Publishing automatically after checks pass…');
}
