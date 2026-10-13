const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// Receiver dependencies are deliberately installed in its own locked package.
const workerRequire = createRequire(path.resolve('workers/webmention/package.json'));
const { Miniflare, convertV4MiniflareOptions, Response: MFResponse } = workerRequire('miniflare');
const { build } = workerRequire('esbuild');
const source = 'https://bathos.org/posts/integration-reply/';
const target = 'https://bathos.org/posts/Gassing/';
const token = 'fixture-moderator-token-'.repeat(3);
function load(file, mocks = {}) {
  const exports = {};
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file),name);
      return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`,mocks);
    }
    return require(name);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:localRequire,URL,process});
  return exports;
}
function renderedReply(title = 'Integration reply') {
  const { ArticleReader } = load('components/article-reader.tsx',{
    'react-markdown':({children})=>React.createElement('p',null,children),
    'framer-motion':{motion:{div:({initial,animate,exit,...props})=>React.createElement('div',props)}},
    '@/lib/use-feed-controls':{useEscapeKey:()=>{}},
    './share-button':{ShareButton:()=>null},
    './webmention-responses':{WebmentionResponses:()=>null},
  });
  const article={slug:'integration-reply',title,content:'A published fixture reply.',inReplyTo:[`${target}#discussion`]};
  const markup=renderToStaticMarkup(React.createElement(ArticleReader,{article,animateEntry:false,onClose(){},onSave(){},onDismiss(){},onTagClick(){}}));
  return `<!doctype html><title>${title}</title><link rel="canonical" href="${source}">${markup}`;
}
async function fixture(t) {
  const bundle=await build({entryPoints:['workers/webmention/index.mjs'],bundle:true,format:'esm',platform:'browser',write:false});
  const remote={body:renderedReply(),status:200};const outgoing=[];
  const targetHTML=`<link rel="canonical" href="${target}"><a href="/api/webmention?fixture=1" rel="webmention">Receive</a>`;
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-13',d1Databases:['DB'],bindings:{ENABLED:'true',SITE_ORIGIN:'https://bathos.org',RATE_SALT:'fixture-rate-salt-'.repeat(3),MODERATOR_TOKEN:token},outboundService:async request=>{
    const url=new URL(request.url);outgoing.push(url.href);
    if(url.origin==='https://cloudflare-dns.com')return new MFResponse(JSON.stringify({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}));
    if(url.href===target)return new MFResponse(targetHTML,{headers:{'content-type':'text/html'}});
    if(url.href===source)return new MFResponse(remote.body,{status:remote.status,headers:{'content-type':'text/html'}});
    throw new Error(`Unexpected outbound fixture URL ${url.href}`);
  }}));
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('DB');await db.exec(fs.readFileSync('workers/webmention/migrations/0001_webmentions.sql','utf8').replace(/\n/g,' '));
  const request=(route,options={})=>mf.dispatchFetch(`https://bathos.org${route}`,{...options,headers:{'cf-connecting-ip':'203.0.113.7',...options.headers}});
  const publicResponses=async()=>{
    const response=await request(`/api/webmention/responses?target=${encodeURIComponent(target)}`);
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');return response.json();
  };
  const reviewed=async()=>{
    const response=await request('/api/webmention/admin',{headers:{authorization:`Bearer ${token}`}});assert.equal(response.status,200);return (await response.json()).mentions[0];
  };
  const approve=(fingerprint,auth=token)=>request('/api/webmention/admin',{method:'POST',headers:{authorization:`Bearer ${auth}`},body:JSON.stringify({source,target,state:'approved',fingerprint})});
  const transport=async(url,options={})=>{
    if(url===source)return {status:remote.status,url,body:remote.body,headers:{'content-type':'text/html'}};
    if(url===target)return {status:200,url,body:targetHTML,headers:{'content-type':'text/html'}};
    assert.equal(url,'https://bathos.org/api/webmention?fixture=1');assert.equal(options.method,'POST');
    assert.deepEqual(Object.fromEntries(new URLSearchParams(options.body)),{source,target});
    const response=await request('/api/webmention?fixture=1',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:options.body});
    return {status:response.status,url,headers:Object.fromEntries(response.headers),body:await response.text()};
  };
  return {mf,db,remote,outgoing,request,transport,publicResponses,reviewed,approve};
}
test('real rendered reply → sender → Worker/D1 → reviewed approval → changed source → scheduled retraction',async t=>{
  const app=await fixture(t);const {sendWebmention,links}=await import('../scripts/send-webmentions.mjs');
  const emitted=links(app.remote.body,source);
  assert.equal(emitted.filter(link=>link.classes.includes('u-in-reply-to')).length,1);
  const replyTarget=emitted.find(link=>link.classes.includes('u-in-reply-to')).url;
  assert.equal(replyTarget,`${target}#discussion`);
  assert.equal(emitted.find(link=>link.classes.includes('u-url')).url,source);
  assert.match(app.remote.body,/class="h-entry /);
  const delivery=await sendWebmention({source,target:replyTarget,transport:app.transport});assert.equal(delivery.status,'accepted');assert.equal(delivery.httpStatus,202);
  assert.deepEqual(await app.publicResponses(),{responses:[]});
  const original=await app.reviewed();assert.equal(original.state,'pending');assert.equal(original.source,source);
  assert.equal((await app.approve(original.fingerprint,'incorrect')).status,401);
  assert.equal((await app.approve('stale-reviewed-fingerprint')).status,409);
  assert.deepEqual(await app.publicResponses(),{responses:[]});
  assert.equal((await app.approve(original.fingerprint)).status,200);
  let rows=(await app.publicResponses()).responses;assert.equal(rows.length,1);assert.equal(rows[0].name,'Integration reply');
  const {verifiedResponses}=load('lib/webmention-responses.ts');assert.equal(verifiedResponses({responses:rows},target)[0].source,source);
  await sendWebmention({source,target,transport:app.transport});assert.equal((await app.publicResponses()).responses.length,1);
  assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM mentions').first()).n,1);
  app.remote.body=renderedReply('Changed integration reply');
  assert.equal((await app.approve(original.fingerprint)).status,409);
  await sendWebmention({source,target,transport:app.transport});assert.deepEqual(await app.publicResponses(),{responses:[]});
  const changed=await app.reviewed();assert.equal(changed.state,'pending');assert.notEqual(changed.fingerprint,original.fingerprint);
  assert.equal((await app.approve(original.fingerprint)).status,409);assert.equal((await app.approve(changed.fingerprint)).status,200);
  rows=(await app.publicResponses()).responses;assert.equal(rows[0].name,'Changed integration reply');
  app.remote.body='<title>Withdrawn reply</title><p>The backlink was removed.</p>';
  await assert.rejects(sendWebmention({source,target,transport:app.transport}),/does not link/);
  const worker=await app.mf.getWorker();await worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'});
  assert.deepEqual(await app.publicResponses(),{responses:[]});assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM mentions').first()).n,0);
  assert.ok(app.outgoing.every(url=>url===source||url===target||url.startsWith('https://cloudflare-dns.com/dns-query')));
});
test('cross-layer parser/abuse boundaries reject fake backlinks and invalid source URLs',async t=>{
  const app=await fixture(t);const {sendWebmention}=await import('../scripts/send-webmentions.mjs');
  app.remote.body=`<!-- <a href="${target}"> --><script>const fake='<a href="${target}">';</script><template><a href="${target}"></a></template>`;
  await assert.rejects(sendWebmention({source,target,transport:app.transport}),/does not link/);
  const received=await app.request('/api/webmention',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({source,target}).toString()});
  assert.equal(received.status,200);assert.deepEqual(await app.publicResponses(),{responses:[]});
  assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM mentions').first()).n,0);
  for(const unsafe of ['http://127.0.0.1/','https://user:secret@bathos.org/posts/x/','javascript:alert(1)']){
    await assert.rejects(sendWebmention({source:unsafe,target,transport:app.transport}));
    const response=await app.request('/api/webmention',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({source:unsafe,target}).toString()});assert.equal(response.status,400);
  }
  assert.equal((await app.request('/api/webmention/admin')).status,401);
});
