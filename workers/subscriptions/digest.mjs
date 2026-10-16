import {ORIGIN,token,verifyToken} from './security.mjs';
import {statement,acquireLock,releaseLock} from './store.mjs';

export const DIGEST_SCHEDULE='Mondays at 09:00 UK time';
export function nextDigestAt(now) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 const day=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)));
 day.setUTCDate(day.getUTCDate()+(8-day.getUTCDay())%7);
 const atNine=()=>{
  const utc=day.getTime()+9*3600000;
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(utc));
  return utc-(hour-9)*3600000;
 };
 let next=atNine();
 if(next<=now){day.setUTCDate(day.getUTCDate()+7);next=atNine();}
 return next;
}
async function snapshot(env) {
 const {results}=await statement(env,'SELECT guid,payload,discovered_at FROM posts WHERE included_at IS NULL AND available=1 ORDER BY discovered_at,guid').all();
 const row=await statement(env,"SELECT count(*) AS count FROM subscribers s WHERE status='active' AND EXISTS(SELECT 1 FROM posts p WHERE p.included_at IS NULL AND p.available=1 AND s.confirmed_at<=p.discovered_at)").first();
 return {posts:results.map(p=>({...JSON.parse(p.payload),discoveredAt:p.discovered_at})),recipients:row.count};
}
async function fingerprint(data) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function digestPreview(env,now) {
 const data=await snapshot(env);
 const preview=await token(env.TOKEN_SECRET,'digest-preview',`${now+15*60000}.${await fingerprint(data)}`);
 return {...data,preview,schedule:DIGEST_SCHEDULE};
}
// Same catalog lease as discovery: concurrent manual/cron requests cannot select
// the same posts twice. Jobs and consumed post identities commit atomically.
export async function queueDigest(env,now,{preview=null,weekly=false}={}) {
 const owner=await acquireLock(env,'catalog',now);
 if(!owner)return {busy:true};
 try{
  if(weekly){
   const due=await statement(env,"SELECT value FROM metadata WHERE key='next_digest_at'").first();
   if(!due||Number(due.value)>now)return {notDue:true};
  }
  const data=await snapshot(env);
  if(preview!==null){
   const value=await verifyToken(env.TOKEN_SECRET,'digest-preview',preview);
   const [expires,hash,...rest]=(value||'').split('.');
   if(rest.length||!/^\d{13}$/.test(expires)||Number(expires)<=now||Number(expires)>now+15*60000||hash!==await fingerprint(data))return {changed:true};
  }
  const id=crypto.randomUUID();
  const batch=[];
  if(data.posts.length){
   batch.push(statement(env,'INSERT INTO digests(id,created_at,post_count) VALUES(?,?,?)',id,now,data.posts.length));
   // kind=post remains the notification class; each job now holds a digest.
   // New subscribers only receive posts discovered since they confirmed.
   batch.push(statement(env,`INSERT INTO jobs(id,subscriber_id,kind,payload,created_at)
    SELECT ?||'-'||s.id,s.id,'post',json_object('digestId',?,'posts',json_group_array(json(p.payload))),?
    FROM subscribers s JOIN (SELECT * FROM posts WHERE included_at IS NULL AND available=1 ORDER BY discovered_at,guid) p ON s.confirmed_at<=p.discovered_at
    WHERE s.status='active' GROUP BY s.id`,id,id,now));
   batch.push(statement(env,'UPDATE posts SET included_at=? WHERE included_at IS NULL AND available=1',now));
  }
  if(weekly)batch.push(statement(env,"INSERT INTO metadata(key,value) VALUES('next_digest_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(nextDigestAt(now))));
  if(batch.length)await env.DB.batch(batch);
  return {queued:data.recipients,posts:data.posts.length,...(data.posts.length?{digestId:id}:{})};
 }finally{await releaseLock(env,'catalog',owner);}
}
// Authenticate using the existing manager session over an internal binding.
// No subscriber addresses, OAuth tokens or new admin credentials reach the UI.
export async function managerAuthorized(request,env) {
 if(!env.ADMIN||!request.headers.get('Cookie'))return false;
 const response=await env.ADMIN.fetch(new Request(`${ORIGIN}/api/session`,{headers:{Cookie:request.headers.get('Cookie')},signal:AbortSignal.timeout(10000)}));
 if(!response.ok)return false;
 const data=await response.json();
 return data.authenticated===true&&typeof data.user?.login==='string';
}
