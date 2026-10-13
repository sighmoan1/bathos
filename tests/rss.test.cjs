const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, context = {}) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports,URL,process:{env:{}},...context});
 return exports;
}
const {buildRss} = load('lib/rss.ts');
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
test('email signup stays hidden until configured and only accepts the ad-free chosen provider', () => {
 const {emailSubscriptionUrl} = load('lib/email-subscriptions.ts');
 assert.equal(emailSubscriptionUrl(),null);
 assert.equal(emailSubscriptionUrl('https://buttondown.com/bathos'),'https://buttondown.com/bathos');
 for (const value of ['https://blogtrottr.com/?subscribe=feed','http://buttondown.com/bathos','https://buttondown.com.evil.test/bathos','https://user:password@buttondown.com/bathos','https://buttondown.com/bathos?redirect=other','https://buttondown.com/']) assert.throws(()=>emailSubscriptionUrl(value));
});
