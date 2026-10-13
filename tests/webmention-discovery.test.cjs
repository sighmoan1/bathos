const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');

function loadComponent(endpoint) {
  const configuration = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/webmention-submission.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: configuration, URL, process: { env: { NEXT_PUBLIC_WEBMENTION_ENDPOINT: endpoint } } });
  const exports = {};
  const source = fs.readFileSync('components/webmention-adoption-link.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText, { exports, require: name => name === '@/lib/webmention-submission' ? configuration : require(name), encodeURIComponent });
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

test('only explicitly configured same-origin receiver paths are advertised', () => {
  const targetUrl = 'https://bathos.org/posts/Gassing/';
  const configured = renderToStaticMarkup(loadComponent('/api/webmention')({ targetUrl }));
  assert.match(configured, /<a rel="webmention" href="\/api\/webmention"/);
  assert.match(configured, />Webmention receiver<\/a>/);
  assert.match(configured, /Webmention reply guide/);
  for (const endpoint of [undefined, '', '/', '//evil.test/receiver', 'https://evil.test/receiver', 'javascript:alert(1)', '/api/webmention?redirect=evil', '/api/webmention#fragment', '/api\\webmention', '/api webmention']) {
    const html = renderToStaticMarkup(loadComponent(endpoint)({ targetUrl }));
    assert.doesNotMatch(html, /rel="webmention"|>Webmention receiver<\/a>/);
    assert.match(html, /Webmention reply guide/);
  }
});

test('target input cannot turn reply-guide navigation into an external link or inject HTML', () => {
  const Component = loadComponent();
  const targetUrl = 'javascript:alert(1)" onmouseover="alert(2)<script>&target=https://evil.test';
  const html = renderToStaticMarkup(Component({ targetUrl }));
  assert.ok(html.includes(`href="/webmentions?target=${encodeURIComponent(targetUrl).replaceAll('&', '&amp;')}"`));
  assert.doesNotMatch(html, /href="javascript:|onmouseover="|<script>/);
});
