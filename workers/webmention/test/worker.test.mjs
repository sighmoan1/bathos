import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,Response as MFResponse} from 'miniflare';
import {publicURL,publicIP,boundedText,safeHTML} from '../security.mjs';
const target='https://bathos.org/posts/gassing/',source='https://reply.site/reply';
const token='t'.repeat(40);
const bundle=await build({entryPoints:[new URL('../index.mjs',import.meta.url).pathname],bundle:true,format:'esm',platform:'browser',write:false});
async function setup(html=`<title>A reply</title><a href="${target}">Bathos</a>`,extra={}) {
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-13',d1Databases:['DB'],bindings:{ENABLED:'true',SITE_ORIGIN:'https://bathos.org',RATE_SALT:'s'.repeat(40),MODERATOR_TOKEN:token,...extra},outboundService:async request=>{
    const url=new URL(request.url);
    if(url.origin==='https://cloudflare-dns.com') return new MFResponse(JSON.stringify({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}));
    if(url.href===target) return new MFResponse(`<link rel="canonical" href="${target}">`,{status:extra.TARGET_STATUS||200,headers:{'content-type':'text/html'}});
    if(url.origin==='https://reply.site') {const value=typeof html==='object'?html:{body:html};if(value.fail && url.href===source)return new MFResponse('',{status:503});return new MFResponse(value.body,{status:value.status||200,headers:{'content-type':'text/html'}});}
    throw new Error('Unexpected outbound URL '+url.href);
  }}));
  const db=await mf.getD1Database('DB'); await db.exec((await readFile(new URL('../migrations/0001_webmentions.sql',import.meta.url),'utf8')).replace(/\n/g,' '));
  const send=(path,options={})=>mf.dispatchFetch(`https://bathos.org${path}`,options);
  const receive=()=>send('/api/webmention',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','cf-connecting-ip':'203.0.113.1'},body:new URLSearchParams({source,target}).toString()});
  const moderate=async(state,auth=token)=>{const row=await db.prepare('SELECT fingerprint FROM mentions WHERE source=? AND target=?').bind(source,target).first();return send('/api/webmention/admin',{method:'POST',headers:{authorization:`Bearer ${auth}`},body:JSON.stringify({source,target,state,fingerprint:row?.fingerprint})});};
  const responses=()=>send(`/api/webmention/responses?target=${encodeURIComponent(target)}`);
  return {mf,db,send,receive,moderate,responses};
}
test('rejects unsafe URL schemes, credentials, ports, literals and reserved hosts',()=>{
 for (const url of [null,'','ftp://reply.site/x','https://u:p@reply.site/x','https://reply.site:8443/x','http://127.0.0.1','http://2130706433','https://[::1]/','https://[::ffff:127.0.0.1]/','http://metadata.internal/x','https://reply.site/x#fragment']) assert.throws(()=>publicURL(url));
 for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','0.0.0.0','::1','fe80::1','fc00::1','::ffff:127.0.0.1','2001:db8::1']) assert.equal(publicIP(ip),false,ip);
 assert.throws(()=>publicURL('https://reply.site/'+ '😀'.repeat(200)),/Unsafe URL/);
 assert.equal(publicIP('93.184.216.34'),true);
});
test('caps streamed bodies without Content-Length',async()=>{await assert.rejects(()=>boundedText(new Response('abcdef'),4),/Body too large/);});
test('private DNS and each redirect blocked before destination fetch',async()=>{
 let contacted=false;
 await assert.rejects(()=>safeHTML(source,async(url)=>{
  if (url.includes('dns-query')) return Response.json({Status:0,Answer:[{type:1,data:'127.0.0.1'}]}); contacted=true; return new Response('');
 }),/Non-public/); assert.equal(contacted,false);
 await assert.rejects(()=>safeHTML(source,async(url)=>url.includes('dns-query')?Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}):new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}})),/Unsafe host/);
});
test('runtime D1 receive, deduplicate, auth, approve, reject and delete',async(t)=>{
 const app=await setup();t.after(()=>app.mf.dispose());
 assert.equal((await app.receive()).status,202);assert.equal((await app.receive()).status,202);
 assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM mentions').first()).n,1);
 assert.deepEqual(await (await app.responses()).json(),{responses:[]});
 assert.equal((await app.moderate('approved','wrong')).status,401);
 assert.equal((await app.moderate('approved')).status,200);
 const reply=await app.responses();assert.equal(reply.headers.get('cache-control'),'no-store');
 assert.equal((await reply.json()).responses[0].name,'A reply');
 assert.equal((await app.moderate('rejected')).status,200);await app.receive();assert.deepEqual(await (await app.responses()).json(),{responses:[]});
 assert.equal((await app.moderate('delete')).status,200);assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM mentions').first()).n,0);
});
test('HTMLRewriter ignores comments/scripts pretending to contain backlink',async(t)=>{
 const app=await setup(`<!-- <a href="${target}"> --><script>const x='<a href="${target}">';</script>`);t.after(()=>app.mf.dispose());
 assert.equal((await app.receive()).status,200);assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM mentions').first()).n,0);
});
test('relative and entity encoded links verify in real HTML parser',async(t)=>{
 const app=await setup(`<a href="https://bathos.org/posts/gassing/&#35;section">Reply</a><title>A &amp; B</title>`);t.after(()=>app.mf.dispose());
 assert.equal((await app.receive()).status,202);await app.moderate('approved');assert.equal((await (await app.responses()).json()).responses[0].name,'A & B');
});
test('persistent rate limits and stale approvals',async(t)=>{
 const app=await setup();t.after(()=>app.mf.dispose());
 for(let i=0;i<20;i++) assert.equal((await app.receive()).status,202);
 assert.equal((await app.receive()).status,429);
 await app.moderate('approved');await app.db.prepare('UPDATE mentions SET verified_at=0').run();assert.deepEqual(await (await app.responses()).json(),{responses:[]});
});
test('fail closed unconfigured/storage, target validation and trusted IP',async(t)=>{
 const app=await setup();t.after(()=>app.mf.dispose());
 assert.equal((await app.send('/api/webmention',{method:'POST'})).status,415);
 assert.equal((await app.send('/api/webmention/responses?target=https://evil.site/')).status,400);
 assert.equal((await app.send('/api/webmention/admin')).status,401);
 await app.db.exec('DROP TABLE mentions');assert.equal((await app.responses()).status,503);
 const disabled=await setup(undefined,{ENABLED:'false'});t.after(()=>disabled.mf.dispose());assert.equal((await disabled.responses()).status,503);
});

