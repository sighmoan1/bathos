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
function popup(origin, result, successful) {
  const nonce = crypto.randomUUID();
  // Escaping prevents token/error data from terminating this inline script.
  const literal = v => JSON.stringify(v).replace(/</g, '\\u003c');
  const message = `authorization:github:${successful ? 'success' : 'error'}:${JSON.stringify(result)}`;
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Bathos sign in</title><p id="status">Completing sign in…</p><script nonce="${nonce}">
const origin=${literal(origin)}, message=${literal(message)};
if(window.opener){
 const reply=function(event){
  if(event.origin!==origin||event.source!==window.opener||event.data!=="authorizing:github")return;
  window.removeEventListener("message",reply);
  window.opener.postMessage(message,origin);
  document.getElementById("status").textContent="Return to the editor to continue.";
 };
 window.addEventListener("message",reply);
 window.opener.postMessage("authorizing:github",origin);
 setTimeout(function(){window.removeEventListener("message",reply);document.getElementById("status").textContent="Sign in timed out. Close this window and try again from the editor.";},60000);
}else{document.getElementById("status").textContent="Open sign in from the Bathos editor.";}
</script></html>`;
  return new Response(html, { headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie('', 0), 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'` } });
}
export async function handleRequest(request, env, upstream = fetch) {
  const url = new URL(request.url);
  if (!['/api/auth', '/api/login', '/api/callback'].includes(url.pathname)) return manageRequest(request, env, upstream);
  if (request.method !== 'GET') return text('Method not allowed', 405);
  if (!['/api/auth', '/api/login', '/api/callback'].includes(url.pathname)) return text('Not found', 404);
  let origin;
  try {
    origin = new URL(env.CMS_ORIGIN).origin;
    if (origin !== env.CMS_ORIGIN || !origin.startsWith('https://') || env.OAUTH_ORIGIN !== new URL(env.OAUTH_ORIGIN).origin || url.origin !== env.OAUTH_ORIGIN) return text('Invalid authentication configuration', 503);
  } catch { return text('Authentication is not configured', 503); }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_REPOSITORY) return text('Authentication is not configured', 503);
  const callback = `${env.OAUTH_ORIGIN}/api/callback`;
  if (['/api/auth', '/api/login'].includes(url.pathname)) {
    const manage = url.pathname === '/api/login';
    if (manage && !env.SESSION_SECRET) return text('Post management is not configured', 503);
    if (!manage && url.searchParams.get('provider') !== 'github') return text('Unsupported provider', 400);
    if (!manage && url.searchParams.get('site_id') !== new URL(origin).hostname) return text('Invalid editor origin', 400);
    const state = random();
    const verifier = random();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const authorization = new URL('https://github.com/login/oauth/authorize');
    authorization.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, scope: 'repo', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
    return new Response(null, { status: 302, headers: { ...baseHeaders, Location: authorization.href, 'Set-Cookie': cookie(encode({ state, verifier, flow: manage ? 'manage' : 'decap', expires: Date.now() + TTL * 1000 })) } });
  }
  const saved = decode((request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1));
  if (!saved || typeof saved.verifier !== 'string' || !Number.isFinite(saved.expires) || saved.expires < Date.now() || !(await equal(saved.state, url.searchParams.get('state')))) return text('Invalid or expired sign-in state. Start again from the editor.', 400, true);
  const manage = saved.flow === 'manage';
  const managedError = reason => new Response(null, { status: 303, headers: { ...baseHeaders, Location: `${origin}/manage/?auth_error=${reason}`, 'Set-Cookie': cookie('', 0) } });
  if (manage && url.searchParams.has('error')) return managedError('denied');
  if (url.searchParams.has('error')) return popup(origin, { message: 'GitHub sign in was cancelled or denied.' }, false);
  const code = url.searchParams.get('code');
  if (!code) return text('Missing authorization code', 400, true);
  try {
    const exchange = await upstream('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, code_verifier: saved.verifier, redirect_uri: callback }), signal: AbortSignal.timeout(10000),
    });
    const token = await exchange.json();
    if (!exchange.ok || typeof token.access_token !== 'string' || token.error) throw new Error('exchange');
    const repository = await upstream(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'bathos-admin-oauth', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(10000),
    });
    const access = await repository.json();
    if (!repository.ok || access.permissions?.push !== true) return manage ? managedError('permission') : popup(origin, { message: 'Your GitHub account does not have write access to this repository.' }, false);
    if (manage) {
      const userResponse = await upstream('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'bathos-post-manager', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(10000) });
      const user = await userResponse.json();
      if (!userResponse.ok || typeof user.login !== 'string') throw Error('user');
      const response = new Response(null, { status: 303, headers: { ...baseHeaders, Location: `${origin}/manage/` } });
      response.headers.append('Set-Cookie', cookie('', 0));
      response.headers.append('Set-Cookie', sessionCookie(await sealSession(env, token.access_token, user.login)));
      return response;
    }
    return popup(origin, { token: token.access_token, provider: 'github' }, true);
  } catch {
    // Never log OAuth codes, tokens, request URLs or upstream response bodies.
    console.error(JSON.stringify({ event: 'oauth_failed' }));
    if (manage) return managedError('failed');
    return popup(origin, { message: 'Sign in failed. Try again from the editor.' }, false);
  }
}
export default { fetch(request, env) { return handleRequest(request, env); } };
