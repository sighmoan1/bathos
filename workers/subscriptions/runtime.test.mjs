import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// Use the Miniflare/esbuild versions pinned by the existing Wrangler lockfile.
const require=createRequire(new URL('../admin-oauth/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions,Response}=require('miniflare');
const {build}=require('esbuild');
test('real Workers runtime and D1 binding perform confirmation and unsubscribe using a fake mail transport',async()=>{
 const sent=[];
 const bundle=await build({entryPoints:[fileURLToPath(new URL('./index.mjs',import.meta.url))],bundle:true,format:'esm',platform:'browser',write:false});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-13',cf:false,d1Databases:{DB:'isolated-subscription-test'},bindings:{DELIVERY_ENABLED:'true',MAIL_FROM:'Bathos <posts@mail.bathos.org>',DAILY_LIMIT:'90',MONTHLY_LIMIT:'2700',TOKEN_SECRET:Buffer.alloc(32,7).toString('base64url'),RESEND_API_KEY:'re_private_test',RESEND_WEBHOOK_SECRET:'whsec_'+Buffer.alloc(32,8).toString('base64'),TURNSTILE_SECRET:'test_secret',TURNSTILE_SITE_KEY:'test_public_key_long_enough'},outboundService:async request=>{
  if(request.url==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return Response.json({success:true,hostname:'bathos.org',action:'subscribe'});
  assert.equal(request.url,'https://api.resend.com/emails');
  sent.push(await request.json());return Response.json({id:'runtime-test-message'});
 }}));
 try{
  const db=await mf.getD1Database('DB');
  for(const sql of readFileSync(new URL('./migrations/0001_subscriptions.sql',import.meta.url),'utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
  await db.prepare("INSERT INTO metadata(key,value) VALUES('baseline','1')").run();
  const status=await mf.dispatchFetch('https://bathos.org/api/subscriptions/status');assert.equal((await status.json()).enabled,true);
  const response=await mf.dispatchFetch('https://bathos.org/api/subscriptions',{method:'POST',headers:{Origin:'https://bathos.org','Content-Type':'application/json'},body:JSON.stringify({email:'reader@example.test',token:'test_token'})});
  assert.equal(response.status,202);assert.equal(sent.length,1);
  assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,'pending');
  const link=sent[0].text.match(/https:\/\/bathos\.org\/api\/subscriptions\/confirm\?token=[^\s]+/)[0];
  const get=await mf.dispatchFetch(link);assert.equal(get.status,200);assert.equal(get.headers.get('x-frame-options'),'DENY');
  assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,'pending');
  const token=new URL(link).searchParams.get('token');
  const confirm=await mf.dispatchFetch('https://bathos.org/api/subscriptions/confirm',{method:'POST',headers:{Origin:'https://bathos.org','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}).toString()});assert.equal(confirm.status,200);
  assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,'active');
  const unsubscribe=sent[0].headers['List-Unsubscribe'].slice(1,-1);
  assert.equal((await mf.dispatchFetch(unsubscribe,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'})).status,200);
  assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,'unsubscribed');
 }finally{await mf.dispose();}
});
