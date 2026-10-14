import { manageRequest, sealSession, sessionCookie } from './manager.mjs';
const COOKIE = '__Host-bathos-oauth';
const TTL = 600;
const baseHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const cookie = (value, age = TTL) => `${COOKIE}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const random = () => crypto.randomUUID() + crypto.randomUUID();
const encode = (value) => btoa(JSON.stringify(value));
function decode(value) { try { return JSON.parse(atob(value)); } catch { return null; } }
async function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashes = await Promise.all([a, b].map(v => crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
  const left = new Uint8Array(hashes[0]), right = new Uint8Array(hashes[1]);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
function text(message, status, clear = false) {
  return new Response(message, { status, headers: { ...baseHeaders, ...(clear ? { 'Set-Cookie': cookie('', 0) } : {}) } });
}
export async function handleRequest(request, env, upstream = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/api/auth') return text('Legacy authentication has been retired. Sign in at /manage/.', 410, true);
  if (!['/api/login', '/api/callback'].includes(url.pathname)) return manageRequest(request, env, upstream);
  if (request.method !== 'GET') return text('Method not allowed', 405);
  let origin;
  try {
    origin = new URL(env.CMS_ORIGIN).origin;
    if (origin !== env.CMS_ORIGIN || !origin.startsWith('https://') || env.OAUTH_ORIGIN !== new URL(env.OAUTH_ORIGIN).origin || url.origin !== env.OAUTH_ORIGIN) return text('Invalid authentication configuration', 503);
  } catch { return text('Authentication is not configured', 503); }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_REPOSITORY) return text('Authentication is not configured', 503);
  const callback = `${env.OAUTH_ORIGIN}/api/callback`;
  if (url.pathname === '/api/login') {
    if (!env.SESSION_SECRET) return text('Post management is not configured', 503);
    const state = random();
    const verifier = random();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const authorization = new URL('https://github.com/login/oauth/authorize');
    authorization.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, scope: 'public_repo', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
    return new Response(null, { status: 302, headers: { ...baseHeaders, Location: authorization.href, 'Set-Cookie': cookie(encode({ state, verifier, flow: 'manage', expires: Date.now() + TTL * 1000 })) } });
  }
  const saved = decode((request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1));
  if (!saved || saved.flow !== 'manage' || typeof saved.verifier !== 'string' || !Number.isFinite(saved.expires) || saved.expires < Date.now() || !(await equal(saved.state, url.searchParams.get('state')))) return text('Invalid or expired sign-in state. Start again from the editor.', 400, true);
  const managedError = reason => new Response(null, { status: 303, headers: { ...baseHeaders, Location: `${origin}/manage/?auth_error=${reason}`, 'Set-Cookie': cookie('', 0) } });
  if (url.searchParams.has('error')) return managedError('denied');
  const code = url.searchParams.get('code');
  if (!code) return text('Missing authorization code', 400, true);
  try {
    const exchange = await upstream('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, code_verifier: saved.verifier, redirect_uri: callback }), signal: AbortSignal.timeout(10000),
    });
    const token = await exchange.json();
    if (!exchange.ok || typeof token.access_token !== 'string' || token.error) throw new Error('exchange');
    // Existing app grants may retain broader scopes despite the narrower request.
    // Fail closed until the owner revokes the old grant and reauthorizes.
    const scopes = typeof token.scope === 'string' ? token.scope.split(/[\s,]+/).filter(Boolean) : [];
    if (scopes.length !== 1 || scopes[0] !== 'public_repo') return managedError('scope');
    const repository = await upstream(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'bathos-admin-oauth', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(10000),
    });
    const access = await repository.json();
    if (!repository.ok || access.permissions?.push !== true) return managedError('permission');
    const userResponse = await upstream('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'bathos-post-manager', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(10000) });
    const user = await userResponse.json();
    if (!userResponse.ok || typeof user.login !== 'string') throw Error('user');
    const response = new Response(null, { status: 303, headers: { ...baseHeaders, Location: `${origin}/manage/` } });
    response.headers.append('Set-Cookie', cookie('', 0));
    response.headers.append('Set-Cookie', sessionCookie(await sealSession(env, token.access_token, user.login)));
    return response;
  } catch {
    // Never log OAuth codes, tokens, request URLs or upstream response bodies.
    console.error(JSON.stringify({ event: 'oauth_failed' }));
    return managedError('failed');
  }
}
export default { fetch(request, env) { return handleRequest(request, env); } };
