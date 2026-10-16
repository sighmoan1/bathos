const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildSync} = require('../workers/admin-oauth/node_modules/esbuild');
const bundled = buildSync({entryPoints:['lib/rss.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const compiled = {exports:{}};
new Function('require','module','exports',bundled)(require,compiled,compiled.exports);
const {buildRss} = compiled.exports;
test('feed has deterministic newest-first ordering and stable case-sensitive identities', () => {
 const posts = [{slug:'old',title:'Old',description:'Old summary',date:'2025-01-01'}, {slug:'Gassing',title:'Gassing',description:'Summary',date:'2026-10-12',tags:['reflection']},{slug:'latest',title:'Latest',description:'Latest summary',date:'2026-10-13'}];
 const output = buildRss(posts);
 assert.equal(output,buildRss([...posts].reverse()));
 assert.ok(output.indexOf('<title>Latest</title>') < output.indexOf('<title>Gassing</title>'));
 assert.match(output,/<guid isPermaLink="true">https:\/\/bathos.org\/posts\/Gassing\/<\/guid>/);
 assert.match(output,/<pubDate>Mon, 12 Oct 2026 00:00:00 GMT<\/pubDate>/);
 assert.match(output,/<lastBuildDate>Tue, 13 Oct 2026 00:00:00 GMT<\/lastBuildDate>/);
 assert.match(output,/<category>reflection<\/category>/);
 assert.deepEqual(posts.map(p=>p.slug),['old','Gassing','latest']);
});
test('XML escapes metadata and rejects prohibited control characters; absent dates do not change on rebuild', () => {
 const output = buildRss([{slug:'café',title:'<Hi> & "you"\u0001',description:"a'b <script>",date:'not-a-date',tags:['x&y']},{slug:'undated',title:'Undated',description:'No date'}]);
 assert.match(output,/&lt;Hi&gt; &amp; &quot;you&quot;/);
 assert.match(output,/a&apos;b &lt;script&gt;/);
 assert.match(output,/caf%C3%A9/);
 assert.doesNotMatch(output,/<pubDate>|<lastBuildDate>|Invalid Date|\u0001|<script>/);
 assert.doesNotThrow(()=>buildRss([]));
});

test('full-text RSS renders Markdown, tables and code with absolute safe links and images',()=>{
 const output=buildRss([{slug:'hello',title:'Hello',description:'Short summary',content:'# Heading\n\nA **bold** idea with [a link](/read/other/) and [a section](#details).\n\n![Actual image](/images/posts/hello/photo.png)\n\n- First\n- Second\n\n| A | B |\n| --- | --- |\n| x | y |\n\n```js\nconst x = "<&"\n```\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))'}]);
 assert.match(output,/xmlns:content="http:\/\/purl.org\/rss\/1.0\/modules\/content\/"/);
 const body=output.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
 assert.match(body,/<h1>Heading<\/h1>/);
 assert.match(body,/<strong>bold<\/strong>/);
 assert.match(body,/href="https:\/\/bathos.org\/read\/other\/"/);
 assert.match(body,/href="https:\/\/bathos.org\/posts\/hello\/#details"/);
 assert.match(body,/src="https:\/\/bathos.org\/images\/posts\/hello\/photo.png"/);
 assert.match(body,/<table>/);assert.match(body,/<ul>/);assert.match(body,/<pre><code/);
 assert.doesNotMatch(body,/<script|javascript:|onerror=/);
 assert.match(output,/<description>Short summary<\/description>/);
});
