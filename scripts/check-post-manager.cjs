/* Build first. Uses compiled site + mocked author API; never writes GitHub.
 * NODE_PATH=/path/to/playwright/node_modules node scripts/check-post-manager.cjs */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '../out');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
function serve() {
  assert.ok(fs.existsSync(path.join(root, 'manage/index.html')), 'Run pnpm build before this check');
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
      const existing = { slug: 'offline-existing', title: 'Existing offline post', description: 'Device recovery test', date: '2026-10-12', tags: [], body: 'Original published body', sha: 'e'.repeat(40) };
      if (req.headers['x-qa-author'] === '1') {
        if (pathname === '/api/session') return res.end(JSON.stringify({ authenticated: true, user: { login: 'offline-tester' } }));
        if (pathname === '/api/posts') return res.end(JSON.stringify({ posts: [existing] }));
        if (pathname === '/api/posts/offline-existing') return res.end(JSON.stringify(existing));
      }
      res.statusCode = 401; return res.end('{}');
    }
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.statusCode = 403; return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
}
async function until(predicate, message) {
  for (let i = 0; i < 250; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.fail(message);
}
async function noOverflow(page, width) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'page overflows horizontally');
}
async function offlineShell(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 390, height: 812 }, extraHTTPHeaders: { 'X-QA-Author': '1' } });
  const page = await context.newPage();
  await page.goto(origin + '/manage/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const cacheURLs = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(req => req.url)))).flat());
  assert.ok(cacheURLs.some(url => url.includes('/_next/static/')), 'compiled Next assets cached');
  assert.ok(cacheURLs.some(url => new URL(url).pathname === '/manage/'), 'manager shell cached');
  assert.ok(!cacheURLs.some(url => new URL(url).pathname.startsWith('/api/')), 'private API must not be cached');
  await page.getByRole('button', { name: 'New post', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('True offline recovery');
  await page.getByLabel('Your writing').fill('Cached app draft survives an offline reload');
  await page.getByRole('button', { name: 'Save device draft' }).click();
  page.on('dialog', dialog => dialog.accept());
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: /Manage posts/i }).waitFor();
  await page.getByRole('button', { name: 'New post', exact: true }).click();
  await page.getByRole('button', { name: 'Recover device draft', exact: true }).click();
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'True offline recovery');
  assert.equal(await page.getByLabel('Your writing').inputValue(), 'Cached app draft survives an offline reload');
  assert.equal(await page.getByRole('button', { name: 'Save to site', exact: true }).isDisabled(), true);
  await noOverflow(page, 390);
  await context.setOffline(false);
  await page.reload();
  await page.getByRole('heading', { name: 'Existing offline post', exact: true }).click();
  await page.getByLabel('Your writing').fill('Existing post edits survive offline reload');
  await page.getByText('Draft saved on this device', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'All posts', exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Device drafts', exact: true }).waitFor();
  await page.getByRole('button', { name: /Continue draft.*Existing offline post|Existing offline post.*Continue draft/i }).click();
  assert.equal(await page.getByLabel('Your writing').inputValue(), 'Existing post edits survive offline reload');
  assert.equal(await page.getByRole('button', { name: 'Save to site', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Delete post', exact: true }).isDisabled(), true);
  await noOverflow(page, 390);
  await context.close();
  console.log('PASS actual service-worker: compiled assets, offline shell, new/existing post draft recovery, disabled offline Save/Delete, no private API caching');
}
async function main() {
  const server = serve();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const width of [375, 390]) await mobileFlow(browser, origin, width);
    await offlineShell(browser, origin);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
async function mobileFlow(browser, origin, width) {
  const context = await browser.newContext({ viewport: { width, height: 812 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], writes = [], deletes = [], deployments = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.dismiss());
  let authenticated = false, nextFailure = 0;
  const posts = new Map([
    ['first-post', { slug: 'first-post', title: 'First post', description: 'Keep this one', date: '2026-10-12', tags: ['test'], body: 'First body', sha: 'first-sha' }],
    ['second-post', { slug: 'second-post', title: 'Second post', description: 'Another post', date: '2026-10-11', tags: [], body: 'Second body', sha: 'second-sha' }],
  ]);
  let cmsRequests = 0;
  await context.route('**://unpkg.com/**', route => { cmsRequests++; return route.abort(); });
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
    if (url.pathname === '/api/session') return json({ authenticated, ...(authenticated ? { user: { login: 'phone-writer' } } : {}) });
    if (url.pathname === '/api/logout') { authenticated = false; return json({ ok: true }); }
    if (url.pathname.startsWith('/api/deployment/')) { deployments.push(url.pathname); return json({ state: 'success' }); }
    if (method === 'GET' && url.pathname === '/api/posts') return json({ posts: [...posts.values()] });
    const slug = decodeURIComponent(url.pathname.split('/')[3] || '');
    if (method === 'GET') return json(posts.get(slug) || { error: 'Not found' }, posts.has(slug) ? 200 : 404);
    const body = request.postDataJSON();
    if (nextFailure) { const code = nextFailure; nextFailure = 0; if (code === 401) authenticated = false; return json({ error: code === 409 ? 'This post changed. Your draft is safe.' : 'Your session expired. Please sign in again.' }, code); }
    if (method === 'DELETE') {
      assert.equal(body.sha, posts.get(slug).sha, 'delete must use latest saved file SHA');
      deletes.push(slug); posts.delete(slug); return json({ commitSha: 'delete-commit' });
    }
    if (method === 'PUT') assert.equal(body.sha, posts.get(slug).sha, 'update must use returned file SHA');
    writes.push({ method, slug, body });
    const saved = { ...body, sha: `saved-sha-${writes.length}` };
    posts.set(body.slug, saved);
    return json({ post: saved, commitSha: `commit-${writes.length}` });
  });
  await page.goto(origin + '/manage/');
  await page.getByRole('link', { name: 'Sign in with GitHub' }).waitFor();
  assert.equal(await page.getByText('Loading the editor…').count(), 0);
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await page.getByText(/On iPhone or iPad/).waitFor();
  await noOverflow(page, width);
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  authenticated = true;
  await page.getByRole('button', { name: 'Check sign-in again' }).click();
  await page.getByRole('heading', { name: 'First post', exact: true }).waitFor();
  if (process.env.QA_SCREENSHOTS) { fs.mkdirSync(process.env.QA_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.QA_SCREENSHOTS, `manager-list-${width}.png`), fullPage: true }); }
  await page.getByRole('button', { name: 'New post', exact: true }).click();
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Add a title' }).waitFor();
  assert.equal(writes.length, 0, 'invalid input must not reach API');
  await page.getByLabel('Title', { exact: true }).fill('A duplicate URL');
  await page.getByLabel(/^URL name/).fill('first-post');
  await page.getByLabel('Your writing').fill('New-post collision draft');
  nextFailure = 409;
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await page.getByRole('button', { name: 'Load current post & keep my draft' }).click();
  await page.getByRole('button', { name: 'Recover device draft', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'First post');
  await page.getByRole('button', { name: 'Keep current version', exact: true }).click();
  await page.getByRole('button', { name: 'All posts', exact: true }).click();
  await page.getByRole('button', { name: 'New post', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Phone thought');
  await page.getByLabel('Description', { exact: true }).fill('Written on my phone');
  await page.getByLabel(/^Tags/).fill('mobile, test');
  await page.getByLabel('Your writing', { exact: true }).fill('## Phone preview\n\nMy **thought**.');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('heading', { name: 'Phone preview' }).waitFor();
  await noOverflow(page, width);
  if (process.env.QA_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.QA_SCREENSHOTS, `manager-preview-${width}.png`), fullPage: true });
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.setViewportSize({ width, height: 375 });
  await noOverflow(page, width);
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await page.getByText('Published. Your changes are live on Bathos.', { exact: true }).waitFor();
  await until(() => writes.length === 1, 'create did not reach API');
  assert.equal(writes[0].method, 'POST');
  assert.equal(writes[0].body.slug, 'phone-thought');
  assert.ok(deployments.includes('/api/deployment/commit-1'));
  await page.getByLabel('Title', { exact: true }).fill('Updated phone thought');
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await page.getByText('Published. Your changes are live on Bathos.', { exact: true }).waitFor();
  await until(() => writes.length === 2, 'update did not reach API');
  assert.equal(writes[1].method, 'PUT');
  assert.equal(writes[1].body.sha, 'saved-sha-1');
  await page.setViewportSize({ width, height: 812 });
  await page.getByLabel('Your writing', { exact: true }).fill('Conflict draft stays here');
  nextFailure = 409;
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await page.getByRole('button', { name: 'Load current post & keep my draft' }).waitFor();
  assert.equal(await page.getByLabel('Your writing').inputValue(), 'Conflict draft stays here');
  assert.equal(await page.getByRole('button', { name: 'Save to site', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Load current post & keep my draft' }).click();
  await page.getByRole('button', { name: 'Recover device draft', exact: true }).click();
  assert.equal(await page.getByLabel('Your writing').inputValue(), 'Conflict draft stays here');
  nextFailure = 401;
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await page.getByRole('link', { name: 'Sign in with GitHub' }).waitFor();
  assert.equal(await page.getByLabel('Your writing').inputValue(), 'Conflict draft stays here');
  authenticated = true;
  await page.getByRole('button', { name: 'Check sign-in again' }).click();
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await until(() => writes.length === 3, 'reauthenticated save did not reach API');
  await page.getByText('Saved to GitHub.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  assert.deepEqual(deletes, [], 'cancelled deletion must not call API');
  page.removeAllListeners('dialog');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await page.getByRole('heading', { name: 'First post', exact: true }).waitFor();
  assert.deepEqual(deletes, ['phone-thought']);
  assert.ok(posts.has('first-post') && posts.has('second-post'), 'other posts remain');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('link', { name: 'Sign in with GitHub' }).waitFor();
  await page.getByRole('button', { name: 'Write a device draft' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Offline notebook');
  await page.getByLabel('Your writing').fill('Recover this writing after reload');
  await context.setOffline(true);
  await page.getByText(/You’re offline/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save to site', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Save device draft' }).click();
  await context.setOffline(false);
  await page.reload();
  await page.getByRole('button', { name: 'Write a device draft' }).click();
  await page.getByRole('button', { name: 'Recover device draft', exact: true }).click();
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Offline notebook');
  assert.equal(await page.getByLabel('Your writing').inputValue(), 'Recover this writing after reload');
  await noOverflow(page, width);
  assert.deepEqual(errors, []);
  assert.equal(cmsRequests, 0, 'manager must not request external CMS runtime');
  await context.close();
  console.log(`PASS ${width}px: login, install guidance, list, invalid inputs, preview, create/update SHA, publishing, 409/401 draft preservation, confirmed targeted delete, logout, offline draft recovery, reduced-height overflow`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
