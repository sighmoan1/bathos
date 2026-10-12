import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleRequest } from './index.mjs';
const env = { CMS_ORIGIN: 'https://bathos.org', OAUTH_ORIGIN: 'https://bathos.org', GITHUB_REPOSITORY: 'sighmoan1/bathos', GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-secret' };
async function start() {
 const response = await handleRequest(new Request('https://bathos.org/api/auth?provider=github&site_id=bathos.org'), env);
 return { response, cookie: response.headers.get('set-cookie').split(';')[0], state: new URL(response.headers.get('location')).searchParams.get('state') };
}
function callback(flow, suffix = '') { return new Request(`https://bathos.org/api/callback?state=${flow.state}&code=test-code${suffix}`, { headers: { Cookie: flow.cookie } }); }
test('OAuth uses secure state cookie and constrained scope/callback', async () => {
 const {response} = await start();
 assert.equal(response.status,302);
 assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
 const url = new URL(response.headers.get('location'));
 assert.equal(url.searchParams.get('scope'),'repo');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('code_challenge').length,43);
 assert.equal(url.searchParams.get('redirect_uri'),'https://bathos.org/api/callback');
});
test('rejects provider, foreign site, invalid origin, unconfigured and non-GET', async () => {
 for(const [request, bindings, status] of [
 [new Request('https://bathos.org/api/auth?provider=gitlab&site_id=bathos.org'),env,400],
 [new Request('https://bathos.org/api/auth?provider=github&site_id=evil.test'),env,400],
 [new Request('https://evil.test/api/auth?provider=github&site_id=bathos.org'),env,503],
 [new Request('https://bathos.org/api/auth'),{},503],
 [new Request('https://bathos.org/api/auth'),{...env,OAUTH_ORIGIN:'https://bathos.org/path'},503],
 [new Request('https://bathos.org/api/auth',{method:'POST'}),env,405],
 ]) assert.equal((await handleRequest(request,bindings)).status,status);
});
test('invalid, missing, expired state never exchanges a token', async () => {
 const flow=await start();
 const expired=btoa(JSON.stringify({state:flow.state,expires:Date.now()-1}));
 for(const request of [new Request('https://bathos.org/api/callback?state=x&code=x'),callback({...flow,state:'wrong'}),callback({...flow,cookie:`__Host-bathos-oauth=${expired}`})]) {
  const response=await handleRequest(request,env,()=>{throw Error('must not call');});
  assert.equal(response.status,400);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
 }
});
test('cancelled authorization returns Decap error without API calls', async () => {
 const flow=await start();
 const response=await handleRequest(callback(flow,'&error=access_denied'),env,()=>{throw Error('must not call');});
 assert.match(await response.text(),/authorization:github:error/);
});
test('write permission required and token withheld for denied users', async () => {
 const flow=await start();let calls=0;
 const response=await handleRequest(callback(flow),env,async()=>Response.json(++calls===1?{access_token:'sensitive-token'}:{permissions:{push:false}}));
 const html=await response.text();assert.match(html,/authorization:github:error/);assert.doesNotMatch(html,/sensitive-token/);
});
test('successful exchange uses strict Decap handshake and escapes token', async () => {
 const flow=await start();let calls=0;
 const response=await handleRequest(callback(flow),env,async(url,options)=>{
  if(++calls===1){assert.equal(url,'https://github.com/login/oauth/access_token');assert.equal(JSON.parse(options.body).client_secret,'test-secret');assert.equal(JSON.parse(options.body).code_verifier.length,72);return Response.json({access_token:'token</script>'});}
  assert.equal(url,'https://api.github.com/repos/sighmoan1/bathos');return Response.json({permissions:{push:true}});
 });
 const html=await response.text();assert.match(html,/authorization:github:success/);assert.match(html,/event.origin!==origin\|\|event.source!==window.opener/);
 assert.match(html,/authorizing:github/);assert.doesNotMatch(html,/token<\/script>/);
 assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
});
test('upstream failure is generic without secrets',async()=>{
 const flow=await start();
 const response=await handleRequest(callback(flow),env,async()=>Response.json({error:'bad',secret:env.GITHUB_CLIENT_SECRET},{status:502}));
 const html=await response.text();assert.match(html,/authorization:github:error/);assert.doesNotMatch(html,/test-secret/);
});

test('callback script executes Decap handshake and rejects hostile messages', async () => {
 const flow = await start(); let calls = 0;
 const token = 'token</script><script>evil()</script>';
 const response = await handleRequest(callback(flow), env, async () => Response.json(++calls === 1 ? { access_token: token } : { permissions: { push: true } }));
 const html = await response.text();
 const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
 const messages = [], listeners = new Map(), status = { textContent: '' };
 const opener = { postMessage(message, origin) { messages.push({ message, origin }); } };
 const window = {
  opener,
  addEventListener(name, callback) { listeners.set(name, callback); },
  removeEventListener(name) { listeners.delete(name); },
 };
 vm.runInNewContext(script, { window, document: { getElementById() { return status; } }, setTimeout() {} });
 assert.deepEqual(messages, [{ message: 'authorizing:github', origin: 'https://bathos.org' }]);
 const reply = listeners.get('message');
 reply({ origin: 'https://evil.test', source: opener, data: 'authorizing:github' });
 reply({ origin: 'https://bathos.org', source: {}, data: 'authorizing:github' });
 reply({ origin: 'https://bathos.org', source: opener, data: 'unrelated' });
 assert.equal(messages.length, 1);assert.ok(listeners.has('message'));
 reply({ origin: 'https://bathos.org', source: opener, data: 'authorizing:github' });
 assert.equal(messages.length, 2);assert.equal(messages[1].origin, 'https://bathos.org');
 const prefix = 'authorization:github:success:';
 assert.ok(messages[1].message.startsWith(prefix));
 assert.deepEqual(JSON.parse(messages[1].message.slice(prefix.length)), { token, provider: 'github' });
 assert.equal(listeners.has('message'), false);
 assert.equal(status.textContent, 'Return to the editor to continue.');
});
