// Shared GitHub branch/PR scaffolding for existing post serialization tests.
// Dedicated publication tests exercise failures and access boundaries separately.
export function withPublicationMocks(upstream) {
  return async (url, options) => {
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'a'.repeat(40) } });
    if (url.endsWith('/git/refs')) return Response.json({ ref: JSON.parse(options.body).ref });
    if (url.includes('/git/refs/heads/codex/publish-')) return new Response(null, { status: 204 });
    if (url.endsWith('/pulls') && options?.method === 'POST') return Response.json({ number: 123, node_id: 'PR_test', head: { sha: 'b'.repeat(40) } });
    if (url === 'https://api.github.com/graphql') return Response.json({ data: { enablePullRequestAutoMerge: { pullRequest: { number: 123 } } } });
    return upstream ? upstream(url, options) : fetch(url, options);
  };
}
