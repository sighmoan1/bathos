const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { pagesHeaders } = require('./helpers/pages-headers.cjs');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports, require:(name)=>load(`lib/${name.replace('./','')}.ts`)});
  return exports;
}
const {buildAgentCatalog, buildArticleMarkdown, buildLlmsIndex} = load('lib/agent-discovery.ts');
const posts = [
  {slug:'z', title:'Last', description:'Summary', content:'Unabridged **body**\n\n[relative](/articles/)', date:'2026-10-13'},
  {slug:'Gassing', title:'A [title]\nwith *formatting*', description:'Newline\nsummary <tag>', content:'αβγ\n\nFinal sentence.', tags:['AI'], inReplyTo:['https://example.org/original']},
];
test('agent catalog preserves full source content and shared canonical identity', () => {
  const catalog = buildAgentCatalog(posts);
  assert.equal(catalog.version,1);
  assert.equal(catalog.articles[0].slug,'Gassing');
  assert.equal(catalog.articles[0].markdownUrl,'https://bathos.org/posts/Gassing/index.md');
  assert.equal(catalog.articles[0].canonicalUrl,'https://bathos.org/posts/Gassing/');
  assert.equal(catalog.articles[0].content, posts[1].content);
  assert.equal(catalog.articles[1].content, posts[0].content);
  assert.equal(catalog.articles[0].date,null);
  assert.equal(catalog.articles[0].inReplyTo[0],'https://example.org/original');
  assert.equal(JSON.stringify(catalog),JSON.stringify(buildAgentCatalog([...posts].reverse())));
});
test('Markdown exports contain complete body and escaped metadata with no invented date', () => {
  const result = buildArticleMarkdown(posts[1]);
  assert.ok(result.includes('title: "A [title]\\nwith *formatting*"'));
  assert.ok(result.includes('url: "https://bathos.org/posts/Gassing/"'));
  assert.ok(!result.includes('\ndate:'));
  assert.ok(result.includes('inReplyTo: ["https://example.org/original"]'));
  assert.ok(result.endsWith(posts[1].content + '\n'));
  assert.ok(buildArticleMarkdown(posts[0]).includes('date: "2026-10-13"'));
});
test('llms index links each export once and escapes multiline Markdown descriptions', () => {
  const result = buildLlmsIndex(posts);
  assert.ok(result.includes('[A \\[title\\] with \\*formatting\\*](https://bathos.org/posts/Gassing/index.md)'));
  assert.ok(result.includes('Newline summary \\<tag\\>'));
  assert.equal(result.match(/\/posts\/Gassing\/index.md/g).length,1);
  assert.ok(result.includes('https://bathos.org/agent-posts.json'));
  assert.ok(!result.includes(posts[0].content));
});
test('Pages serves exports with appropriate content types without changing crawler policy', () => {
  assert.equal(pagesHeaders('/llms.txt')['content-type'],'text/plain; charset=utf-8');
  assert.equal(pagesHeaders('/agent-posts.json')['content-type'],'application/json; charset=utf-8');
  assert.equal(pagesHeaders('/posts/Gassing/index.md')['content-type'],'text/markdown; charset=utf-8');
  assert.ok(fs.readFileSync('app/layout.tsx','utf8').includes('rel="describedby" type="text/plain" href="https://bathos.org/llms.txt"'));
});
