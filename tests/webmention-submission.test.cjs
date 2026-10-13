const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/webmention-submission.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:exportsObject,URL,process:{env:{}}});
const {webmentionEndpoint,validateWebmentionSubmission,webmentionResponseMessage} = exportsObject;
test('receiver is disabled unless an explicitly configured same-origin path is safe',()=>{
 assert.equal(webmentionEndpoint(),null);
 assert.equal(webmentionEndpoint('/api/webmention'),'/api/webmention');
 for(const value of ['https://evil.example/receiver','//evil.example','/','/api?redirect=evil','/api#fragment','/\\evil.example','/api\nreceiver']) assert.equal(webmentionEndpoint(value),null,value);
});
test('accepts published public source and canonical Bathos article only',()=>{
 assert.equal(validateWebmentionSubmission(' https://example.org/reply/ ','https://bathos.org/posts/Article/').target,'https://bathos.org/posts/Article/');
 for(const source of ['file:///secret','javascript:alert(1)','http://localhost/reply','https://127.0.0.1/reply','https://[::1]/reply','https://service.internal/reply','https://u:p@example.org/reply','https://example.org:8080/reply','https://example.org/reply#fragment']) assert.throws(()=>validateWebmentionSubmission(source,'https://bathos.org/posts/Article/'),source);
 for(const target of ['https://bathos.org/','https://bathos.org/posts/Article','https://evil.example/posts/Article/','https://bathos.org/posts/Article/?x=1','http://bathos.org/posts/Article/','https://bathos.org/posts/a/b/']) assert.throws(()=>validateWebmentionSubmission('https://example.org/reply/',target),target);
 assert.throws(()=>validateWebmentionSubmission('https://bathos.org/posts/Article/','https://bathos.org/posts/Article/'));
});
test('messages distinguish receipt, unavailable receiver and rejection',()=>{
 assert.match(webmentionResponseMessage(202),/Received for verification/);
 assert.match(webmentionResponseMessage(202),/does not confirm/);
 assert.match(webmentionResponseMessage(429),/wait/);
 assert.match(webmentionResponseMessage(503),/unavailable/);
 assert.match(webmentionResponseMessage(400),/did not accept/);
});
