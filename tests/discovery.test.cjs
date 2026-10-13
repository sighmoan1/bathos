const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports,require:(name)=>load(`lib/${name.replace('./','')}.ts`)});
 return exports;
}
const {buildArticleCatalog,publicationDate} = load('lib/article-discovery.ts');
test('catalog is deterministic and preserves case, UTF-8 and canonical RSS identities', () => {
 const posts = [{slug:'z',title:'Later',description:'Summary',content:'',date:'2026-10-13'}, {slug:'Gassing',title:'<Hello> & café',description:'A summary',content:'',date:'2026-10-12',tags:['AI']}, {slug:'café / &',title:'UTF-8',description:'Unicode',content:''}];
 const output = buildArticleCatalog(posts);
 assert.equal(JSON.stringify(output),JSON.stringify(buildArticleCatalog([...posts].reverse())));
 assert.equal(output.version,1);
 assert.equal(output.articles[0].canonicalUrl,'https://bathos.org/posts/Gassing/');
 assert.equal(output.articles[0].readingUrl,'https://bathos.org/read/Gassing/');
 assert.equal(output.articles[1].canonicalUrl,'https://bathos.org/posts/caf%C3%A9%20%2F%20%26/');
 assert.equal(output.articles[1].date,null);
 assert.equal(output.articles[0].title,'<Hello> & café');
 assert.equal(JSON.parse(JSON.stringify(output)).articles.length,3);
 assert.equal(posts[0].slug,'z');
});
test('only real publication dates are exposed with no invented time', () => {
 for (const input of [undefined,null,'','invalid','2026-02-30','2026-13-01','2026-01-01T99:00:00Z',new Date()]) assert.equal(publicationDate(input),null);
 for (const input of ['2024-02-29','2026-10-13','2026-10-13T12:30:00Z','2026-10-13T12:30:00+01:00']) assert.equal(publicationDate(input),input);
 assert.equal(JSON.stringify(buildArticleCatalog([])),JSON.stringify(buildArticleCatalog([])));
});
