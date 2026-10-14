import { parse, stringify } from 'yaml';
import { submitPublication, publicationStatus, validOperation, PublicationFailure } from './publication.mjs';
export const SESSION_COOKIE = '__Host-bathos-session';
const AGE = 7 * 86400, LIMIT = 128 * 1024;
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
// Bind sessions to the public-only OAuth policy. Old broad-scope cookies must
// require reauthorization even when the deployment preserves SESSION_SECRET.
const sessionContext = env => encoder.encode(`${env.CMS_ORIGIN}|oauth-public-repo-v1`);
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const json = (data, status = 200, extra = {}) => Response.json(data, { status, headers: { ...headers, ...extra } });
export const sessionCookie = (value, age = AGE) => `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const bytes64 = bytes => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
const from64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const url64 = bytes => bytes64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unurl64 = value => from64(value.replace(/-/g, '+').replace(/_/g, '/'));
async function key(env) {
  const bytes = from64(env.SESSION_SECRET || '');
  if (bytes.length !== 32) throw Error('session configuration');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function sealSession(env, token, login, expires = Date.now() + AGE * 1000) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: sessionContext(env) }, await key(env), encoder.encode(JSON.stringify({ token, login, expires })));
  return `${url64(iv)}.${url64(new Uint8Array(encrypted))}`;
}
async function session(request, env) {
  try {
    const value = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    if (!value || value.length > 4096) return null;
    const parts = value.split('.');
    if (parts.length !== 2) return null;
    const saved = JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unurl64(parts[0]), additionalData: sessionContext(env) }, await key(env), unurl64(parts[1]))));
    return typeof saved.token === 'string' && saved.token.length > 0 && typeof saved.login === 'string' && Number.isFinite(saved.expires) && saved.expires > Date.now() ? saved : null;
  } catch { return null; }
}
class Failure extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const fail = (status, code, message) => { throw new Failure(status, code, message); };
const validSlug = slug => typeof slug === 'string' && slug.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
// Existing public URLs are case-sensitive. New filenames still use lowercase.
const validExistingSlug = slug => typeof slug === 'string' && slug.length <= 100 && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(slug);
const validSha = sha => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha);
export function replyTargets(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(400, 'invalid_post', 'Reply URLs must be a list of absolute HTTP(S) URLs.');
  return [...new Set(value.map(target => {
    if (typeof target !== 'string' || target.trim() !== target || /[\u0000-\u0020\u007f]/.test(target)) fail(400, 'invalid_post', 'Reply URLs must be absolute HTTP(S) URLs without whitespace.');
    let url;
    try { url = new URL(target); } catch { fail(400, 'invalid_post', 'Reply URLs must be absolute HTTP(S) URLs.'); }
    if (!/^https?:\/\//i.test(target) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail(400, 'invalid_post', 'Reply URLs must be absolute HTTP(S) URLs without credentials.');
    return url.href;
  }))];
}
function fields(data, slug) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !validExistingSlug(slug)) fail(400, 'invalid_post', 'Use a filename containing lowercase letters, numbers and hyphens.');
  if (Object.keys(data).some(k => !['slug','title','description','date','tags','body','sha','inReplyTo'].includes(k)) || (data.slug !== undefined && data.slug !== slug)) fail(400, 'invalid_post', 'Unexpected post fields.');
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 300 || typeof data.description !== 'string' || !data.description.trim() || data.description.length > 2000 || typeof data.body !== 'string' || !data.body.trim() || encoder.encode(data.body).length > 100000 || typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(`${data.date}T00:00:00Z`)) || new Date(`${data.date}T00:00:00Z`).toISOString().slice(0, 10) !== data.date || !Array.isArray(data.tags) || data.tags.length > 30 || data.tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 100)) fail(400, 'invalid_post', 'Provide a title, description, valid date, tags and Markdown body.');
  return { slug, title: data.title, description: data.description, date: data.date, tags: data.tags, body: data.body, ...(data.inReplyTo !== undefined ? { inReplyTo: replyTargets(data.inReplyTo) } : {}) };
}
export function parsePost(content, slug, sha) {
  if (encoder.encode(content).length > LIMIT) fail(422, 'invalid_content', 'This post is too large to edit.');
  const match = content.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) fail(422, 'invalid_content', 'This post has invalid front matter.');
  const metadata = parse(match[1], { maxAliasCount: 0, uniqueKeys: true });
  return { ...fields({ ...metadata, body: match[2].replace(/^\r?\n/, '') }, slug), sha };
}
export function serializePost(post) {
  const { title, description, date, tags, body, inReplyTo } = post;
  const targets = replyTargets(inReplyTo);
  return `---\n${stringify({ title, description, date, tags, ...(targets.length ? { inReplyTo: targets } : {}) }, { lineWidth: 0 })}---\n\n${body}`;
}
async function requestBody(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail(415, 'invalid_json', 'Send JSON content.');
  if (Number(request.headers.get('Content-Length')) > LIMIT) fail(413, 'too_large', 'The post is too large.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'invalid_json', 'Send JSON content.');
  const chunks = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > LIMIT) { await reader.cancel(); fail(413, 'too_large', 'The post is too large.'); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(decoder.decode(bytes)); } catch { fail(400, 'invalid_json', 'Send valid JSON content.'); }
}
export function deploymentState(sha, runs) {
  const match = runs.filter(run => {
    let project = false;
    try { const url = new URL(run.details_url); project = url.origin === 'https://dash.cloudflare.com' && /\/pages\/view\/bathos-web(?:\/|$)/.test(url.searchParams.get('to') || url.pathname); } catch {}
    return run.head_sha === sha && run.name === 'Cloudflare Pages' && run.app?.slug === 'cloudflare-workers-and-pages' && Array.isArray(run.pull_requests) && run.pull_requests.length === 0 && !/Branch Preview URL/i.test(run.output?.summary || '') && project;
  }).sort((a,b) => Number(b.id) - Number(a.id))[0];
  if (!match) return { state: 'unknown', message: 'No deployment check found. This commit may not be live.' };
  const state = match.status !== 'completed' ? 'pending' : match.conclusion === 'success' ? 'success' : ['failure','timed_out','cancelled','action_required','startup_failure','stale'].includes(match.conclusion) ? 'failure' : 'unknown';
  const messages = { pending: 'Deployment is queued or building.', success: 'Deployment passed. Your changes are live.', failure: 'Deployment failed. Your changes are saved in Git; the site may show the previous version.', unknown: 'Deployment has no confirmed result. This commit may not be live.' };
  return { state, message: messages[state], url: match.details_url };
}
export async function manageRequest(request, env, upstream) {
  const url = new URL(request.url);
  try {
    if (url.origin !== env.CMS_ORIGIN || env.CMS_ORIGIN !== 'https://bathos.org' || env.OAUTH_ORIGIN !== env.CMS_ORIGIN || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '') || !env.SESSION_SECRET) return json({ error: 'Post management is not configured.', code: 'unavailable' }, 503);
    if (!['GET','POST','PUT','DELETE'].includes(request.method)) fail(405, 'method_not_allowed', 'Method not allowed.');
    if (request.method !== 'GET' && request.headers.get('Origin') !== env.CMS_ORIGIN) fail(403, 'origin_denied', 'Reload the editor before trying again.');
    const saved = await session(request, env);
    if (url.pathname === '/api/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    if (!saved) return json({ error: 'Sign in to manage posts.', code: 'unauthorized' }, 401, { 'Set-Cookie': sessionCookie('', 0) });
    if (url.pathname === '/api/session' && request.method === 'GET') return json({ authenticated: true, user: { login: saved.login } });
    const base = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}`;
    async function github(path, method = 'GET', body) {
      const result = await upstream(`${base}${path}`, { method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${saved.token}`, 'User-Agent': 'bathos-post-manager', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) fail(401, 'unauthorized', 'Your GitHub session cannot access this repository. Sign in again.');
        if (result.status === 404) fail(404, 'not_found', 'Post not found.');
        if (result.status === 409 || result.status === 422) fail(409, 'conflict', 'This post changed or the filename already exists. Your draft is kept; reload the post before saving again.');
        fail(502, 'upstream_failed', 'GitHub could not complete this request. Your draft is kept. Try again.');
      }
      return result.status === 204 ? null : result.json();
    }
    async function graphql(query, variables) {
      const result = await upstream('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${saved.token}`, 'User-Agent': 'bathos-post-manager', 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(10000) });
      const data = await result.json();
      if (!result.ok || data.errors?.length || !data.data?.enablePullRequestAutoMerge?.pullRequest) throw Error('Unable to queue publication');
      return data.data;
    }
    async function readPost(slug) {
      const file = await github(`/contents/content/${slug}.md?ref=main`);
      if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string' || !validSha(file.sha) || file.size > LIMIT) fail(422, 'invalid_content', 'This post cannot be read by the editor.');
      try { return parsePost(decoder.decode(from64(file.content.replace(/\s/g, ''))), slug, file.sha); } catch { fail(422, 'invalid_content', 'This post has invalid front matter and cannot be edited.'); }
    }
    if (url.pathname === '/api/posts' && request.method === 'GET') {
      const entries = await github('/contents/content?ref=main');
      if (!Array.isArray(entries)) fail(502, 'upstream_failed', 'GitHub returned an unexpected post listing.');
      const posts = [], warnings = [];
      // Bound concurrency to avoid exhausting Worker simultaneous connections.
      const files = entries.filter(file => file.type === 'file' && typeof file.name === 'string' && file.name.endsWith('.md'));
      for (let offset = 0; offset < files.length; offset += 4) {
        await Promise.all(files.slice(offset, offset + 4).map(async file => {
          const slug = file.name.slice(0, -3);
          if (!validExistingSlug(slug)) { warnings.push({ slug, message: 'This filename cannot be edited.' }); return; }
          try { const { body, ...post } = await readPost(slug); posts.push(post); } catch (error) { if (error.status !== 422) throw error; warnings.push({ slug, message: 'Invalid front matter; edit this post in GitHub.' }); }
        }));
      }
      posts.sort((a,b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
      return json({ posts, ...(warnings.length ? { warnings } : {}) });
    }
    const deployment = url.pathname.match(/^\/api\/deployment\/([a-f0-9]{40})$/);
    if (deployment && request.method === 'GET') return json(deploymentState(deployment[1], (await github(`/commits/${deployment[1]}/check-runs?per_page=100`)).check_runs || []));
    const publication = url.pathname.match(/^\/api\/publication\/([1-9][0-9]{0,8})$/);
    if (publication && ['GET','POST'].includes(request.method)) return json(await publicationStatus(env, saved.login, Number(publication[1]), request.headers.get('X-Bathos-Publication'), request.method === 'POST', github, graphql, deploymentState));
    const match = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
    const slug = match?.[1];
    if (match && !validExistingSlug(slug)) fail(400, 'invalid_slug', 'Invalid post filename.');
    if (match && request.method === 'GET') return json(await readPost(slug));
    if ((url.pathname === '/api/posts' && request.method === 'POST') || (match && ['PUT','DELETE'].includes(request.method))) {
      const input = await requestBody(request);
      const { operationId, ...data } = input || {};
      if (!validOperation(operationId)) fail(400, 'invalid_operation', 'Reload the post manager before saving. Your draft is kept.');
      if (request.method !== 'POST' && (!data || !validSha(data.sha))) fail(400, 'missing_sha', 'Reload the post before updating or deleting it.');
      const target = request.method === 'POST' ? data?.slug : slug;
      if (!(request.method === 'POST' ? validSlug(target) : validExistingSlug(target))) fail(400, 'invalid_slug', 'Use lowercase letters, numbers and hyphens for the filename.');
      if (request.method === 'DELETE') {
        if (Object.keys(data).some(k => k !== 'sha')) fail(400, 'invalid_post', 'Unexpected deletion fields.');
        const { result, publication } = await submitPublication(env, saved.login, operationId, target, 'DELETE', { message: `Delete post: ${target}`, sha: data.sha }, github, graphql);
        return json({ commitSha: result.commit.sha, publication });
      }
      if (request.method === 'POST' && data.sha !== undefined) fail(400, 'invalid_post', 'New posts cannot include a revision.');
      const post = fields(data, target);
      const { result, publication } = await submitPublication(env, saved.login, operationId, target, 'PUT', { message: `${request.method === 'POST' ? 'Create' : 'Update'} post: ${target}`, content: bytes64(encoder.encode(serializePost(post))), ...(request.method === 'PUT' ? { sha: data.sha } : {}) }, github, graphql);
      return json({ post: { ...post, sha: result.content.sha }, commitSha: result.commit.sha, publication }, request.method === 'POST' ? 201 : 200);
    }
    fail(404, 'not_found', 'Not found.');
  } catch (error) {
    if (error instanceof PublicationFailure) return json({ error: error.message, code: 'publication_conflict' }, 409);
    if (error instanceof Failure) return json({ error: error.message, code: error.code }, error.status, error.status === 401 ? { 'Set-Cookie': sessionCookie('', 0) } : {});
    return json({ error: 'The request could not be completed. Your draft is kept. Try again.', code: 'upstream_failed' }, 502);
  }
}
