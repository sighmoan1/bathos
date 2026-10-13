import {statement,stopSubscription} from './store.mjs';
const knownTypes=new Set(['email.delivered','email.bounced','email.complained','email.suppressed','email.failed']);
export async function reconcileEvents(env,messageId){
 const job=await statement(env,'SELECT subscriber_id FROM jobs WHERE message_id=?',messageId).first();
 if(!job)return;
 const {results}=await statement(env,'SELECT type,received_at FROM webhook_events WHERE message_id=? ORDER BY received_at,type',messageId).all();
 for(const event of results){
  if(event.type==='email.delivered')await statement(env,'UPDATE jobs SET delivered_at=COALESCE(delivered_at,?) WHERE message_id=?',event.received_at,messageId).run();
  else{
   await statement(env,"UPDATE jobs SET state=CASE WHEN state='cancelled' THEN state ELSE 'failed' END,last_error=? WHERE message_id=?",event.type,messageId).run();
   if(event.type!=='email.failed')await stopSubscription(env,job.subscriber_id,'suppressed',event.received_at);
  }
  await statement(env,'DELETE FROM webhook_events WHERE message_id=? AND type=?',messageId,event.type).run();
 }
}
export async function recordEvent(env,type,messageId,now){
 if(!knownTypes.has(type))return;
 // A receipt can beat the send API response. Keep it until its job has a provider ID.
 await statement(env,'INSERT INTO webhook_events(message_id,type,received_at) VALUES(?,?,?) ON CONFLICT(message_id,type) DO NOTHING',messageId,type,now).run();
 await reconcileEvents(env,messageId);
}

export async function reconcilePending(env){
 const {results}=await statement(env,'SELECT DISTINCT e.message_id FROM webhook_events e JOIN jobs j ON j.message_id=e.message_id LIMIT 20').all();
 for(const event of results)await reconcileEvents(env,event.message_id);
}
