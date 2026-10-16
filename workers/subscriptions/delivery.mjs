import {ORIGIN,boundedText} from './security.mjs';
import {statement,acquireLock,releaseLock,reserveQuota} from './store.mjs';
import {reconcileEvents,reconcilePending} from './events.mjs';
import {sendMessage} from './mail.mjs';
import {nextDigestAt,queueDigest} from './digest.mjs';
export function configured(env) {
 return env.DELIVERY_ENABLED==='true'&&!!env.DB&&typeof env.RESEND_API_KEY==='string'&&env.RESEND_API_KEY.startsWith('re_')&&typeof env.TOKEN_SECRET==='string'&&/^[A-Za-z0-9_-]{43}$/.test(env.TOKEN_SECRET)&&!!env.TURNSTILE_SECRET&&!!env.TURNSTILE_SITE_KEY&&!!env.RESEND_WEBHOOK_SECRET&&/^Bathos <[a-z0-9.-]+@mail\.bathos\.org>$/.test(env.MAIL_FROM||'');
}
export async function ready(env) {return configured(env)&&!!await statement(env,"SELECT value FROM metadata WHERE key='baseline' AND value='1'").first();}
export function catalogPosts(catalog) {
 if(!catalog||catalog.version!==1||catalog.siteUrl!==ORIGIN||!Array.isArray(catalog.articles)||catalog.articles.length>2000)throw Error('invalid catalog');
 const guids=new Set();
 return catalog.articles.map(post=>{
  if(typeof post.slug!=='string'||!post.slug||post.slug.length>200||/[\\/]/.test(post.slug)||typeof post.title!=='string'||!post.title.trim()||post.title.length>300||typeof post.summary!=='string'||post.summary.length>4000||post.canonicalUrl!==`${ORIGIN}/posts/${encodeURIComponent(post.slug)}/`||guids.has(post.canonicalUrl))throw Error('invalid catalog post');
  guids.add(post.canonicalUrl);return {title:post.title,summary:post.summary,canonicalUrl:post.canonicalUrl};
 });
}
export async function discover(env,upstream,now) {
 const owner=await acquireLock(env,'catalog',now);if(!owner)return;
 try {
  const response=await upstream(`${ORIGIN}/articles.json`,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('catalog unavailable');
  const posts=catalogPosts(JSON.parse(await boundedText(response.body,1024*1024)));
  const baseline=!!await statement(env,"SELECT value FROM metadata WHERE key='baseline' AND value='1'").first();
  const batch=[statement(env,'UPDATE posts SET available=0'),
   statement(env,`INSERT INTO posts(guid,payload,discovered_at,included_at,available)
    SELECT json_extract(value,'$.canonicalUrl'),value,?,?,1 FROM json_each(?) WHERE true
    ON CONFLICT(guid) DO UPDATE SET payload=excluded.payload,available=1`,now,baseline?null:now,JSON.stringify(posts))];
  if(!baseline)batch.push(statement(env,"INSERT INTO metadata(key,value) VALUES('baseline','1') ON CONFLICT(key) DO NOTHING"));
  batch.push(statement(env,"INSERT INTO metadata(key,value) VALUES('next_digest_at',?) ON CONFLICT(key) DO NOTHING",String(nextDigestAt(now))));
  await env.DB.batch(batch);
 }finally{await releaseLock(env,'catalog',owner);}
}
export async function dispatch(env,upstream,{clock=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),max=5,jobId=null}={}) {
 const owner=await acquireLock(env,'dispatch',clock());if(!owner)return {sent:0};
 let sent=0;
 try {
  await reconcilePending(env);
  await statement(env,"UPDATE jobs SET state='queued' WHERE state='sending' AND lease_until<=?",clock()).run();
  // Provider idempotency expires after 24h. Ambiguous older jobs need human review.
  await statement(env,"UPDATE jobs SET state='uncertain',last_error='idempotency_window_expired' WHERE state='queued' AND first_attempt_at IS NOT NULL AND first_attempt_at<=?",clock()-23*3600000).run();
  for(let count=0;count<max;count++){
   const now=clock();
   const job=await statement(env,"UPDATE jobs SET state='sending',attempts=attempts+1,lease_until=? WHERE id=(SELECT id FROM jobs WHERE state='queued' AND next_attempt_at<=? AND (? IS NULL OR id=?) ORDER BY created_at,id LIMIT 1) AND state='queued' RETURNING *",now+60000,now,jobId,jobId).first();
   if(!job)break;
   const subscriber=await statement(env,'SELECT * FROM subscribers WHERE id=?',job.subscriber_id).first();
   const data=JSON.parse(job.payload);
   if(!subscriber||(job.kind==='post'?subscriber.status!=='active':subscriber.status!=='pending'||subscriber.generation!==data.generation||data.expires<=now)){
    await statement(env,"UPDATE jobs SET state='cancelled' WHERE id=?",job.id).run();continue;
   }
   if(!await reserveQuota(env,job,now)){
    await statement(env,"UPDATE jobs SET state='queued',next_attempt_at=? WHERE id=? AND state='sending'",now+3600000,job.id).run();break;
   }
   await statement(env,'UPDATE jobs SET first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=?',now,job.id).run();
   const result=await sendMessage(job,subscriber,env,upstream);
   if(result.state==='sent'){
    await statement(env,"UPDATE jobs SET state=CASE WHEN state='sending' THEN 'sent' ELSE state END,message_id=?,last_error=NULL WHERE id=?",result.id,job.id).run();await reconcileEvents(env,result.id);sent++;
   }else{
    const delay=Math.min(3600000,60000*2**Math.min(job.attempts,6));
    await statement(env,"UPDATE jobs SET state=?,next_attempt_at=?,last_error=? WHERE id=? AND state='sending'",result.state==='retry'?'queued':'failed',now+delay,result.error,job.id).run();
    console.log(JSON.stringify({event:'email_delivery',state:result.state,code:result.error,job_id:job.id}));
   }
   if(count+1<max)await sleep(600);
  }
  return {sent};
 }finally{await releaseLock(env,'dispatch',owner);}
}
export async function cleanup(env,now) {
 await env.DB.batch([
  statement(env,"DELETE FROM subscribers WHERE status='pending' AND requested_at<?",now-7*86400000),
  statement(env,"DELETE FROM subscribers WHERE status IN ('unsubscribed','suppressed') AND unsubscribed_at<?",now-90*86400000),
  statement(env,"DELETE FROM jobs WHERE state IN ('sent','cancelled','failed') AND created_at<?",now-90*86400000),
  statement(env,'DELETE FROM webhook_events WHERE received_at<?',now-7*86400000),
  statement(env,'DELETE FROM signup_limits WHERE window<?',Math.floor(now/3600000)-24),
  statement(env,'DELETE FROM send_attempts WHERE at<?',now-40*86400000),
 ]);
}
export async function scheduled(env,upstream=fetch,options={}) {
 const now=options.clock?.()??Date.now();
 if(!env.DB)return;
 await reconcilePending(env);
 await cleanup(env,now);
 if(!configured(env))return;
 await discover(env,upstream,now);
 await queueDigest(env,now,{weekly:true});
 return dispatch(env,upstream,options);
}
