import { createHash } from 'node:crypto';
export const operationId = '11111111-1111-4111-8111-111111111111';
export function withPublicationMocks(upstream) {
  let branch, write, commitSha = 'b'.repeat(40);
  const pull = () => ({ number: 123, node_id: 'PR_test', user: { login: 'writer' }, changed_files: 1, state: 'open', base: { ref: 'main', repo: { full_name: 'sighmoan1/bathos' } }, head: { ref: branch, sha: commitSha, repo: { full_name: 'sighmoan1/bathos' } } });
  return async (url, options) => {
    if (url.includes('/pulls?head=')) return Response.json([]);
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'a'.repeat(40) } });
    if (url.includes('/git/ref/heads/codex/publish-')) return write ? Response.json({ object: { sha: commitSha } }) : Response.json({}, { status: 404 });
    if (url.endsWith('/git/refs')) { branch = JSON.parse(options.body).ref.slice('refs/heads/'.length); return Response.json({ object: { sha: 'a'.repeat(40) } }); }
    if (url.includes('/git/commits/')) return Response.json({ message: write?.message || 'Existing main commit' });
    if (url.includes('/compare/main...')) return Response.json({ status: 'identical' });
    if (url.endsWith('/pulls') && options?.method === 'POST') return Response.json(pull());
    if (url.endsWith('/pulls/123')) return Response.json(pull());
    if (url.endsWith('/pulls/123/files?per_page=100')) {
      const bytes = write.content ? Buffer.from(write.content, 'base64') : null;
      const sha = bytes ? createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') : write.sha;
      const target = branch.slice('codex/publish-writer-'.length, -(operationId.length + 1));
      return Response.json([{ filename: `content/${target}.md`, sha, status: bytes ? write.sha ? 'modified' : 'added' : 'removed' }]);
    }
    if (url === 'https://api.github.com/graphql') return Response.json({ data: { enablePullRequestAutoMerge: { pullRequest: { number: 123 } } } });
    const result = upstream ? await upstream(url, options) : await fetch(url, options);
    if (result.ok && options && ['PUT','DELETE'].includes(options.method) && url.includes('/contents/content/')) { write = JSON.parse(options.body); commitSha = (await result.clone().json()).commit.sha; }
    return result;
  };
}
export async function handleTestRequest(actual, request, env, upstream) {
  if (new URL(request.url).pathname.startsWith('/api/posts') && ['POST','PUT','DELETE'].includes(request.method)) {
    try { const data = await request.clone().json(); request = new Request(request, { body: JSON.stringify({ ...data, operationId }) }); } catch {}
  }
  return actual(request, env, withPublicationMocks(upstream));
}
