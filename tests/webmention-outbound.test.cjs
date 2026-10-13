const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const load = () => import('../scripts/send-webmentions.mjs');
const network = () => import('../scripts/webmention-network.mjs');
const source = 'https://bathos.org/posts/reply/';
const target = 'https://example.org/post?a=1&b=2';
function response(body, url = target, headers = {}) { return { status: 200, url, body, headers: {'content-type':'text/html; charset=utf-8',...headers} }; }
function mockTransport(postStatus = 202, targetResponse) {
  const calls = [];
  const fn = async (url, options = {}) => {
    calls.push({url,...options});
    if (url === source) return response(`<a href="${target.replaceAll('&','&amp;')}">Reply</a>`,source);
    if (url === target) return targetResponse || response('<link rel=webmention href="/inbox?key=a&amp;b=c">');
    return {status:postStatus,headers:{},body:'',url};
  };
  fn.calls = calls; return fn;
}
test('HTML parser handles entities, unquoted attributes, base and inert content',async () => {
  const {links} = await load();
  assert.deepEqual(links('<!-- <a href="/fake"> --><script>"<a href=/fake>"</script><template><a href=/fake></template><base href="/base/"><a class=u-in-reply-to href="post?a=1&amp;b=2">',target).map(l=>l.url),['https://example.org/base/post?a=1&b=2']);
});
test('HTTP Link precedence and commas/query parameters',async () => {
  const {discoverEndpoint} = await load();
  assert.equal(discoverEndpoint(response('<a rel=webmention href=/html>',target,{link:'</ignore>; rel=other, </header?q=a,b>; title="x,y"; rel="alternate webmention"'})), 'https://example.org/header?q=a,b');
  assert.equal(discoverEndpoint(response('<a rel=webmention href=/first><link rel=webmention href=/second>')), 'https://example.org/first');
  assert.equal(discoverEndpoint(response('<link rel=webmention href=/html>',target,{'content-type':'text/plain'})),null);
  assert.equal(discoverEndpoint(response('',target,{link:'</false>; title="x; rel=webmention"'})),null);
});
test('sends form source/target and preserves endpoint query',async () => {
  const {sendWebmention}=await load(); const transport=mockTransport();
  const result=await sendWebmention({source,target,transport});
  assert.equal(result.status,'accepted');
  const call=transport.calls[2]; assert.equal(call.url,'https://example.org/inbox?key=a&b=c');
  assert.equal(call.method,'POST'); assert.deepEqual(Object.fromEntries(new URLSearchParams(call.body)),{source,target});
});
test('unsupported targets and unpublished/backlink-absent source never POST',async () => {
  const {sendWebmention}=await load(); const transport=mockTransport(202,response('No endpoint'));
  assert.equal((await sendWebmention({source,target,transport})).status,'unsupported');
  for(const live of [{...response('',source),status:404},response('<script>"<a href=https://example.org/post?a=1&b=2>"</script>',source),response('<a href=/post>', 'https://bathos.org/posts/else/')]) {
    const calls=[]; await assert.rejects(sendWebmention({source,target,transport:async url=>{calls.push(url);return live;}})); assert.equal(calls.length,1);
  }
});
test('2xx success, 4xx no retries, 5xx bounded retry, uncertain network no automatic retry',async () => {
  const {sendWebmention}=await load();
  for(const status of [200,201,202,204]) assert.equal((await sendWebmention({source,target,transport:mockTransport(status)})).httpStatus,status);
  const denied=mockTransport(400); await assert.rejects(sendWebmention({source,target,transport:denied}),/400/); assert.equal(denied.calls.length,3);
  const down=mockTransport(503); await assert.rejects(sendWebmention({source,target,transport:down,sleep:async()=>{}}),/503/); assert.equal(down.calls.length,5);
  const normal=mockTransport(); await assert.rejects(sendWebmention({source,target,transport:async (url,opts)=>{if(opts?.method)throw new Error('lost connection');return normal(url,opts);}}),/Delivery uncertain/);
});
test('URL/IP policy blocks credentials, schemes, reserved, mapped, and private DNS',async () => {
  const {publicAddress,publicURL,resolvePublic}=await network();
  for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','100.64.1.1','192.0.2.3','198.18.0.1','203.0.113.1','::1','::ffff:8.8.8.8','fe80::1','fc00::1','2001:db8::1','2002::1','3fff::1']) assert.equal(publicAddress(ip),false,ip);
  for(const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111']) assert.equal(publicAddress(ip),true,ip);
  for(const url of ['file:///etc/passwd','https://user:secret@example.org','http://localhost/','http://[::1]/','http://2130706433/','http://example.org:8000']) assert.throws(()=>publicURL(url));
  await assert.rejects(resolvePublic(publicURL(target),async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]),/non-public/);
});
function fakeRequest(responses, calls) {
  return (url,opts,cb) => {
    calls.push({url:url.href,opts}); const req=new EventEmitter();
    req.destroy=err=>{req.emit('error',err);req.emit('close');};
    req.end=()=>{queueMicrotask(()=>{const res=new EventEmitter();const fixture=responses.shift();res.statusCode=fixture.status;res.headers=fixture.headers||{};cb(res);res.emit('data',Buffer.from(fixture.body||''));res.emit('end');req.emit('close');});};
    return req;
  };
}
test('transport pins validated DNS socket and checks redirect destinations',async () => {
  const {createTransport}=await network(); const calls=[];let resolutions=0;
  const transport=createTransport({lookup:async()=>{resolutions++;return [{address:'8.8.8.8',family:4}];},request:fakeRequest([{status:302,headers:{location:'/next'}},{status:200,body:'done'}],calls)});
  assert.equal((await transport(target)).url,'https://example.org/next'); assert.equal(resolutions,2);
  calls[0].opts.lookup('example.org',{},(err,address,family)=>{assert.equal(err,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);});
  assert.equal(calls[0].opts.headers.Cookie,undefined); assert.equal(calls[0].opts.headers.Authorization,undefined);
  const privateRedirect=createTransport({lookup:async()=>[{address:'8.8.8.8',family:4}],request:fakeRequest([{status:302,headers:{location:'http://127.0.0.1/'}}],[])});
  await assert.rejects(privateRedirect(target),/Unsafe/);
});
test('transport enforces body, redirect, deadline and POST redirect bounds',async () => {
  const {createTransport}=await network(); const lookup=async()=>[{address:'8.8.8.8',family:4}];
  await assert.rejects(createTransport({lookup,maxBytes:2,request:fakeRequest([{status:200,body:'large'}],[])})(target),/body limit/);
  await assert.rejects(createTransport({lookup,maxRedirects:0,request:fakeRequest([{status:302,headers:{location:'/next'}}],[])})(target),/Redirect limit/);
  await assert.rejects(createTransport({lookup,request:fakeRequest([{status:303,headers:{location:'/next'}}],[])})(target,{method:'POST',body:'a=b'}),/discard POST/);
  await assert.rejects(createTransport({lookup:()=>new Promise(()=>{}),timeoutMs:2})(target),/DNS timeout/);
});
test('CLI built reply target selection, state dedup and explicit resend',async () => {
  const {main}=await load(); const fs=require('node:fs/promises'); const path=require('node:path'); const os=require('node:os');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bathos-webmention-test-'));
  try {
    const page=path.join(dir,'reply.html'); const state=path.join(dir,'state.json');
    await fs.writeFile(page,`<a class="u-in-reply-to" href="${target.replaceAll('&','&amp;')}">Reply</a>`);
    const args=['--source',source,'--page',page,'--state',state]; const transport=mockTransport();
    await main(args,{transport}); assert.equal(transport.calls.length,3);
    await main(args,{transport}); assert.equal(transport.calls.length,3);
    await main([...args,'--resend'],{transport}); assert.equal(transport.calls.length,6);
    assert.equal(Object.keys(JSON.parse(await fs.readFile(state,'utf8'))).length,1);
    await assert.rejects(main(['--source',source,'--page',page,'--wat'],{transport}),/Unknown/);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
