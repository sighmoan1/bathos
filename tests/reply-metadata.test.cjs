const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}) {
  const exports = {};
  const requireLocal = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file), name);
      return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`, mocks);
    }
    return require(name);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText, {exports, require: requireLocal, URL, process});
  return exports;
}
const { parseInReplyTo } = load('lib/reply-metadata.ts');

test('optional reply metadata accepts HTTP(S) lists, normalizes and deduplicates targets', () => {
  assert.equal(JSON.stringify(parseInReplyTo(undefined)), '[]');
  assert.equal(JSON.stringify(parseInReplyTo(null)), '[]');
  assert.equal(JSON.stringify(parseInReplyTo([])), '[]');
  assert.equal(JSON.stringify(parseInReplyTo(['https://EXAMPLE.com', 'https://example.com/'])), '["https://example.com/"]');
  assert.equal(JSON.stringify(parseInReplyTo(['http://example.com/post', 'https://example.com/other#reply'])), '["http://example.com/post","https://example.com/other#reply"]');
});

test('malformed metadata fails explicitly rather than emitting unsafe backlinks', () => {
  for (const input of ['https://example.com', {}, [null], [5], ['javascript:alert(1)'], ['data:text/html,x'], ['/relative'], ['//example.com'], ['https:example.com'], ['https://user:pass@example.com'], [' https://example.com'], ['https://example.com/\n'], ['https://example.com/a b']]) {
    assert.throws(() => parseInReplyTo(input), /inReplyTo/);
  }
});

test('both article loaders carry reply metadata and reject invalid frontmatter', () => {
  let metadata = {title: 'Reply', inReplyTo: ['https://example.com/post']};
  const { getAllArticles, getArticleBySlug } = load('lib/articles.ts', {
    fs: {existsSync: () => true, readdirSync: () => ['reply.md'], readFileSync: () => ''},
    'gray-matter': () => ({data: metadata, content: 'Body'}),
  });
  assert.equal(JSON.stringify(getAllArticles()[0].inReplyTo), '["https://example.com/post"]');
  assert.equal(JSON.stringify(getArticleBySlug('reply').inReplyTo), '["https://example.com/post"]');
  metadata = {inReplyTo: ['javascript:alert(1)']};
  assert.throws(() => getAllArticles(), /inReplyTo/);
  assert.throws(() => getArticleBySlug('reply'), /inReplyTo/);
});

test('initial reader HTML contains one entry, canonical encoded permalink and escaped reply links', () => {
  const { ArticleReader } = load('components/article-reader.tsx', {
    'react-markdown': ({children}) => React.createElement('p', null, children),
    'framer-motion': {useReducedMotion: () => false, motion: {div: ({initial, animate, exit, ...props}) => React.createElement('div', {...props, style: initial === false ? undefined : {opacity: initial.opacity}})}},
    '@/lib/use-reader-dialog': {useReaderDialog: () => ({ref: null, titleId: 'reply-title', present: true})},
    './share-button': {ShareButton: () => null},
  });
  const target = 'https://example.com/post?title=%3Cscript%3E&next=%22quoted%22';
  const html = renderToStaticMarkup(React.createElement(ArticleReader, {
    article: {slug: 'café & reply', title: '<script>Reply</script>', content: 'A reply', inReplyTo: [target, target]},
    animateEntry: false, onClose() {}, onSave() {}, onDismiss() {}, onTagClick() {},
  }));
  assert.equal((html.match(/class="h-entry /g) || []).length, 1);
  assert.equal((html.match(/class="u-in-reply-to /g) || []).length, 1);
  assert.match(html, /class="u-url [^"]*" href="https:\/\/bathos.org\/posts\/caf%C3%A9%20%26%20reply\/"/);
  assert.match(html, /&lt;script&gt;Reply&lt;\/script&gt;/);
  assert.match(html, /%3Cscript%3E&amp;next=%22quoted%22/);
  assert.doesNotMatch(html, /<script>|opacity:0/);
});

test('ordinary articles render no empty reply context', () => {
  const { ReplyContext } = load('components/reply-context.tsx');
  assert.equal(renderToStaticMarkup(React.createElement(ReplyContext, {})), '');
});


test('conventional server-rendered article and canonical no-JS fallback contain reply links', async () => {
  const article = {slug: 'reply', title: 'A reply', content: 'Reply body', description: 'Summary', inReplyTo: ['https://example.com/original']};
  const mocks = {
    '@/lib/articles': {getAllArticles: () => [article], getAllTags: () => []},
    'next/navigation': {notFound() { throw Error('missing article'); }},
    'react-markdown': ({children}) => React.createElement('p', null, children),
    '../../articles/reading.module.css': {page: 'page', header: 'header', main: 'main'},
    '@/components/swipe-feed': {SwipeFeed: () => null},
  };
  const {default: Read} = load('app/read/[slug]/page.tsx', mocks);
  const conventional = renderToStaticMarkup(await Read({params: Promise.resolve({slug: 'reply'})}));
  assert.match(conventional, /class="h-entry"/);
  assert.match(conventional, /class="p-name"/);
  assert.match(conventional, /class="u-url" href="https:\/\/bathos.org\/posts\/reply\/"/);
  assert.equal((conventional.match(/class="u-in-reply-to /g) || []).length, 1);
  const {default: Post} = load('app/posts/[slug]/page.tsx', mocks);
  const canonical = renderToStaticMarkup(await Post({params: Promise.resolve({slug: 'reply'})}));
  assert.match(canonical, /<noscript>[\s\S]*class="u-in-reply-to [^"]*" href="https:\/\/example.com\/original"[\s\S]*<\/noscript>/);
});
