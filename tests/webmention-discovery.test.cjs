const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');

function loadComponent() {
  const exports = {};
  const source = fs.readFileSync('components/webmention-adoption-link.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText, { exports, require, encodeURIComponent });
  return exports.WebmentionAdoptionLink;
}

test('article reply guidance is readable in static HTML and keeps the canonical target intact', () => {
  const Component = loadComponent();
  const targetUrl = 'https://bathos.org/posts/Case-Sensitive-caf%C3%A9/';
  const html = renderToStaticMarkup(Component({ targetUrl }));
  assert.match(html, /aria-label="Reply from your own website"/);
  assert.ok(html.includes(`href="/webmentions?target=${encodeURIComponent(targetUrl)}"`));
  assert.match(html, />Webmention reply guide<\/a>/);
  assert.match(html, /href="\/webmentions-agent\.md"/);
  assert.match(html, />Webmention implementation instructions<\/a>/);
  assert.match(html, /authorised coding agent/);
  assert.doesNotMatch(html, /<button|onclick|<script|rel="webmention"/i);
});

test('target input cannot turn reply-guide navigation into an external link or inject HTML', () => {
  const Component = loadComponent();
  const targetUrl = 'javascript:alert(1)" onmouseover="alert(2)<script>&target=https://evil.test';
  const html = renderToStaticMarkup(Component({ targetUrl }));
  assert.ok(html.includes(`href="/webmentions?target=${encodeURIComponent(targetUrl).replaceAll('&', '&amp;')}"`));
  assert.doesNotMatch(html, /href="javascript:|onmouseover="|<script>/);
});
