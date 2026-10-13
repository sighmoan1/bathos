const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const network = import('../scripts/webmention-network.mjs');

test('rejects alternate private address notation and mixed public/private DNS answers', async () => {
  const {publicURL,resolvePublic,publicAddress} = await network;
  for (const value of ['http://2130706433/','http://0x7f000001/','http://127.1/','http://[::ffff:127.0.0.1]/','http://[fc00::1]/','http://169.254.169.254/latest/meta-data/','https://public.example@127.0.0.1/']) assert.throws(()=>publicURL(value));
  for (const value of ['10.0.0.1','172.31.0.1','192.168.1.1','100.64.0.1','198.18.0.1','2001:db8::1','2002:7f00:1::','::ffff:7f00:1']) assert.equal(publicAddress(value),false,value);
  await assert.rejects(resolvePublic(publicURL('https://reply.example.org/'),async()=>[{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}]),/non-public/);
});

test('transport pins validated DNS and refuses private redirect before opening a second socket', async () => {
  const {createTransport} = await network;
  let lookups=0, sockets=0;
  const transport=createTransport({lookup:async()=>{lookups++; return [{address:'93.184.216.34',family:4}]},request:(url,options,callback)=>{
    sockets++;
    assert.equal(url.hostname,'reply.example.org');
    assert.equal(options.agent,false);
    assert.equal(options.headers.Authorization,undefined);
    assert.equal(options.headers.Cookie,undefined);
    options.lookup(url.hostname,{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'93.184.216.34');assert.equal(family,4)});
    const req=new EventEmitter();
    req.destroy=error=>{req.emit('error',error);req.emit('close')};
    req.end=()=>queueMicrotask(()=>{
      const res=new EventEmitter();res.statusCode=302;res.headers={location:'http://169.254.169.254/'};
      callback(res);res.emit('end');req.emit('close');
    });
    return req;
  }});
  await assert.rejects(transport('https://reply.example.org/'),/Unsafe/);
  assert.equal(lookups,1);assert.equal(sockets,1);
});

test('endpoint discovery cannot convert inert markup into a delivery destination',async()=>{
  const {discoverEndpoint,links}=await import('../scripts/send-webmentions.mjs');
  const inert='<script>"<a rel="webmention" href="https://bad.example.org/">"</script><!-- <link rel="webmention" href="https://bad.example.org/"> --><template><a rel="webmention" href="https://bad.example.org/">x</a></template>';
  assert.equal(discoverEndpoint({headers:{'content-type':'text/html'},body:inert,url:'https://reply.example.org/post'}),null);
  assert.equal(links(inert,'https://reply.example.org/post').length,0);
});

test('live backlink gate blocks forged local metadata before target fetch or delivery',async()=>{
  const {sendWebmention}=await import('../scripts/send-webmentions.mjs');
  const calls=[];
  await assert.rejects(sendWebmention({source:'https://bathos.org/posts/reply/',target:'https://reply.example.org/post',transport:async url=>{calls.push(url);return {status:200,url,headers:{'content-type':'text/html'},body:'<!-- <a href="https://reply.example.org/post">forged</a> -->'}}}),/does not link/);
  assert.deepEqual(calls,['https://bathos.org/posts/reply/']);
});
