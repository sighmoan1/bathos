import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker,{handleRequest} from './index.mjs';
import {ORIGIN,PREFIX,token,verifyToken,emailAddress} from './security.mjs';
import {discover,dispatch,scheduled,ready,catalogPosts} from './delivery.mjs';
import {requestSubscription,statement,reserveQuota,acquireLock} from './store.mjs';
import {queueDigest,digestPreview,nextDigestAt} from './digest.mjs';
const NOW=Date.parse('2026-10-13T19:00:00Z');
const secret=Buffer.alloc(32,7).toString('base64url');
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of ['0001_subscriptions.sql','0002_weekly_digest.sql'])sql.exec(readFileSync(new URL('./migrations/'+file,import.meta.url),'utf8'));
 const wrap=(query,params=[])=>({bind(...values){return wrap(query,values);},async first(){return sql.prepare(query).all(...params)[0]||null;},async all(){return {results:sql.prepare(query).all(...params)};},async run(){const result=sql.prepare(query).run(...params);return {meta:{changes:Number(result.changes)}};}});
 return {prepare:wrap,async batch(queries){sql.exec('BEGIN');try{const rows=[];for(const query of queries)rows.push(await query.run());sql.exec('COMMIT');return rows;}catch(error){sql.exec('ROLLBACK');throw error;}},sql};
}
function fixture(){
 const DB=database(),sent=[];
 const env={DB,DELIVERY_ENABLED:'true',MAIL_FROM:'Bathos <posts@mail.bathos.org>',DAILY_LIMIT:'90',MONTHLY_LIMIT:'2700',TOKEN_SECRET:secret,RESEND_API_KEY:'re_private_test',RESEND_WEBHOOK_SECRET:'whsec_'+Buffer.alloc(32,8).toString('base64'),TURNSTILE_SECRET:'private_challenge',TURNSTILE_SITE_KEY:'public_sitekey'};
 const catalog={version:1,siteUrl:ORIGIN,articles:[{slug:'Gassing',title:'Gassing',summary:'An existing post',canonicalUrl:ORIGIN+'/posts/Gassing/'}]};
 const upstream=async(url,options)=>{
  if(url.includes('siteverify'))return Response.json({success:true,action:'subscribe',hostname:'bathos.org'});
  if(url===ORIGIN+'/articles.json')return Response.json(catalog);
  assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers.Authorization,'Bearer re_private_test');
  sent.push({body:JSON.parse(options.body),key:options.headers['Idempotency-Key']});return Response.json({id:`message-${sent.length}`});
 };
 const req=(path=PREFIX,{method='GET',data,origin=ORIGIN,headers={}}={})=>new Request(ORIGIN+path,{method,headers:{...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'}),'CF-Connecting-IP':'192.0.2.1',...headers},...(data===undefined?{}:{body:typeof data==='string'?data:JSON.stringify(data)})});
 const handle=(request,fetcher=upstream,now=NOW)=>handleRequest(request,env,fetcher,()=>now);
 return {env,DB,sent,catalog,upstream,req,handle};
}
async function activate(f){await discover(f.env,f.upstream,NOW);}
async function signup(f,email='reader@example.test',now=NOW){return f.handle(f.req(PREFIX,{method:'POST',data:{email,token:'fresh-token'}}),f.upstream,now);}
async function confirm(f,now=NOW){
 const link=f.sent.at(-1).body.text.match(/https:\/\/bathos\.org\/api\/subscriptions\/confirm\?token=([^\s]+)/)[1];
 return f.handle(f.req(PREFIX+'/confirm',{method:'POST',data:new URLSearchParams({token:decodeURIComponent(link)}).toString(),headers:{'Content-Type':'application/x-www-form-urlencoded'}}),f.upstream,now);
}
test('disabled or unconfigured delivery never advertises or accepts signup; actual Worker fetch signature works',async()=>{
 const f=fixture();f.env.DELIVERY_ENABLED='false';
 const response=await worker.fetch(f.req(PREFIX+'/status'),f.env,{waitUntil(){}});
 assert.deepEqual(await response.json(),{enabled:false});
 assert.equal((await signup(f)).status,503);assert.equal(f.sent.length,0);
 assert.equal(await ready({...f.env,DELIVERY_ENABLED:'true',RESEND_API_KEY:undefined}),false);
});
test('signup sends only confirmation, GET scanners do not opt in, POST confirms once, no advertising or shared recipients',async()=>{
 const f=fixture();await activate(f);
 const response=await signup(f);assert.equal(response.status,202);assert.equal(f.sent.length,1);
 const body=f.sent[0].body;assert.deepEqual(body.to,['reader@example.test']);assert.match(body.text,/48 hours/);assert.match(body.html,/No ads/);assert.doesNotMatch(body.html,/<script|<img|tracking|sponsor/i);
 assert.equal(body.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
 const link=body.text.match(/https:\/\/bathos\.org\/api\/subscriptions\/confirm\?token=[^\s]+/)[0];
 const get=await f.handle(new Request(link));assert.equal(get.status,200);assert.match(await get.text(),/<form method="post"/);
 assert.equal((await statement(f.env,'SELECT status FROM subscribers').first()).status,'pending');
 assert.equal((await confirm(f)).status,200);assert.equal((await statement(f.env,'SELECT status FROM subscribers').first()).status,'active');
 assert.equal((await confirm(f)).status,200);assert.equal((await signup(f)).status,202);assert.equal(f.sent.length,1);
 assert.doesNotMatch(JSON.stringify(await response.json()),/reader@example|token=/);
});
test('host/origin, malformed input, oversized bodies and failed/mismatched bot verification cannot subscribe',async()=>{
 const f=fixture();await activate(f);
 assert.equal((await handleRequest(new Request('https://evil.test/api/subscriptions'),f.env)).status,404);
 assert.equal((await f.handle(f.req(PREFIX,{method:'POST',origin:'https://evil.test',data:{email:'reader@example.test',token:'x'}}))).status,403);
 for(const data of [{email:'bad',token:'x'},{email:'x@example.test',token:'x'.repeat(5000)}])assert.equal((await f.handle(f.req(PREFIX,{method:'POST',data}))).status,400);
 for(const challenge of [{success:false},{success:true,hostname:'evil.test',action:'subscribe'},{success:true,hostname:'bathos.org',action:'login'}])assert.equal((await f.handle(f.req(PREFIX,{method:'POST',data:{email:'reader@example.test',token:'x'}}),async()=>Response.json(challenge))).status,403);
 assert.equal(f.sent.length,0);assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM subscribers').get().n,0);
});
test('signed tokens are purpose-bound, tamper-resistant, expire and invalidate when a fresh request replaces confirmation',async()=>{
 const f=fixture();await activate(f);await signup(f);
 const original=f.sent[0].body.text.match(/confirm\?token=([^\s]+)/)[1];
 assert.equal((await f.handle(f.req(PREFIX+'/confirm?token='+original),f.upstream,NOW+49*3600000)).status,400);
 const unsigned=await token(secret,'unsubscribe','id');assert.equal(await verifyToken(secret,'confirm',unsigned),null);assert.equal(await verifyToken(secret,'unsubscribe',unsigned+'x'),null);
 await signup(f,'reader@example.test',NOW+2*3600000);
 assert.equal((await f.handle(f.req(PREFIX+'/confirm?token='+original),f.upstream,NOW+2*3600000)).status,400);
});
test('baseline skips the archive, new posts enqueue only confirmed subscribers, edits do not resend',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);assert.equal(f.sent.length,1);
 assert.equal(f.DB.sql.prepare("SELECT count(*) n FROM jobs WHERE kind='post'").get().n,0);
 const post={slug:'new',title:'A <new> thought',summary:'Words & ideas',canonicalUrl:ORIGIN+'/posts/new/'};f.catalog.articles.push(post);
 await discover(f.env,f.upstream,NOW+1000);await queueDigest(f.env,NOW+1000);await dispatch(f.env,f.upstream,{clock:()=>NOW+1000,sleep:async()=>{}});
 assert.equal(f.sent.length,2);assert.match(f.sent[1].body.html,/A &lt;new&gt; thought/);assert.match(f.sent[1].body.html,/Words &amp; ideas/);
 post.title='Edited title';await discover(f.env,f.upstream,NOW+2000);await dispatch(f.env,f.upstream,{clock:()=>NOW+2000,sleep:async()=>{}});assert.equal(f.sent.length,2);
});
test('unsubscribe GET is safe, one-click POST requires a signed token and cancels unsent jobs',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);
 const value=f.sent[0].body.headers['List-Unsubscribe'].slice(1,-1);const get=await f.handle(new Request(value));assert.equal(get.status,200);
 assert.equal((await statement(f.env,'SELECT status FROM subscribers').first()).status,'active');
 f.catalog.articles.push({slug:'new',title:'New',summary:'Summary',canonicalUrl:ORIGIN+'/posts/new/'});await discover(f.env,f.upstream,NOW+1000);
 const post=new Request(value,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'});
 assert.equal((await f.handle(post)).status,200);assert.equal((await statement(f.env,'SELECT status FROM subscribers').first()).status,'unsubscribed');
 await dispatch(f.env,f.upstream,{clock:()=>NOW+1000,sleep:async()=>{}});assert.equal(f.sent.length,1);
 assert.equal((await f.handle(new Request(value.replace(/.$/,'x'),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'}))).status,400);
});
test('ambiguous failures retry the identical payload/key within 24h, then pause instead of risking duplicates',async()=>{
 const f=fixture();await activate(f);const id=await requestSubscription(f.env,'reader@example.test',NOW);const calls=[];
 const lost=async(url,options)=>{calls.push({body:options.body,key:options.headers['Idempotency-Key']});throw Error('lost response with private secret');};
 await dispatch(f.env,lost,{clock:()=>NOW,max:1});
 await dispatch(f.env,lost,{clock:()=>NOW+300000,max:1});
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
 await dispatch(f.env,lost,{clock:()=>NOW+24*3600000,max:1});assert.equal(calls.length,2);
 const job=await statement(f.env,'SELECT * FROM jobs WHERE id=?',id).first();assert.equal(job.state,'uncertain');assert.doesNotMatch(job.last_error,/private|secret/);
});
test('quota reservations and dispatch locks are atomic; waiting for quota does not start the idempotency window',async()=>{
 const f=fixture();f.env.DAILY_LIMIT='2';
 const results=await Promise.all([1,2,3,4].map(attempts=>reserveQuota(f.env,{id:'quota',attempts},NOW)));assert.equal(results.filter(Boolean).length,2);
 const locks=await Promise.all([1,2,3].map(()=>acquireLock(f.env,'test',NOW)));assert.equal(locks.filter(Boolean).length,1);
 const id=await requestSubscription(f.env,'reader@example.test',NOW);await dispatch(f.env,f.upstream,{clock:()=>NOW,max:1});
 const job=await statement(f.env,'SELECT * FROM jobs WHERE id=?',id).first();assert.equal(job.first_attempt_at,null);assert.equal(job.state,'queued');assert.equal(f.sent.length,0);
});
test('catalog validation rejects foreign links, duplicates and oversized metadata before enqueueing',()=>{
 const f=fixture();const original=f.catalog.articles[0];
 for(const post of [{...original,canonicalUrl:'https://evil.test/'},{...original,title:'x'.repeat(301)},{...original,slug:'../path'}])assert.throws(()=>catalogPosts({...f.catalog,articles:[post]}));
 assert.throws(()=>catalogPosts({...f.catalog,articles:[original,original]}));
});
async function webhook(f,type,id='message-1',stamp=Math.floor(NOW/1000)){
 const body=JSON.stringify({type,data:{email_id:id}}),message=`event-1.${stamp}.${body}`;
 const key=await crypto.subtle.importKey('raw',Buffer.alloc(32,8),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))).toString('base64');
 return f.req(PREFIX+'/webhook',{method:'POST',data:body,headers:{'svix-id':'event-1','svix-timestamp':String(stamp),'svix-signature':'v1,'+signature}});
}
test('signed delivered/bounce/complaint webhooks update known messages, reject replay-age and forged events',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);
 assert.equal((await f.handle(await webhook(f,'email.delivered'))).status,200);assert.equal((await statement(f.env,'SELECT delivered_at FROM jobs').first()).delivered_at,NOW);
 assert.equal((await f.handle(await webhook(f,'email.complained'))).status,200);assert.equal((await statement(f.env,'SELECT status FROM subscribers').first()).status,'suppressed');
 assert.equal((await f.handle(await webhook(f,'email.bounced'))).status,200);
 assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM suppressions').get().n,1);
 assert.equal((await f.handle(await webhook(f,'email.bounced','message-1',Math.floor(NOW/1000)-601))).status,403);
 const forged=await webhook(f,'email.bounced');forged.headers.set('svix-signature','v1,garbage');assert.equal((await f.handle(forged)).status,403);
 const before=f.sent.length;await signup(f);assert.equal(f.sent.length,before);
 await scheduled({...f.env,DELIVERY_ENABLED:'false'},f.upstream,{clock:()=>NOW+91*86400000});
 assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM subscribers').get().n,0);
 assert.equal(await requestSubscription(f.env,'reader@example.test',NOW+91*86400000),null);
});
test('signup address/IP cooldowns and cleanup keep unconfirmed addresses out of delivery',async()=>{
 const f=fixture();await activate(f);await signup(f);await signup(f);assert.equal(f.sent.length,1);
 for(let i=0;i<3;i++)await signup(f,`reader${i}@example.test`);
 assert.equal((await signup(f,'too-many@example.test')).status,429);
 await scheduled({...f.env,DELIVERY_ENABLED:'false'},f.upstream,{clock:()=>NOW+8*86400000});
 assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM subscribers').get().n,0);
 for(const bad of ['a\r\nb@example.test','x@-bad.test','x..y@example.test','<x>@example.test'])assert.equal(emailAddress(bad),null);
});
test('database failure rolls back cooldown and queue together so an immediate retry can send confirmation',async()=>{
 const f=fixture();await activate(f);
 const batch=f.DB.batch.bind(f.DB);
 f.DB.batch=queries=>batch([...queries,statement(f.env,'THIS IS INVALID SQL')]);
 const first=await signup(f);assert.equal(first.status,503);
 assert.equal((await statement(f.env,'SELECT requested_at FROM subscribers').first()).requested_at,0);
 assert.equal(f.sent.length,0);
 f.DB.batch=batch;
 assert.equal((await signup(f)).status,202);assert.equal(f.sent.length,1);
});
test('a bounce arriving before the send response is retained and suppresses the subscriber after reconciliation',async()=>{
 const f=fixture();await activate(f);
 const upstream=async(url,options)=>{
  if(url.includes('siteverify'))return f.upstream(url,options);
  assert.equal(url,'https://api.resend.com/emails');
  const response=await f.handle(await webhook(f,'email.bounced','racy-message'));
  assert.equal(response.status,200);
  assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM webhook_events').get().n,1);
  return Response.json({id:'racy-message'});
 };
 const response=await f.handle(f.req(PREFIX,{method:'POST',data:{email:'reader@example.test',token:'x'}}),upstream);
 assert.equal(response.status,503);
 assert.equal((await statement(f.env,'SELECT status FROM subscribers').first()).status,'suppressed');
 assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM webhook_events').get().n,0);
 assert.equal((await statement(f.env,'SELECT state FROM jobs').first()).state,'failed');
});
test('paused cron reconciles a receipt left pending after a crash and cancels queued notifications',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);
 f.catalog.articles.push({slug:'future',title:'Future',summary:'Summary',canonicalUrl:ORIGIN+'/posts/future/'});
 await discover(f.env,f.upstream,NOW+1000);
 await queueDigest(f.env,NOW+1000);
 await statement(f.env,"INSERT INTO webhook_events(message_id,type,received_at) VALUES('message-1','email.complained',?)",NOW+1000).run();
 await scheduled({...f.env,DELIVERY_ENABLED:'false'},f.upstream,{clock:()=>NOW+2000});
 assert.equal((await statement(f.env,'SELECT status FROM subscribers').first()).status,'suppressed');
 assert.equal(f.DB.sql.prepare("SELECT count(*) n FROM jobs WHERE kind='post' AND state='cancelled'").get().n,1);
 assert.equal(f.sent.length,1);
});

