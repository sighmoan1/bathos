import {ORIGIN,PREFIX,escapeHtml,verifyToken,verifyChallenge,verifyWebhook,emailAddress,boundedText,ipKey} from './security.mjs';
import {statement,requestSubscription,stopSubscription} from './store.mjs';
import {recordEvent} from './events.mjs';
import {ready,dispatch,scheduled,discover} from './delivery.mjs';
import {managerAuthorized,digestPreview,queueDigest} from './digest.mjs';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
const json=(data,status=200)=>Response.json(data,{status,headers});
const unavailable=()=>json({error:'Email subscriptions are temporarily unavailable. Please use RSS for now.'},503);
function page(title,message,action,tokenValue,status=200){
 const form=action?`<form method="post" action="${PREFIX}/${action}"><input type="hidden" name="token" value="${escapeHtml(tokenValue)}"><button>${action==='confirm'?'Confirm subscription':'Unsubscribe'}</button></form>`:'';
 const nonce=crypto.randomUUID();
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Bathos</title><style nonce="${nonce}">body{font:18px/1.6 system-ui;background:#f4f3f5;color:#231b2b;margin:0;padding:24px}main{max-width:540px;margin:48px auto}h1{font-size:32px;line-height:1.2}button,a{min-height:48px}button{padding:12px 24px;border:0;border-radius:8px;background:#231b2b;color:white;font:inherit;cursor:pointer}a{display:inline-flex;align-items:center;color:inherit}</style></head><body><main><a href="/subscribe/">← Bathos</a><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${form}</main></body></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`}});
}
async function confirmation(env,value,now,consume){
 const payload=await verifyToken(env.TOKEN_SECRET,'confirm',value);
 const parts=payload?.split('.');if(!parts||parts.length!==3||!/^\d{13}$/.test(parts[2])||Number(parts[2])<=now)return false;
 const [id,generation,expires]=parts;
 const subscriber=await statement(env,'SELECT * FROM subscribers WHERE id=?',id).first();
 if(!subscriber||subscriber.generation!==generation||subscriber.confirmation_expires!==Number(expires)||!['pending','active'].includes(subscriber.status))return false;
 if(consume&&subscriber.status==='pending')return !!await statement(env,"UPDATE subscribers SET status='active',confirmed_at=COALESCE(confirmed_at,?) WHERE id=? AND generation=? AND status='pending' RETURNING id",now,id,generation).first();
 return true;
}
export async function handleRequest(request,env,upstream=fetch,clock=Date.now){
 const url=new URL(request.url),now=clock();
 try{
  if(url.origin!==ORIGIN||!url.pathname.startsWith(PREFIX))return json({error:'Not found.'},404);
  if(url.pathname===`${PREFIX}/status`&&request.method==='GET'){
   const enabled=await ready(env);return json({enabled,...(enabled?{siteKey:env.TURNSTILE_SITE_KEY}:{})});
  }
  if(url.pathname===`${PREFIX}/digest`&&['GET','POST'].includes(request.method)){
   if(request.method==='POST'&&request.headers.get('Origin')!==ORIGIN)return json({error:'Reload the manager and try again.'},403);
   if(!await managerAuthorized(request,env))return json({error:'Sign in to manage email updates.'},401);
   if(!env.DB||!env.TOKEN_SECRET)return unavailable();
   if(request.method==='POST'&&!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return json({error:'Send JSON content.'},415);
   // Refresh from deployed content, never unpublished manager drafts.
   await discover(env,upstream,now);
   const enabled=await ready(env);
   if(request.method==='GET')return json({enabled,...await digestPreview(env,now)});
   if(!enabled)return unavailable();
   let data;try{data=JSON.parse(await boundedText(request.body,1024));}catch{return json({error:'Invalid update request.'},400);}
   if(typeof data?.preview!=='string'||data.preview.length>500)return json({error:'Preview the update before sending.'},400);
   const result=await queueDigest(env,now,{preview:data.preview});
   if(result.busy||result.changed)return json({error:'The update changed. Refresh the preview before sending.'},409);
   // Delivery is drained by the existing five-minute cron and quota controls.
   return json(result,202);
  }
  if(url.pathname===PREFIX&&request.method==='POST'){
   if(request.headers.get('Origin')!==ORIGIN)return json({error:'Reload the subscription page and try again.'},403);
   if(!await ready(env))return unavailable();
   if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return json({error:'Send JSON content.'},415);
   let data;try{data=JSON.parse(await boundedText(request.body,4096));}catch{return json({error:'Invalid subscription request.'},400);}
   const email=emailAddress(data?.email);if(!email)return json({error:'Enter a valid email address.'},400);
   const rate=await statement(env,'INSERT INTO signup_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET count=count+1 WHERE count<5 RETURNING count',await ipKey(request,env.TOKEN_SECRET),Math.floor(now/3600000)).first();
   if(!rate)return json({error:'Too many attempts. Please try again in an hour.'},429);
   if(!await verifyChallenge(request,env,data.token,upstream))return json({error:'Please complete the verification again.'},403);
   const jobId=await requestSubscription(env,email,now);
   if(jobId){
    await dispatch(env,upstream,{clock,max:1,jobId});
    const job=await statement(env,'SELECT state FROM jobs WHERE id=?',jobId).first();
    if(job?.state==='failed')return unavailable();
   }
   return json({ok:true,message:'If your subscription needs confirmation, an email will arrive shortly. Check your inbox and spam folder.'},202);
  }
  if(url.pathname===`${PREFIX}/confirm`&&['GET','POST'].includes(request.method)){
   if(!env.DB||!env.TOKEN_SECRET)return unavailable();
   let value=url.searchParams.get('token');
   if(request.method==='POST'){
    if(request.headers.get('Origin')!==ORIGIN)return page('Could not confirm','Return to the subscription page and try again.',null,null,403);
    if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return json({error:'Invalid form.'},415);
    value=new URLSearchParams(await boundedText(request.body,1024)).get('token');
   }
   if(!await confirmation(env,value,now,request.method==='POST'))return page('This link has expired','Please subscribe again to receive a new confirmation link.',null,null,400);
   return request.method==='GET'?page('Confirm your subscription','Receive a weekly digest of new Bathos posts. No ads. Tap below to confirm.', 'confirm',value):page('You’re subscribed','You will receive a weekly digest when there are new posts from Bathos. You can unsubscribe using the link in any email.');
  }
  if(url.pathname===`${PREFIX}/unsubscribe`&&['GET','POST'].includes(request.method)){
   if(!env.DB||!env.TOKEN_SECRET)return unavailable();
   let value=url.searchParams.get('token');
   if(request.method==='POST'){
    if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return json({error:'Invalid form.'},415);
    const fields=new URLSearchParams(await boundedText(request.body,1024));
    const oneClick=fields.get('List-Unsubscribe')==='One-Click'&&!!value;
    if(request.headers.get('Origin')!==ORIGIN&&!oneClick)return json({error:'Invalid request origin.'},403);
    value=oneClick?value:fields.get('token');
   }
   const id=await verifyToken(env.TOKEN_SECRET,'unsubscribe',value);
   if(!id||!/^[a-f0-9-]{36}$/.test(id))return page('Invalid unsubscribe link','Please use the unsubscribe link in your Bathos email.',null,null,400);
   if(request.method==='POST'){await stopSubscription(env,id,'unsubscribed',now);return page('You’re unsubscribed','You will no longer receive new Bathos posts.');}
   return page('Unsubscribe from Bathos','Tap below to stop receiving new posts.', 'unsubscribe',value);
  }
  if(url.pathname===`${PREFIX}/webhook`&&request.method==='POST'){
   const body=await boundedText(request.body,32768);
   if(!await verifyWebhook(request,env,body,now))return json({error:'Invalid signature.'},403);
   let event;try{event=JSON.parse(body);}catch{return json({error:'Invalid event.'},400);}
   const id=event?.data?.email_id;
   if(typeof id!=='string'||id.length>200)return json({ok:true});
   await recordEvent(env,event.type,id,now);
   return json({ok:true});
  }
  return json({error:'Not found.'},404);
 }catch{
  console.log(JSON.stringify({event:'subscription_request_failed',path:url.pathname}));
  return unavailable();
 }
}
export default {
 fetch(request,env){return handleRequest(request,env);},
 scheduled(controller,env,ctx){ctx.waitUntil(scheduled(env).catch(()=>console.log(JSON.stringify({event:'subscription_schedule_failed'}))));},
};
