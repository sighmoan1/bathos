import {ORIGIN,PREFIX,escapeHtml,token,boundedText} from './security.mjs';
export async function messageFor(job,subscriber,env) {
 const data=JSON.parse(job.payload);
 const unsubscribe=`${ORIGIN}${PREFIX}/unsubscribe?token=${encodeURIComponent(await token(env.TOKEN_SECRET,'unsubscribe',subscriber.id))}`;
 let subject,text,html;
 if(job.kind==='confirmation'){
  const confirmation=await token(env.TOKEN_SECRET,'confirm',`${subscriber.id}.${data.generation}.${data.expires}`);
  const link=`${ORIGIN}${PREFIX}/confirm?token=${encodeURIComponent(confirmation)}`;
  subject='Confirm your Bathos subscription';
  text=`Please confirm that you want a weekly digest of new Bathos posts by email:\n\n${link}\n\nThis link expires in 48 hours. If you did not request this, ignore this message.\nCancel this request: ${unsubscribe}`;
  html=`<h1>New thoughts from Bathos</h1><p>Confirm that you want a weekly digest of new posts. No ads. No email when there is nothing new.</p><p><a href="${escapeHtml(link)}">Confirm subscription</a></p><p>This link expires in 48 hours. If you did not request this, ignore this message.</p>`;
 } else if(Array.isArray(data.posts)&&data.posts.length){
  subject=`Bathos update: ${data.posts.length} new ${data.posts.length===1?'post':'posts'}`;
  text=`New writing from Bathos\n\n${data.posts.map(post=>`${post.title}\n${post.summary}\n${post.canonicalUrl}`).join('\n\n')}\n\nYou subscribed to the Bathos digest. Unsubscribe: ${unsubscribe}`;
  html=`<h1>New writing from Bathos</h1>${data.posts.map(post=>`<h2><a href="${escapeHtml(post.canonicalUrl)}">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.summary)}</p>`).join('')}<p>You subscribed to the Bathos digest.</p>`;
 } else {
  // Preserve the body of legacy attempted jobs for provider idempotency.
  subject=`Bathos: ${data.title.replace(/[\r\n]/g,' ').slice(0,200)}`;
  text=`${data.title}\n\n${data.summary}\n\nRead the post: ${data.canonicalUrl}\n\nYou subscribed to new Bathos posts. Unsubscribe: ${unsubscribe}`;
  html=`<h1>${escapeHtml(data.title)}</h1><p>${escapeHtml(data.summary)}</p><p><a href="${escapeHtml(data.canonicalUrl)}">Read the post on Bathos</a></p><p>You subscribed to new Bathos posts.</p>`;
 }
 return {from:env.MAIL_FROM,to:[subscriber.email],subject,text,tags:[{name:'bathos_job',value:job.id}],html:`<!doctype html><html lang="en"><body>${html}<p><a href="${escapeHtml(unsubscribe)}">Unsubscribe</a></p></body></html>`,headers:{'List-Unsubscribe':`<${unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
}
export async function sendMessage(job,subscriber,env,upstream) {
 const message=await messageFor(job,subscriber,env);
 try {
  const response=await upstream('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`bathos/${job.id}`},body:JSON.stringify(message),signal:AbortSignal.timeout(10000)});
  if(!response.ok){return {state:response.status===429||response.status===409||response.status>=500?'retry':'failed',error:`provider_${response.status}`};}
  const result=JSON.parse(await boundedText(response.body,8192));
  if(typeof result.id!=='string'||!result.id||result.id.length>200)return {state:'retry',error:'invalid_provider_response'};
  return {state:'sent',id:result.id};
 }catch{return {state:'retry',error:'provider_connection'};}
}
