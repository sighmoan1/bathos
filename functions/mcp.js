import { handleMcp } from '../workers/mcp/handler.mjs';

export function onRequest({ request, env }) {
  async function asset(path) {
    const response = await env.ASSETS.fetch(new URL(path, request.url));
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Published export unavailable');
    }
    return response.json();
  }
  return handleMcp(request, () => asset('/agent-posts.json'), { loadBrain: () => asset('/brain.json') });
}