test('base URL applies and inert template backlink is ignored',async(t)=>{
 const app=await setup(`<base href="https://bathos.org/posts/"><base href="https://evil.site/"><a href="gassing/">Reply</a>`);t.after(()=>app.mf.dispose());assert.equal((await app.receive()).status,202);
 const inert=await setup(`<template><a href="${target}">fake</a></template>`);t.after(()=>inert.mf.dispose());assert.equal((await inert.receive()).status,200);
});
test('changed source returns pending and deleted backlink retracts approval',async(t)=>{
 const remote={body:`<a href="${target}">reply</a>`};const app=await setup(remote);t.after(()=>app.mf.dispose());
 await app.receive();await app.moderate('approved');remote.body=`<title>Changed</title><a href="${target}">reply</a>`;
 assert.equal((await app.moderate('approved')).status,409);await app.receive();assert.deepEqual(await (await app.responses()).json(),{responses:[]});await app.moderate('approved');
 remote.body='Removed backlink';await app.receive();assert.deepEqual(await (await app.responses()).json(),{responses:[]});
 remote.status=410;assert.equal((await app.receive()).status,200);
});
test('malformed JSON moderation objects, foreign CORS and read quota',async(t)=>{
 const app=await setup();t.after(()=>app.mf.dispose());
 for(const body of ['null','[]','{"state":"approved"}']) assert.equal((await app.send('/api/webmention/admin',{method:'POST',headers:{authorization:`Bearer ${token}`},body})).status,400);
 const cors=await app.send(`/api/webmention/responses?target=${encodeURIComponent(target)}`,{headers:{origin:'https://evil.site'}});assert.equal(cors.headers.get('access-control-allow-origin'),null);
 for(let i=0;i<59;i++) assert.equal((await app.responses()).status,200);assert.equal((await app.responses()).status,429);
});
test('quota preserves idempotent existing updates and refuses new records',async(t)=>{
 const app=await setup();t.after(()=>app.mf.dispose());await app.receive();
 await app.db.exec("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<999) INSERT INTO mentions(source,target,state,fingerprint,verified_at,updated_at) SELECT 'https://quota.site/'||i,'https://bathos.org/posts/gassing/','pending','f',0,0 FROM n");
 assert.equal((await app.receive()).status,202);
 const result=await app.send('/api/webmention',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','cf-connecting-ip':'203.0.113.2'},body:new URLSearchParams({source:'https://reply.site/reply2',target})});assert.equal(result.status,429);

});

test('unpublished canonical target rejected without creating a mention',async(t)=>{
 const app=await setup(undefined,{TARGET_STATUS:404});t.after(()=>app.mf.dispose());assert.equal((await app.receive()).status,422);assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM mentions').first()).n,0);
});
test('scheduled runtime revalidation retracts removed source',async(t)=>{
 const remote={body:`<a href="${target}">reply</a>`};const app=await setup(remote);t.after(()=>app.mf.dispose());await app.receive();await app.moderate('approved');remote.body='No backlink';
 const worker=await app.mf.getWorker();await worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'});assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM mentions').first()).n,0);
});

test('failed oldest source rotates attempts without renewing its verification lease',async(t)=>{
 const remote={body:`<a href="${target}">reply</a>`};const app=await setup(remote);t.after(()=>app.mf.dispose());await app.receive();await app.moderate('approved');
 const old=Math.floor(Date.now()/1000)-86000;await app.db.prepare('UPDATE mentions SET verified_at=?').bind(old).run();
 await app.db.prepare("INSERT INTO mentions(source,target,state,fingerprint,verified_at,updated_at) SELECT 'https://reply.site/reply2',target,state,fingerprint,verified_at,updated_at FROM mentions WHERE source=?").bind(source).run();remote.fail=true;
 const worker=await app.mf.getWorker();await worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'});assert.equal((await app.db.prepare('SELECT verified_at FROM mentions WHERE source=?').bind(source).first()).verified_at,old);
 await worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'});assert.ok((await app.db.prepare('SELECT verified_at FROM mentions WHERE source=?').bind('https://reply.site/reply2').first()).verified_at>old);
 assert.equal((await app.db.prepare('SELECT verified_at FROM mentions WHERE source=?').bind(source).first()).verified_at,old);
});