const newPost=(slug)=>({slug,title:`Post ${slug}`,summary:`Summary ${slug}`,canonicalUrl:`${ORIGIN}/posts/${slug}/`});
test('weekly digest batches new posts once, ignores edits, and sends nothing on empty weeks',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);
 f.catalog.articles.push(newPost('first'),newPost('second'));
 await scheduled(f.env,f.upstream,{clock:()=>NOW+1000,sleep:async()=>{}});
 assert.equal(f.sent.length,1); // confirmation only, not a send per publication
 const due=Number((await statement(f.env,"SELECT value FROM metadata WHERE key='next_digest_at'").first()).value);
 await scheduled(f.env,f.upstream,{clock:()=>due,sleep:async()=>{}});
 assert.equal(f.sent.length,2);assert.equal(f.sent[1].body.subject,'Bathos update: 2 new posts');
 assert.match(f.sent[1].body.text,/Post first[\s\S]*Post second/);
 assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM digests').get().n,1);
 f.catalog.articles[1].title='Edited after sending';
 await scheduled(f.env,f.upstream,{clock:()=>nextDigestAt(due),sleep:async()=>{}});
 assert.equal(f.sent.length,2);
 assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM digests').get().n,1);
});
test('manual and weekly sends share the ledger; current previews are required and concurrent sends deduplicate',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);
 f.catalog.articles.push(newPost('manual'));await discover(f.env,f.upstream,NOW+1000);
 const preview=await digestPreview(f.env,NOW+1000);
 assert.equal((await queueDigest(f.env,NOW+1001,{preview:'forged'})).changed,true);
 assert.equal((await queueDigest(f.env,NOW+16*60000,{preview:preview.preview})).changed,true);
 const results=await Promise.all([1,2,3].map(()=>queueDigest(f.env,NOW+2000,{preview:preview.preview})));
 assert.equal(results.filter(r=>r.queued===1).length,1);
 await dispatch(f.env,f.upstream,{clock:()=>NOW+2000,sleep:async()=>{}});assert.equal(f.sent.length,2);
 await scheduled(f.env,f.upstream,{clock:()=>nextDigestAt(NOW),sleep:async()=>{}});assert.equal(f.sent.length,2);
 assert.equal((await queueDigest(f.env,NOW+3000,{preview:preview.preview})).changed,true);
});
test('preview changes with new content, excludes deleted posts, and uses edited copy without mailing edits again',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);
 f.catalog.articles.push(newPost('changed'),newPost('removed'));await discover(f.env,f.upstream,NOW+1000);
 const before=await digestPreview(f.env,NOW+1000);
 f.catalog.articles[1].summary='Revised & ready';f.catalog.articles.pop();
 await discover(f.env,f.upstream,NOW+2000);
 assert.equal((await queueDigest(f.env,NOW+2000,{preview:before.preview})).changed,true);
 const latest=await digestPreview(f.env,NOW+2000);assert.equal(latest.posts.length,1);
 await queueDigest(f.env,NOW+2000,{preview:latest.preview});await dispatch(f.env,f.upstream,{clock:()=>NOW+2000,sleep:async()=>{}});
 assert.match(f.sent[1].body.html,/Revised &amp; ready/);assert.doesNotMatch(f.sent[1].body.text,/removed/);
 await discover(f.env,f.upstream,NOW+3000);assert.equal((await digestPreview(f.env,NOW+3000)).posts.length,0);
});
test('late subscribers receive only future discoveries and unsubscribed readers never receive a queued digest',async()=>{
 const f=fixture();await activate(f);
 f.catalog.articles.push(newPost('before-signup'));await discover(f.env,f.upstream,NOW+1000);
 await signup(f,'reader@example.test',NOW+2000);await confirm(f,NOW+2000);
 f.catalog.articles.push(newPost('after-signup'));await discover(f.env,f.upstream,NOW+3000);
 await queueDigest(f.env,NOW+4000);await dispatch(f.env,f.upstream,{clock:()=>NOW+4000,sleep:async()=>{}});
 assert.equal(f.sent.length,2);assert.match(f.sent[1].body.text,/after-signup/);assert.doesNotMatch(f.sent[1].body.text,/before-signup/);
 f.catalog.articles.push(newPost('cancelled'));await discover(f.env,f.upstream,NOW+5000);await queueDigest(f.env,NOW+5000);
 const url=f.sent[1].body.headers['List-Unsubscribe'].slice(1,-1);
 await f.handle(new Request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'}));
 await dispatch(f.env,f.upstream,{clock:()=>NOW+6000,sleep:async()=>{}});assert.equal(f.sent.length,2);
});
test('queue failure rolls back both digest jobs and consumed post markers',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);
 f.catalog.articles.push(newPost('retry'));await discover(f.env,f.upstream,NOW+1000);
 const batch=f.DB.batch.bind(f.DB);f.DB.batch=queries=>batch([...queries,statement(f.env,'INVALID SQL')]);
 await assert.rejects(queueDigest(f.env,NOW+1000));
 assert.equal((await digestPreview(f.env,NOW+1000)).posts.length,1);
 assert.equal(f.DB.sql.prepare('SELECT count(*) n FROM digests').get().n,0);
 f.DB.batch=batch;assert.equal((await queueDigest(f.env,NOW+1001)).queued,1);
});
test('manager digest endpoint requires existing authentication and same-origin previewed POST; disabled delivery cannot queue',async()=>{
 const f=fixture();await activate(f);await signup(f);await confirm(f);
 const path=PREFIX+'/digest',headers={Cookie:'__Host-bathos-session=fixture'};
 assert.equal((await f.handle(f.req(path))).status,401);
 f.env.ADMIN={fetch:async request=>{assert.equal(request.url,ORIGIN+'/api/session');assert.equal(request.headers.get('Cookie'),headers.Cookie);return Response.json({authenticated:true,user:{login:'owner'}});}};
 f.catalog.articles.push(newPost('operator'));
 const get=await f.handle(f.req(path,{headers}));assert.equal(get.status,200);const preview=await get.json();
 assert.equal(preview.posts.length,1);
 assert.equal((await f.handle(f.req(path,{method:'POST',origin:'https://evil.test',headers,data:{preview:preview.preview}}))).status,403);
 assert.equal((await f.handle(f.req(path,{method:'POST',headers,data:{preview:'forged'}}))).status,409);
 f.env.DELIVERY_ENABLED='false';assert.equal((await f.handle(f.req(path,{method:'POST',headers,data:{preview:preview.preview}}))).status,503);
 f.env.DELIVERY_ENABLED='true';assert.equal((await f.handle(f.req(path,{method:'POST',headers,data:{preview:preview.preview}}))).status,202);
 assert.equal(f.sent.length,1); // async cron owns transport
 await dispatch(f.env,f.upstream,{clock:()=>NOW,sleep:async()=>{}});assert.equal(f.sent.length,2);
});
test('weekly schedule follows UK daylight saving and skips missed empty weeks without a catch-up flood',()=>{
 for(const [now,next] of [
  ['2026-10-16T12:00:00Z','2026-10-19T08:00:00Z'],
  ['2026-10-19T08:00:00Z','2026-10-26T09:00:00Z'],
  ['2027-03-22T09:00:00Z','2027-03-29T08:00:00Z'],
  ['2026-10-19T07:59:00Z','2026-10-19T08:00:00Z'],
 ])assert.equal(new Date(nextDigestAt(Date.parse(now))).toISOString(),new Date(next).toISOString());
});
