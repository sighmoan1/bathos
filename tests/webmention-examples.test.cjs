const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { pathToFileURL } = require('node:url')
const root = path.join(__dirname, '../examples/webmentions')
const source = 'https://your-blog.example/reply/'
const target = 'https://bathos.org/posts/example/'

function checkReply(html) {
  assert.match(html, /class="h-entry"/)
  assert.match(html, /class="u-in-reply-to" href="https:\/\/bathos.org\/posts\/example\/"/)
  assert.match(html, /class="u-url" href="https:\/\/your-blog.example\/reply\/"/)
  assert.match(html, /class="e-content"/)
}

test('plain HTML reply has a public canonical URL and server-readable backlink', () => {
  const html = fs.readFileSync(path.join(root, 'plain-html/reply.html'), 'utf8')
  checkReply(html)
  assert.ok(html.includes(`<link rel="canonical" href="${source}">`))
})

test('Next.js server component actually renders reply metadata and exposes canonical metadata', () => {
  const ts = require('typescript')
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'nextjs/app/reply/page.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require })
  const html = require('react-dom/server').renderToStaticMarkup(exports.default())
  checkReply(html)
  assert.equal(exports.metadata.alternates.canonical, source)
})

// Optional engines keep this educational example from adding production dependencies.
// Set WEBMENTION_EXAMPLE_ENGINES to an installation containing liquidjs and @11ty/eleventy.
const engines = process.env.WEBMENTION_EXAMPLE_ENGINES
test('Jekyll-compatible Liquid renders escaped reply fields', { skip: !engines }, async () => {
  const { Liquid } = require(path.join(engines, 'node_modules/liquidjs'))
  const liquid = new Liquid()
  liquid.registerFilter('absolute_url', value => new URL(value, source).href)
  const html = await liquid.parseAndRender(fs.readFileSync(path.join(root, 'jekyll/_layouts/reply.html'), 'utf8'), {
    page: { title: 'Reply <script>', url: '/reply/', reply_to: target }, content: '<p>A response</p>',
  })
  checkReply(html)
  assert.match(html, /Reply &lt;script&gt;/)
  assert.ok(html.includes(`<link rel="canonical" href="${source}">`))
})

test('Eleventy builds Markdown through the actual Nunjucks layout', { skip: !engines }, async () => {
  const { default: Eleventy } = await import(pathToFileURL(path.join(engines, 'node_modules/@11ty/eleventy/src/Eleventy.js')))
  const eleventy = new Eleventy(path.join(root, 'eleventy'), undefined, { config: eleventyConfig => eleventyConfig.setQuietMode(true) })
  const output = await eleventy.toJSON()
  const reply = output.find(page => page.url === '/reply/')
  assert.ok(reply, 'generated reply permalink')
  checkReply(reply.content)
  assert.ok(reply.content.includes(`<link rel="canonical" href="${source}">`))
  assert.match(reply.content, /<p>Write your considered response here\.<\/p>/)
})

test('submission encodes exact canonical URLs and preserves endpoint query parameters', async () => {
  const { submitWebmention } = await import(pathToFileURL(path.join(root, 'submit.mjs')))
  const endpoint = 'https://receiver.example/mentions?key=public-discovery-key'
  const encodedSource = `${source}?a=1&b=two words`
  let calls = 0
  const result = await submitWebmention({ source: encodedSource, target, endpoint, authorized: true, publishedBacklinkChecked: true }, async (url, options) => {
    calls++
    assert.equal(url, endpoint)
    assert.equal(options.method, 'POST')
    assert.equal(options.redirect, 'error')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded')
    assert.deepEqual(Object.fromEntries(new URLSearchParams(options.body)), { source: encodedSource, target })
    return new Response(null, { status: 202, headers: { Location: '/status/123' } })
  })
  assert.equal(calls, 1)
  assert.deepEqual(result, { status: 202, outcome: 'accepted-for-processing', displayed: 'unverified', location: '/status/123' })
})

test('submission gates authority/backlink and rejects credential-bearing or non-HTTPS URLs before network access', async () => {
  const { submitWebmention } = await import(pathToFileURL(path.join(root, 'submit.mjs')))
  const input = { source, target, endpoint: 'https://receiver.example/mentions', authorized: true, publishedBacklinkChecked: true }
  const neverFetch = () => assert.fail('network must not run')
  for (const override of [{ authorized: false }, { publishedBacklinkChecked: false }, { source: 'http://example.com/reply/' }, { endpoint: 'https://user:secret@receiver.example/mentions' }, { target: 'not a url' }]) {
    await assert.rejects(submitWebmention({ ...input, ...override }, neverFetch))
  }
})

test('receiver failures and other successes never become display claims; network errors propagate', async () => {
  const { submitWebmention } = await import(pathToFileURL(path.join(root, 'submit.mjs')))
  const input = { source, target, endpoint: 'https://receiver.example/mentions', authorized: true, publishedBacklinkChecked: true }
  for (const [status, outcome] of [[200, 'accepted'], [201, 'accepted'], [400, 'failed'], [429, 'failed'], [500, 'failed']]) {
    const result = await submitWebmention(input, async () => new Response(null, { status }))
    assert.equal(result.outcome, outcome)
    assert.equal(result.displayed, 'unverified')
  }
  await assert.rejects(submitWebmention(input, async () => { throw new Error('network failure') }), /network failure/)
})
