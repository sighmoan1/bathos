import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from './index.mjs';
import { sealSession, sessionCookie, parsePost, serializePost, deploymentState } from './manager.mjs';
const env = { CMS_ORIGIN: 'https://bathos.org', OAUTH_ORIGIN: 'https://bathos.org', GITHUB_REPOSITORY: 'sighmoan1/bathos', GITHUB_CLIENT_ID:'client', GITHUB_CLIENT_SECRET:'secret', SESSION_SECRET: btoa('12345678901234567890123456789012') };
const sha = 'a'.repeat(40), commit = 'b'.repeat(40);
const post = { slug:'test-post', title:'Café: "cake"', description:'Line one\n---\nLine two 🍰', date:'2026-10-12', tags:['x:y','🍰'], body:'## Hi\n\nCrème brûlée 🍰\n---\n' };
async function req(path, method='GET', data, options={}) {
 const value = options.cookie ?? sessionCookie(await sealSession(env,'private-token','writer')).split(';')[0];
 return new Request(`https://bathos.org${path}`, { method, headers:{ Cookie:value, ...(method==='GET'?{}:{Origin: options.origin ?? env.CMS_ORIGIN,'Content-Type':'application/json'}), ...options.headers }, ...(data===undefined?{}:{body:JSON.stringify(data)}) });
}
test('encrypted session is authenticated, token never appears in responses, logout clears it', async()=>{
 const cookie = sessionCookie(await sealSession(env,'private-token','writer'));
 assert.doesNotMatch(cookie,/private-token|writer/);
 const response = await handleRequest(await req('/api/session'),env);
 assert.deepEqual(await response.json(),{authenticated:true,user:{login:'writer'}});
 const logout=await handleRequest(await req('/api/logout','POST'),env);
 assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
test('missing, tampered, expired and wrong-key sessions are unauthorized without upstream calls', async()=>{
 for(const cookie of ['', '__Host-bathos-session=garbage', sessionCookie(await sealSession(env,'token','writer',Date.now()-1)), sessionCookie(await sealSession({...env,SESSION_SECRET:btoa('abcdefghijklmnopqrstuvwx12345678')},'token','writer'))]) {
  const response = await handleRequest(await req('/api/posts','GET',undefined,{cookie}),env,()=>{throw Error('upstream called');});
  assert.equal(response.status,401);
 }
});
test('all mutations require exact Origin before authentication or upstream access',async()=>{
 for(const path of ['/api/logout','/api/posts','/api/posts/test-post']) for(const origin of ['https://evil.test','null','https://bathos.org.evil.test']) {
  const response=await handleRequest(await req(path,'POST',post,{origin}),env,()=>{throw Error('upstream called');}); assert.equal(response.status,403);
 }
 const request=await req('/api/posts','POST',post);request.headers.delete('Origin');assert.equal((await handleRequest(request,env)).status,403);
});
test('YAML serialization round-trips UTF8 multiline metadata and Markdown exactly',()=>{
 const parsed = parsePost(serializePost(post),post.slug,sha);
 assert.deepEqual(parsed,{...post,sha});
 assert.throws(()=>parsePost('---\ntitle: a\ntitle: b\n---\nbody','test',sha));
});
test('create commits only content Markdown on main and returns new revision without token',async()=>{
 let calls=0;
 const response=await handleRequest(await req('/api/posts','POST',post),env,async(url,opts)=>{
  calls++;assert.equal(url,'https://api.github.com/repos/sighmoan1/bathos/contents/content/test-post.md');assert.equal(opts.method,'PUT');assert.equal(opts.headers.Authorization,'Bearer private-token');
  const data=JSON.parse(opts.body);assert.equal(data.branch,'main');assert.equal(data.sha,undefined);
  assert.deepEqual(parsePost(new TextDecoder().decode(Uint8Array.from(atob(data.content),c=>c.charCodeAt(0))),post.slug,sha),{...post,sha});
  return Response.json({content:{sha},commit:{sha:commit}});
 });
 assert.equal(response.status,201);assert.deepEqual(await response.json(),{post:{...post,sha},commitSha:commit});assert.equal(calls,1);
});
test('update and delete require optimistic SHA, GitHub conflict never retries or leaks upstream errors',async()=>{
 for(const method of ['PUT','DELETE']) {
  assert.equal((await handleRequest(await req('/api/posts/test-post',method,method==='PUT'?post:{}),env)).status,400);
  let calls=0;
  const response=await handleRequest(await req('/api/posts/test-post',method,method==='PUT'?{...post,sha}:{sha}),env,async(url,opts)=>{calls++;assert.equal(JSON.parse(opts.body).sha,sha);return Response.json({message:'private-token secret'},{status:409});});
  assert.equal(response.status,409);const body=await response.text();assert.match(body,/draft is kept/);assert.doesNotMatch(body,/private-token|secret/);assert.equal(calls,1);
 }
});
test('unsafe filenames, unexpected fields, malformed dates and oversized bodies cannot write',async()=>{
 for(const data of [{...post,slug:'../README'},{...post,slug:'bad.md'},{...post,slug:'Uppercase'},{...post,extra:'evil'},{...post,date:'2026-99-99'},{...post,date:'2026-02-31'},{...post,body:'x'.repeat(140000)},{...post,sha}]) {
  const response=await handleRequest(await req('/api/posts','POST',data),env,()=>{throw Error('must not write');});assert.ok([400,413].includes(response.status),`${response.status} for ${data.slug}`);
 }
 for(const path of ['/api/posts/bad%2Fpath','/api/posts/bad.md']) assert.equal((await handleRequest(await req(path),env)).status,400);
});
test('read and listing handle valid posts and report malformed front matter',async()=>{
 const upstream=async url=>url.endsWith('/contents/content?ref=main')?Response.json([{type:'file',name:'test-post.md'},{type:'file',name:'broken.md'},{type:'dir',name:'skip.md'}]):Response.json({type:'file',encoding:'base64',size:100,sha,content:btoa(unescape(encodeURIComponent(url.includes('broken')?'bad':serializePost(post))))});
 const read=await handleRequest(await req('/api/posts/test-post'),env,upstream);assert.deepEqual(await read.json(),{...post,sha});
 const list=await handleRequest(await req('/api/posts'),env,upstream);const data=await list.json();assert.equal(data.posts.length,1);assert.equal(data.posts[0].body,undefined);assert.equal(data.warnings[0].slug,'broken');
});
test('same-window OAuth flow checks push permission, issues cookie, redirects without browser token',async()=>{
 const start=await handleRequest(new Request('https://bathos.org/api/login'),env);const cookie=start.headers.get('set-cookie').split(';')[0], state=new URL(start.headers.get('location')).searchParams.get('state');
 let calls=0;
 const response=await handleRequest(new Request(`https://bathos.org/api/callback?state=${state}&code=code`,{headers:{Cookie:cookie}}),env,async(url,opts)=>{
  if(++calls===1){assert.equal(typeof JSON.parse(opts.body).code_verifier,'string');return Response.json({access_token:'private-token'});}
  if(calls===2)return Response.json({permissions:{push:true}});
  return Response.json({login:'writer'});
 });
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://bathos.org/manage/');assert.doesNotMatch(await response.text(),/private-token/);assert.doesNotMatch(response.headers.get('set-cookie'),/private-token/);
 assert.match(response.headers.get('set-cookie'),/__Host-bathos-session=/);
 const session=response.headers.getSetCookie().find(c=>c.startsWith('__Host-bathos-session=')).split(';')[0];
 assert.equal((await handleRequest(await req('/api/session','GET',undefined,{cookie:session}),env)).status,200);
});
test('manage OAuth denies repository write access and cancellation without exposing token',async()=>{
 for(const denied of [false,true]) {
  const start=await handleRequest(new Request('https://bathos.org/api/login'),env),state=new URL(start.headers.get('location')).searchParams.get('state');let calls=0;
  const response=await handleRequest(new Request(`https://bathos.org/api/callback?state=${state}&code=code${denied?'&error=access_denied':''}`,{headers:{Cookie:start.headers.get('set-cookie').split(';')[0]}}),env,async()=>Response.json(++calls===1?{access_token:'private-token'}:{permissions:{push:false}}));
  assert.equal(response.status,303);assert.match(response.headers.get('location'),/auth_error=(permission|denied)/);assert.doesNotMatch(response.headers.get('set-cookie'),/__Host-bathos-session=/);
 }
});
test('deployment status excludes unrelated apps, previews, projects and SHAs',()=>{
 const valid={id:1,head_sha:sha,name:'Cloudflare Pages',app:{slug:'cloudflare-workers-and-pages'},pull_requests:[],details_url:'https://dash.cloudflare.com/account/pages/view/bathos-web/deployment',status:'completed',conclusion:'success'};
 assert.equal(deploymentState(sha,[valid]).state,'success');
 for(const delta of [{head_sha:commit},{app:{slug:'other'}},{pull_requests:[{}]},{details_url:'https://evil.test/pages/view/bathos-web'},{details_url:'https://dash.cloudflare.com/account/pages/view/other'}, {output:{summary:'Branch Preview URL'}}])assert.equal(deploymentState(sha,[{...valid,...delta}]).state,'unknown');
});
test('successful update and deletion commit once with exact revision and return commit identifiers',async()=>{
 for(const method of ['PUT','DELETE']) {
  let calls=0;
  const response=await handleRequest(await req('/api/posts/test-post',method,method==='PUT'?{...post,sha}:{sha}),env,async(url,options)=>{
   calls++;assert.equal(options.method,method);assert.equal(JSON.parse(options.body).sha,sha);
   return Response.json({content:method==='PUT'?{sha:commit}:null,commit:{sha:commit}});
  });
  assert.equal(response.status,200);assert.equal((await response.json()).commitSha,commit);assert.equal(calls,1);
 }
});
test('foreign origins/configurations and upstream failures do not expose tokens or configuration secrets',async()=>{
 const request=await req('/api/posts');
 assert.equal((await handleRequest(new Request('https://evil.test/api/session',{headers:request.headers}),env)).status,503);
 assert.equal((await handleRequest(request,{...env,OAUTH_ORIGIN:'https://bathos.org/'})).status,503);
 for(const upstream of [async()=>{throw Error('private-token secret');},async()=>Response.json({message:'private-token secret'},{status:500})]) {
  const response=await handleRequest(await req('/api/posts/test-post'),env,upstream);assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/private-token|secret/);
 }
 const response=await handleRequest(await req('/api/posts/test-post'),env,async()=>Response.json({message:'private-token'},{status:401}));assert.equal(response.status,401);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
});

test('all real repository posts are editable with their original case-sensitive filenames', async () => {
 const { readdir, readFile } = await import('node:fs/promises');
 const files = (await readdir(new URL('../../content/', import.meta.url))).filter(name => name.endsWith('.md'));
 const contents = new Map(await Promise.all(files.map(async name => [name, await readFile(new URL(`../../content/${name}`, import.meta.url), 'utf8')])));
 const upstream = async url => {
  if (url.endsWith('/contents/content?ref=main')) return Response.json(files.map(name => ({type:'file', name})));
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
  assert.ok(contents.has(name), `original filename ${name} must be preserved`);
  const content = contents.get(name);
  return Response.json({type:'file',encoding:'base64',size:Buffer.byteLength(content),sha,content:Buffer.from(content).toString('base64')});
 };
 const list = await handleRequest(await req('/api/posts'),env,upstream);
 const data = await list.json();
 assert.equal(data.posts.length,files.length);
 assert.equal(data.warnings,undefined);
 const gassing = await handleRequest(await req('/api/posts/Gassing'),env,upstream);
 assert.equal(gassing.status,200);
 const value = await gassing.json();
 assert.equal(value.slug,'Gassing');
 let writes = 0;
 for (const method of ['PUT','DELETE']) {
  const response = await handleRequest(await req('/api/posts/Gassing',method,method === 'PUT' ? value : {sha}),env,async(url,options) => {
   writes++; assert.equal(url,'https://api.github.com/repos/sighmoan1/bathos/contents/content/Gassing.md');
   assert.equal(JSON.parse(options.body).sha,sha);
   return Response.json({content:{sha},commit:{sha:commit}});
  });
  assert.equal(response.status,200);
 }
 assert.equal(writes,2);
});
