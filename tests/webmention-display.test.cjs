const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/webmention-responses.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsObject, URL });
const { verifiedResponses } = exportsObject;
const target = 'https://bathos.org/posts/Gassing/';
test('response list rejects unsafe URLs, mismatched targets, unapproved records and duplicates', () => {
  const response = (source, extras = {}) => ({source, target, name: 'Reply', ...extras});
  const result = verifiedResponses({responses: [response('javascript:alert(1)'), response('https://user:pass@example.org/'), response('https://example.org/wrong', {target: 'https://bathos.org/'}), response('https://example.org/pending', {status: 'pending'}), response('https://example.org/reply'), response('https://example.org/reply')]}, target);
  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'https://example.org/reply');
  assert.equal(verifiedResponses({responses:[response('https://example.org/' + '💬'.repeat(300))]}, target).length, 0);
});
test('remote content remains bounded plain text and invalid dates are omitted', () => {
  const result = verifiedResponses({responses: [{source:'https://example.org/reply', target, name:'<script>hi</script>\u0000', author:'A'.repeat(300), published:'bad'}]}, target);
  assert.equal(result[0].name, '<script>hi</script>');
  assert.equal(result[0].author.length, 100);
  assert.equal(result[0].published, undefined);
  const date = '2026-10-13T10:00:00.' + '1'.repeat(1000) + 'Z';
  assert.equal(Number.isFinite(Date.parse(date)), true, 'valid precision can still exceed display bounds');
  const longDate = verifiedResponses({responses:[{source:'https://example.org/reply', target, published:date}]}, target);
  assert.equal(longDate[0].published, undefined);
  assert.throws(() => verifiedResponses({responses: null}, target));
});
