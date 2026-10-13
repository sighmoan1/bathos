import {token} from './security.mjs';
export const statement = (env,sql,...params) => env.DB.prepare(sql).bind(...params);
export async function requestSubscription(env,email,now) {
 const addressHash=(await token(env.TOKEN_SECRET,'suppression',email)).split('.').pop();
 if(await statement(env,'SELECT address_hash FROM suppressions WHERE address_hash=?',addressHash).first())return null;
 await statement(env,"INSERT INTO subscribers(id,email,status,created_at) VALUES(?,?,'pending',?) ON CONFLICT(email) DO NOTHING",crypto.randomUUID(),email,now).run();
 const generation=crypto.randomUUID(), expires=now+48*3600000;
 const id=`confirm-${generation}`, payload=JSON.stringify({generation,expires});
 // The cooldown update and durable confirmation job must commit together.
 await env.DB.batch([
  statement(env,"UPDATE subscribers SET status='pending',requested_at=?,generation=?,confirmation_expires=?,confirmed_at=NULL,unsubscribed_at=NULL WHERE email=? AND status IN ('pending','unsubscribed') AND requested_at<=?",now,generation,expires,email,now-3600000),
  statement(env,"UPDATE jobs SET state='cancelled' WHERE subscriber_id=(SELECT id FROM subscribers WHERE email=? AND generation=?) AND kind='confirmation' AND state IN ('queued','sending')",email,generation),
  statement(env,"INSERT INTO jobs(id,subscriber_id,kind,payload,created_at) SELECT ?,id,'confirmation',?,? FROM subscribers WHERE email=? AND generation=?",id,payload,now,email,generation),
 ]);
 return (await statement(env,'SELECT id FROM jobs WHERE id=?',id).first())?.id||null;
}
export async function stopSubscription(env,id,status,now) {
 const queries=[];
 if(status==='suppressed'){
  const subscriber=await statement(env,'SELECT email FROM subscribers WHERE id=?',id).first();
  if(subscriber)queries.push(statement(env,'INSERT INTO suppressions(address_hash,created_at) VALUES(?,?) ON CONFLICT(address_hash) DO NOTHING',(await token(env.TOKEN_SECRET,'suppression',subscriber.email)).split('.').pop(),now));
 }
 await env.DB.batch([
  ...queries,
  statement(env,"UPDATE subscribers SET status=?,unsubscribed_at=?,generation=NULL,confirmation_expires=NULL WHERE id=?",status,now,id),
  statement(env,"UPDATE jobs SET state='cancelled' WHERE subscriber_id=? AND state IN ('queued','sending')",id),
 ]);
}
export async function reserveQuota(env,job,now) {
 const day=new Date(now);day.setUTCHours(0,0,0,0);
 const month=new Date(day);month.setUTCDate(1);
 const daily=Number(env.DAILY_LIMIT),monthly=Number(env.MONTHLY_LIMIT);
 if(!Number.isInteger(daily)||daily<1||daily>90||!Number.isInteger(monthly)||monthly<1||monthly>2700)return false;
 const result=await statement(env,'INSERT INTO send_attempts(id,at) SELECT ?,? WHERE (SELECT count(*) FROM send_attempts WHERE at>=?)<? AND (SELECT count(*) FROM send_attempts WHERE at>=?)<? RETURNING id',`${job.id}/${job.attempts}`,now,day.getTime(),daily,month.getTime(),monthly).first();
 return !!result;
}
export async function acquireLock(env,name,now,age=240000) {
 const owner=crypto.randomUUID();
 const row=await statement(env,'INSERT INTO locks(name,owner,lease_until) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,lease_until=excluded.lease_until WHERE locks.lease_until<=? RETURNING owner',name,owner,now+age,now).first();
 return row?owner:null;
}
export async function releaseLock(env,name,owner) {await statement(env,'DELETE FROM locks WHERE name=? AND owner=?',name,owner).run();}
