import {HttpError, publicURL, safeHTML, boundedText, digest, authenticated} from './security.mjs';
import {decodeHTML,decodeHTMLAttribute} from 'entities';
const LEASE = 86400;
function targetURL(value, env) {
  const url = publicURL(value);
  if (url.origin !== env.SITE_ORIGIN || !/^\/posts\/[^/]+\/$/.test(url.pathname) || url.search) throw new HttpError(400, 'Target must be a canonical Bathos post');
  return url.href;
}
export async function reviewedHTML(html) {
  // Inert markup and executable scripts are outside the server-reviewed content.
  // Keep all remaining HTML, including body, metadata and backlink attributes.
  return new HTMLRewriter().on('script, template',{element(element){element.remove();}}).transform(new Response(html)).text();
}
export async function inspectHTML(html, base, target, canonical = false) {
  let linked = false, title = '', author = '', published = null;
  const active=await reviewedHTML(html);
  let documentBase=base,seenBase=false;
  await new HTMLRewriter().on('base[href]',{element(element){if(seenBase)return;seenBase=true;try{documentBase=new URL(decodeHTMLAttribute(element.getAttribute('href')),base).href;}catch{}}}).transform(new Response(active)).arrayBuffer();
  const rewriter = new HTMLRewriter()
    .on(canonical ? 'link[rel~="canonical"][href]' : 'a[href], link[href]', {element(element) {
      try { const href = new URL(decodeHTMLAttribute(element.getAttribute('href')), documentBase); href.hash=''; if (href.href === target) linked=true; } catch {}
    }})
    .on('title', {text(chunk) { title = (title + chunk.text).slice(0,200); }})
    .on('meta[name="author"]', {element(element) { author=(element.getAttribute('content') || '').slice(0,100); }})
    .on('meta[property="article:published_time"]', {element(element) { const date=element.getAttribute('content'); if (date && !Number.isNaN(Date.parse(date))) published=new Date(date).toISOString(); }});
  await rewriter.transform(new Response(active)).arrayBuffer();
  const plain = value => decodeHTML(value).replace(/[\u0000-\u001f\u007f]/g,' ').trim();
  return {linked,name:plain(title),author:plain(author),published};
}
export async function verify(source,target,env) {
  const local = await safeHTML(target);
  if (local.gone || local.url !== target || !(await inspectHTML(local.html,local.url,target,true)).linked) throw new HttpError(422,'Target is not a published canonical post');
  const remote = await safeHTML(source);
  if (remote.gone) return null;
  const reviewed = await reviewedHTML(remote.html);
  const metadata = await inspectHTML(reviewed,remote.url,target);
  if (!metadata.linked) return null;
  return {...metadata,fingerprint:await digest(reviewed)};
}
async function limit(db,key,maximum,seconds,now) {
  const bucket = `${key}:${Math.floor(now/seconds)}`;
  const row = await db.prepare('INSERT INTO limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count').bind(bucket,now+seconds,maximum).first();
  if (!row) throw new HttpError(429,'Rate limit exceeded');
}
async function retract(db,source,target) { await db.prepare('DELETE FROM mentions WHERE source=? AND target=?').bind(source,target).run(); }
async function receive(request,env,now) {
  const ip=request.headers.get('cf-connecting-ip');
  if (!ip) throw new HttpError(503,'Trusted client address unavailable');
  await limit(env.DB,`ip:${await digest(`${env.RATE_SALT}:${ip}`)}`,20,60,now);
  await limit(env.DB,'global',200,3600,now);
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('content-type')||'')) throw new HttpError(415,'Expected form encoding');
  const form = new URLSearchParams(await boundedText(request,8192));
  if (form.getAll('source').length !== 1 || form.getAll('target').length !== 1) throw new HttpError(400,'Provide one source and target');
  const source=publicURL(form.get('source')).href, target=targetURL(form.get('target'),env);
  if (source===target) throw new HttpError(400,'Source must differ from target');
  await limit(env.DB,`host:${new URL(source).hostname}`,30,3600,now);
  const proof=await verify(source,target,env);
  if (!proof) { await retract(env.DB,source,target); return {status:200,data:{status:'removed'}}; }
  const result=await env.DB.prepare(`INSERT INTO mentions(source,target,state,name,author,published,fingerprint,verified_at,updated_at)
    SELECT ?,?,'pending',?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM mentions)<1000 OR EXISTS(SELECT 1 FROM mentions WHERE source=? AND target=?)
    ON CONFLICT(source,target) DO UPDATE SET state=CASE WHEN fingerprint=excluded.fingerprint THEN state ELSE 'pending' END,
    name=excluded.name,author=excluded.author,published=excluded.published,fingerprint=excluded.fingerprint,verified_at=excluded.verified_at,updated_at=excluded.updated_at`).bind(source,target,proof.name,proof.author,proof.published,proof.fingerprint,now,now,source,target).run();
  if (!result.meta.changes) throw new HttpError(429,'Storage quota reached');
  return {status:202,data:{status:'received'}};
}
async function admin(request,url,env,now) {
  if (!await authenticated(request,env.MODERATOR_TOKEN)) throw new HttpError(401,'Unauthorized');
  if (request.method==='GET' && url.pathname==='/api/webmention/admin') {
    const rawOffset=url.searchParams.get('offset') ?? '0';
    if(url.searchParams.getAll('offset').length>1 || !/^(?:0|[1-9]\d{0,2})$/.test(rawOffset)) throw new HttpError(400,'Offset must be an integer from 0 to 999');
    const offset=Number(rawOffset);
    const rows=await env.DB.prepare('SELECT source,target,state,name,author,published,fingerprint,verified_at,updated_at FROM mentions ORDER BY updated_at DESC,source,target LIMIT 100 OFFSET ?').bind(offset).all();
    return {status:200,data:{mentions:rows.results,offset,nextOffset:rows.results.length===100 && offset+100<=999 ? offset+100 : null}};
  }
  if (request.method!=='POST' || url.pathname!=='/api/webmention/admin') throw new HttpError(405,'Method not allowed');
  let body; try { body=JSON.parse(await boundedText(request,8192)); } catch(error) { if (error instanceof HttpError) throw error; throw new HttpError(400,'Invalid JSON'); }
  if (!body || typeof body!=='object' || Array.isArray(body)) throw new HttpError(400,'Invalid moderation object');
  const source=publicURL(body.source).href,target=targetURL(body.target,env);
  if (!['approved','rejected','delete'].includes(body.state)) throw new HttpError(400,'Invalid moderation state');
  const existing=await env.DB.prepare('SELECT * FROM mentions WHERE source=? AND target=?').bind(source,target).first();
  if (!existing) throw new HttpError(404,'Mention not found');
  if (body.state==='delete') await retract(env.DB,source,target);
  else if (body.state==='approved') {
    if(typeof body.fingerprint!=='string' || body.fingerprint!==existing.fingerprint) throw new HttpError(409,'Review the current mention before approval');
    const proof=await verify(source,target,env);
    if (!proof) { await retract(env.DB,source,target); throw new HttpError(422,'Backlink no longer exists'); }
    // Compare against the moderator's reviewed version. Concurrent updates cannot be approved accidentally.
    if (proof.fingerprint!==existing.fingerprint) throw new HttpError(409,'Source changed; receive and review it again');
    const result=await env.DB.prepare("UPDATE mentions SET state='approved',verified_at=?,updated_at=? WHERE source=? AND target=? AND fingerprint=?").bind(now,now,source,target,existing.fingerprint).run();
    if (!result.meta.changes) throw new HttpError(409,'Mention changed during moderation');
  } else await env.DB.prepare("UPDATE mentions SET state='rejected',updated_at=? WHERE source=? AND target=?").bind(now,source,target).run();
  return {status:200,data:{status:body.state}};
}
function response(data,status,request,env) {
  const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
  if (request.headers.get('origin')===env.SITE_ORIGIN) { headers['access-control-allow-origin']=env.SITE_ORIGIN; headers.vary='Origin'; }
  if (status===429) headers['retry-after']='3600';
  return Response.json(data,{status,headers});
}
export default {
  async fetch(request,env) {
    try {
      if (env.ENABLED!=='true' || !env.DB || !env.RATE_SALT || env.RATE_SALT.length<32 || env.SITE_ORIGIN!=='https://bathos.org' || !env.MODERATOR_TOKEN || env.MODERATOR_TOKEN.length<32) throw new HttpError(503,'Webmention service is not configured');
      const url=new URL(request.url),now=Math.floor(Date.now()/1000); let result;
      if(request.method==='GET') {
        const ip=request.headers.get('cf-connecting-ip'); if(!ip) throw new HttpError(503,'Trusted client address unavailable');
        await limit(env.DB,`read-ip:${await digest(`${env.RATE_SALT}:${ip}`)}`,60,60,now);
        await limit(env.DB,'read-global',10000,3600,now);
      }
      if (url.pathname==='/api/webmention' && request.method==='POST') result=await receive(request,env,now);
      else if (url.pathname==='/api/webmention/responses' && request.method==='GET') {
        const target=targetURL(url.searchParams.get('target'),env);
        const rows=await env.DB.prepare("SELECT source,target,name,author,published FROM mentions WHERE target=? AND state='approved' AND verified_at>? ORDER BY updated_at DESC LIMIT 100").bind(target,now-LEASE).all();
        result={status:200,data:{responses:rows.results}};
      } else if (url.pathname==='/api/webmention/admin') result=await admin(request,url,env,now);
      else throw new HttpError(404,'Not found');
      return response(result.data,result.status,request,env);
    } catch(error) {
      if (!(error instanceof HttpError)) console.error(JSON.stringify({event:'webmention_storage_or_runtime_failure'}));
      return response({error:error instanceof HttpError?error.message:'Service unavailable'},error instanceof HttpError?error.status:503,request,env);
    }
  },
  async scheduled(controller,env) {
    if (env.ENABLED!=='true' || !env.DB) return;
    const now=Math.floor(Date.now()/1000);
    await env.DB.prepare('DELETE FROM limits WHERE expires < ?').bind(now).run();
    const rows=await env.DB.prepare("SELECT source,target,fingerprint FROM mentions WHERE state='approved' ORDER BY last_checked_at LIMIT 1").all();
    for (const row of rows.results) {
      // Rotate attempts even after network failures; never renew a failed proof lease.
      await env.DB.prepare('UPDATE mentions SET last_checked_at=? WHERE source=? AND target=?').bind(now,row.source,row.target).run();
      try {
        const proof=await verify(row.source,row.target,env);
        if (!proof) await retract(env.DB,row.source,row.target);
        else if (proof.fingerprint===row.fingerprint) await env.DB.prepare('UPDATE mentions SET verified_at=? WHERE source=? AND target=? AND fingerprint=?').bind(now,row.source,row.target,row.fingerprint).run();
        else await env.DB.prepare("UPDATE mentions SET state='pending',verified_at=0 WHERE source=? AND target=? AND fingerprint=?").bind(row.source,row.target,row.fingerprint).run();
      } catch { /* Failure does not extend the verification lease; stale responses disappear. */ }
    }
  }
};
