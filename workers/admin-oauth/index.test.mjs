import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from './index.mjs';
const env = { CMS_ORIGIN: 'https://bathos.org', OAUTH_ORIGIN: 'https://bathos.org', GITHUB_REPOSITORY: 'sighmoan1/bathos', GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-secret', SESSION_SECRET: btoa('12345678901234567890123456789012') };
async function start() {
 const response = await handleRequest(new Request('https://bathos.org/api/login'), env);
 return { response, cookie: response.headers.get('set-cookie').split(';')[0], state: new URL(response.headers.get('location')).searchParams.get('state') };
}
function callback(flow, suffix = '') { return new Request(`https://bathos.org/api/callback?state=${flow.state}&code=test-code${suffix}`, { headers: { Cookie: flow.cookie } }); }
test('OAuth uses public-only scope, PKCE, secure state and fixed callback', async () => {
 const {response} = await start();
 assert.equal(response.status,302);
 assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
 const url = new URL(response.headers.get('location'));
 assert.equal(url.searchParams.get('scope'),'public_repo');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('code_challenge').length,43);
 assert.equal(url.searchParams.get('redirect_uri'),'https://bathos.org/api/callback');
});
test('retired popup endpoint never redirects, exchanges or returns a token', async()=>{
 for(const method of ['GET','POST']) {
  const response=await handleRequest(new Request('https://bathos.org/api/auth?provider=github&site_id=bathos.org',{method}),env,()=>{throw Error('must not call');});
  assert.equal(response.status,410);assert.equal(response.headers.get('location'),null);
  assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
 }
});
test('rejects foreign origin, invalid configuration and non-GET', async () => {
 for(const [request, bindings, status] of [
 [new Request('https://evil.test/api/login'),env,503],
 [new Request('https://bathos.org/api/login'),{},503],
 [new Request('https://bathos.org/api/login'),{...env,OAUTH_ORIGIN:'https://bathos.org/path'},503],
 [new Request('https://bathos.org/api/login'),{...env,SESSION_SECRET:undefined},503],
 [new Request('https://bathos.org/api/login',{method:'POST'}),env,405],
 ]) assert.equal((await handleRequest(request,bindings)).status,status);
});
test('invalid, missing, expired or legacy state never exchanges a token', async () => {
 const flow=await start();
 const saved=JSON.parse(atob(flow.cookie.split('=')[1]));
 for(const request of [new Request('https://bathos.org/api/callback?state=x&code=x'),callback({...flow,state:'wrong'}),...[
  {...saved,expires:Date.now()-1},{...saved,flow:'decap'},{...saved,flow:undefined},
 ].map(value=>callback({...flow,cookie:`__Host-bathos-oauth=${btoa(JSON.stringify(value))}`}))]) {
  const response=await handleRequest(request,env,()=>{throw Error('must not call');});
  assert.equal(response.status,400);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
 }
});
test('cancelled authorization redirects without API calls', async () => {
 const flow=await start();
 const response=await handleRequest(callback(flow,'&error=access_denied'),env,()=>{throw Error('must not call');});
 assert.equal(response.status,303);assert.match(response.headers.get('location'),/auth_error=denied/);
});
test('broad, extra, missing or unknown token scopes cannot create a session',async()=>{
 for(const scope of ['repo','public_repo,repo','public_repo repo','public_repo\tuser','public_repo,user','',undefined]) {
  const flow=await start();let calls=0;
  const response=await handleRequest(callback(flow),env,async()=>{calls++;return Response.json({access_token:'sensitive-token',scope});});
  assert.equal(calls,1);assert.equal(response.status,303);assert.match(response.headers.get('location'),/auth_error=scope/);
  assert.doesNotMatch(response.headers.get('set-cookie'),/__Host-bathos-session=|sensitive-token/);
  assert.doesNotMatch(await response.text(),/sensitive-token/);
 }
});
test('upstream failure is generic without secrets',async()=>{
 const flow=await start();
 const response=await handleRequest(callback(flow),env,async()=>Response.json({error:'bad',secret:env.GITHUB_CLIENT_SECRET},{status:502}));
 assert.match(response.headers.get('location'),/auth_error=failed/);assert.doesNotMatch(await response.text(),/test-secret/);
});
