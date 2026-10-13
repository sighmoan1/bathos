import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest as actualHandleRequest} from './index.mjs';
import {withPublicationMocks} from './publication-fixture.mjs';
const handleRequest = (request, env, upstream) => actualHandleRequest(request, env, withPublicationMocks(upstream));
import {parsePost, serializePost, replyTargets, sealSession, sessionCookie} from './manager.mjs';
const env={CMS_ORIGIN:'https://bathos.org',OAUTH_ORIGIN:'https://bathos.org',GITHUB_REPOSITORY:'sighmoan1/bathos',SESSION_SECRET:btoa('12345678901234567890123456789012')};
const sha='a'.repeat(40),commit='b'.repeat(40);
const post={slug:'reply',title:'A reply',description:'Reply summary',date:'2026-10-13',tags:[],body:'Body'};
async function request(method,data) {
 const cookie=sessionCookie(await sealSession(env,'private-token','writer')).split(';')[0];
 return new Request(`https://bathos.org/api/posts${method==='POST'?'':'/reply'}`,{method,headers:{Cookie:cookie,Origin:env.CMS_ORIGIN,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
}
test('reply frontmatter round-trips normalized, deduplicated HTTP(S) targets',()=>{
 const value={...post,inReplyTo:['https://EXAMPLE.com/post?x=1&y=2','http://example.net/other','https://example.com/post?x=1&y=2']};
 const parsed=parsePost(serializePost(value),'reply',sha);
 assert.deepEqual(parsed.inReplyTo,['https://example.com/post?x=1&y=2','http://example.net/other']);
 assert.equal(parsed.body,post.body);
 assert.deepEqual(parsePost(serializePost(post),'reply',sha),{...post,sha});
 assert.equal(parsePost(serializePost({...post,inReplyTo:[]}),'reply',sha).inReplyTo,undefined);
});
test('unsafe reply metadata is refused before any API write',async()=>{
 for(const value of ['https://example.com',[null],[1],['javascript:alert(1)'],['data:text/html,evil'],['https://user:pass@example.com'],['/relative'],['https:example.com'],['https://example.com/a b'],['https://example.com/\n']]) {
  assert.throws(()=>replyTargets(value),/Reply URLs/);
  const response=await handleRequest(await request('POST',{...post,inReplyTo:value}),env,()=>{throw Error('must not call GitHub')});
  assert.equal(response.status,400);
 }
});
test('read, update and explicit removal preserve reply targets without dropping unrelated post fields',async()=>{
 const original={...post,inReplyTo:['https://example.com/post']};
 const file={type:'file',encoding:'base64',size:100,sha,content:Buffer.from(serializePost(original)).toString('base64')};
 const response=await handleRequest(await request('GET'),env,async()=>Response.json(file));
 const loaded=await response.json(); assert.deepEqual(loaded,{...original,sha});
 for(const targets of [loaded.inReplyTo,[]]) {
  let calls=0;
  const changed={...loaded,title:'Updated reply',inReplyTo:targets};
  const saved=await handleRequest(await request('PUT',changed),env,async(url,options)=>{
   calls++;assert.equal(options.method,'PUT');const data=JSON.parse(options.body);assert.equal(data.sha,sha);
   const parsed=parsePost(Buffer.from(data.content,'base64').toString('utf8'),'reply',commit);
   assert.equal(parsed.title,changed.title);assert.equal(parsed.body,post.body);
   assert.deepEqual(parsed.inReplyTo,targets.length?targets:undefined);
   return Response.json({content:{sha:commit},commit:{sha:commit}});
  });
  assert.equal(saved.status,200);assert.equal(calls,1);assert.deepEqual((await saved.json()).post.inReplyTo,targets);
 }
});
test('unrecognized frontmatter still refuses editing instead of silently removing fields',()=>{
 assert.throws(()=>parsePost(serializePost(post).replace('title:', 'custom: preserve-me\ntitle:'),'reply',sha),/Unexpected post fields/);
});
