export const ORIGIN = 'https://bathos.org';
export const PREFIX = '/api/subscriptions';
const encoder = new TextEncoder();
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(value) { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)); }
async function key(secret) {
 const bytes = decode(secret || '');
 if(bytes.length !== 32) throw Error('invalid token configuration');
 return crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function token(secret,purpose,payload) {
 return `${payload}.${base64url(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(`${purpose}:${payload}`))))}`;
}
export async function verifyToken(secret,purpose,value) {
 if(typeof value !== 'string' || value.length > 256 || !/^[A-Za-z0-9_.-]+$/.test(value)) return null;
 const position=value.lastIndexOf('.'), payload=value.slice(0,position);
 if(position<1) return null;
 try { const signature=decode(value.slice(position+1)); if(base64url(signature)!==value.slice(position+1))return null; return await crypto.subtle.verify('HMAC',await key(secret),signature,encoder.encode(`${purpose}:${payload}`)) ? payload : null; }
 catch { return null; }
}
export function emailAddress(value) {
 if(typeof value !== 'string') return null;
 const email=value.trim().toLowerCase();
 if(email.length>254 || !/^[a-z0-9!#$%&'*+\/=?^_`{|}~.-]{1,64}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) || email.includes('..') || email.startsWith('.') || email.includes('.@')) return null;
 if(email.split('@')[1].split('.').some(label=>!/^([a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/.test(label)))return null;
 return email;
}
export async function boundedText(body,limit) {
 const reader=body?.getReader(); if(!reader) return '';
 const chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('body too large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function verifyChallenge(request,env,response,upstream) {
 if(typeof response!=='string'||!response||response.length>2048) return false;
 try {
  const result=await upstream('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response,...(request.headers.get('CF-Connecting-IP')?{remoteip:request.headers.get('CF-Connecting-IP')}:{})}),signal:AbortSignal.timeout(10000)});
  if(!result.ok)return false;
  const data=JSON.parse(await boundedText(result.body,8192));
  return data.success===true&&data.action==='subscribe'&&data.hostname==='bathos.org';
 } catch{return false;}
}
export async function verifyWebhook(request,env,body,now) {
 const id=request.headers.get('svix-id'), stamp=request.headers.get('svix-timestamp'), signatures=request.headers.get('svix-signature');
 if(!id || id.length>200 || !/^\d{10}$/.test(stamp||'') || Math.abs(now/1000-Number(stamp))>300 || !signatures || signatures.length>2048 || !env.RESEND_WEBHOOK_SECRET?.startsWith('whsec_'))return false;
 try {
  const signingKey=await crypto.subtle.importKey('raw',Uint8Array.from(atob(env.RESEND_WEBHOOK_SECRET.slice(6)),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const signature of signatures.split(' ')){const [version,value]=signature.split(',');if(version==='v1'&&value&&await crypto.subtle.verify('HMAC',signingKey,Uint8Array.from(atob(value),c=>c.charCodeAt(0)),encoder.encode(`${id}.${stamp}.${body}`)))return true;}
 }catch{}
 return false;
}
export async function ipKey(request,secret) {
 const value=request.headers.get('CF-Connecting-IP')||'unknown';
 return (await token(secret,'ip',value.replace(/[^a-zA-Z0-9:.]/g,'').slice(0,80))).split('.').pop();
}
