import { handleMcp } from '../workers/mcp/handler.mjs';

export function onRequest({ request, env }) {
  return handleMcp(request, async () => {
    const response = await env.ASSETS.fetch(new URL('/agent-posts.json', request.url));
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Article export unavailable');
    }
    return response.json();
  });
}
