/* Build first. Uses compiled site + mocked author API; never writes GitHub.
 * node scripts/check-post-manager.cjs */
const { chromium } = require('@playwright/test');
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
    for (const width of [320, 375, 390]) await mobileFlow(browser, origin, width);
    await checkedPublishingFlow(browser, origin);
    await offlineShell(browser, origin);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
async function checkedPublishingFlow(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 390, height: 812 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  let state = 'pending', saved, submissions = 0, polls = 0;
  const commitSha = 'f'.repeat(40);
  await context.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/session') return json({ authenticated: true, user: { login: 'writer' } });
    if (pathname === '/api/posts' && request.method() === 'GET') return json({ posts: state === 'success' ? [saved] : [] });
    if (pathname === '/api/posts' && request.method() === 'POST') {
      submissions++; saved = { ...request.postDataJSON(), sha: 'e'.repeat(40) };
      return json({ post: saved, commitSha, publication: { number: 13, url: 'https://github.com/sighmoan1/bathos/pull/13', queued: true } });
    }
    if (pathname === '/api/publication/13') {
      polls++; assert.equal(request.method(), 'POST');
      return json({ state, merged: state === 'success', message: state === 'failure' ? 'Publishing checks failed. Your changes are saved in GitHub and your draft is kept.' : 'Your post is saved. Publishing automatically after checks pass…' });
    }
    return json({ error: 'Unexpected request' });
  });
  await page.goto(origin + '/manage/');
  await page.getByRole('button', { name: 'New post', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Checked publication');
  await page.getByLabel('Description', { exact: true }).fill('Published only after CI passes');
  await page.getByLabel('Your writing').fill('A safe queued post');
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await page.getByRole('link', { name: 'View publishing progress' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save to site', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Delete post', exact: true }).isDisabled(), true);
  assert.equal(submissions, 1);
  assert.ok(await page.evaluate(() => !!localStorage.getItem('bathos:post-draft:checked-publication')));
  assert.ok(await page.evaluate(() => !!localStorage.getItem('bathos:pending-publication')));
  await page.reload();
  await page.getByRole('link', { name: 'View publishing progress' }).waitFor();
  await until(() => polls >= 2, 'pending publication did not resume after reload');
  state = 'failure';
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Publishing checks failed. Your changes are saved in GitHub and your draft is kept.' }).waitFor();
  assert.equal(submissions, 1);
  state = 'success';
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Published. Your changes are live on Bathos.' }).waitFor();
  await page.getByRole('heading', { name: 'Checked publication', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('bathos:pending-publication')), null);
  assert.equal(submissions, 1);
  await context.close();
  console.log('PASS checked publishing: one PR submission, pending Save/Delete guard, retained draft, reload recovery, failed checks, successful production confirmation');
}
async function mobileFlow(browser, origin, width) {
  const context = await browser.newContext({ viewport: { width, height: 812 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], writes = [], deletes = [], deployments = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.dismiss());
  let authenticated = false, nextFailure = 0, commitSequence = 0, revisionSequence = 0;
  const nextCommit = () => (++commitSequence).toString(16).padStart(40, '0');
  const nextRevision = () => (++revisionSequence).toString(16).padStart(40, 'd');
  const posts = new Map([
    ['Gassing', { slug: 'Gassing', title: 'Gassing', description: 'Original uppercase filename', date: '2026-10-12', tags: [], inReplyTo: ['https://example.com/original?x=1&y=2'], body: 'Gassing body', sha: 'a'.repeat(40) }],
    ['first-post', { slug: 'first-post', title: 'First post', description: 'Keep this one', date: '2026-10-12', tags: ['test'], body: 'First body', sha: 'b'.repeat(40) }],
    ['second-post', { slug: 'second-post', title: 'Second post', description: 'Another post', date: '2026-10-11', tags: [], body: 'Second body', sha: 'c'.repeat(40) }],
  ]);
  let cmsRequests = 0;
  await context.route('**://unpkg.com/**', route => { cmsRequests++; return route.abort(); });
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
    if (url.pathname === '/api/session') return json({ authenticated, ...(authenticated ? { user: { login: 'phone-writer' } } : {}) });
    if (url.pathname === '/api/logout') { authenticated = false; return json({ ok: true }); }
    if (url.pathname.startsWith('/api/deployment/')) { deployments.push(url.pathname); return json({ state: 'success' }); }
    if (method === 'GET' && url.pathname === '/api/posts') return json({ posts: [...posts.values()], warnings: [{slug: 'broken-post', message: 'Invalid front matter; edit this post in GitHub.'}] });
    const slug = decodeURIComponent(url.pathname.split('/')[3] || '');
    if (method === 'GET') return json(posts.get(slug) || { error: 'Not found' }, posts.has(slug) ? 200 : 404);
    const body = request.postDataJSON();
    if (nextFailure) { const code = nextFailure; nextFailure = 0; if (code === 401) authenticated = false; return json({ error: code === 409 ? 'This post changed. Your draft is safe.' : 'Your session expired. Please sign in again.' }, code); }
    if (method === 'DELETE') {
      assert.equal(body.sha, posts.get(slug).sha, 'delete must use latest saved file SHA');
      deletes.push(slug); posts.delete(slug); return json({ commitSha: nextCommit() });
    }
    if (method === 'PUT') assert.equal(body.sha, posts.get(slug).sha, 'update must use returned file SHA');
    writes.push({ method, slug, body });
    const saved = { ...body, sha: nextRevision() };
    posts.set(body.slug, saved);
    return json({ post: saved, commitSha: nextCommit() });
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
  await page.getByRole('link', {name:'broken-post.md'}).waitFor();
  await page.getByRole('searchbox', {name:'Search posts'}).fill('gassing');
  await page.getByRole('heading', {name:'Gassing',exact:true}).click();
  assert.equal(await page.getByLabel('In reply to', {exact:true}).inputValue(), 'https://example.com/original?x=1&y=2');
  await page.getByLabel('Your writing').fill('Gassing edited from a phone');
  await page.getByRole('button', {name:'Save to site',exact:true}).click();
  await until(() => writes.length === 1, 'uppercase filename could not save');
  assert.equal(writes[0].slug, 'Gassing');
  assert.deepEqual(writes[0].body.inReplyTo, ['https://example.com/original?x=1&y=2']);
  writes.length = 0;
  await page.getByRole('button', {name:'All posts',exact:true}).click();
  await page.getByRole('searchbox', {name:'Search posts'}).fill('');
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
  await page.getByLabel('In reply to', {exact:true}).fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await page.getByRole('alert').filter({hasText:'Reply addresses must use HTTP or HTTPS'}).waitFor();
  assert.equal(writes.length, 0, 'invalid reply address must not reach API');
  await page.getByLabel('In reply to', {exact:true}).fill('https://EXAMPLE.com/original\nhttp://example.net/reply\nhttps://example.com/original');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('heading', { name: 'Phone preview' }).waitFor();
  await noOverflow(page, width);
  if (process.env.QA_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.QA_SCREENSHOTS, `manager-preview-${width}.png`), fullPage: true });
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.setViewportSize({ width, height: 375 });
  await page.getByLabel('Your writing').focus();
  const saveBounds = await page.getByRole('button', {name:'Save to site',exact:true}).boundingBox();
  assert.ok(saveBounds.y >= 0 && saveBounds.y + saveBounds.height <= 375, 'Save stays above keyboard-sized viewport');
  await noOverflow(page, width);
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await until(() => writes.length === 1, 'create did not reach API');
  await until(() => deployments.includes('/api/deployment/' + '2'.padStart(40, '0')), 'new saved commit was not polled');
  await page.getByText('Published. Your changes are live on Bathos.', { exact: true }).waitFor();
  assert.equal(writes[0].method, 'POST');
  assert.equal(writes[0].body.slug, 'phone-thought');
  const createdRevision = posts.get('phone-thought').sha;
  assert.deepEqual(writes[0].body.inReplyTo, ['https://example.com/original', 'http://example.net/reply']);
  assert.ok(deployments.includes('/api/deployment/' + '2'.padStart(40, '0')));
  await page.getByLabel('Title', { exact: true }).fill('Updated phone thought');
  await page.getByLabel('In reply to', {exact:true}).fill('');
  await page.getByRole('button', { name: 'Save to site', exact: true }).click();
  await until(() => writes.length === 2, 'update did not reach API');
  await until(() => deployments.includes('/api/deployment/' + '3'.padStart(40, '0')), 'updated saved commit was not polled');
  await page.getByText('Published. Your changes are live on Bathos.', { exact: true }).waitFor();
  assert.deepEqual(writes[1].body.inReplyTo, [], 'empty field explicitly removes reply targets');
  assert.equal(writes[1].method, 'PUT');
  assert.equal(writes[1].body.sha, createdRevision);
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
  await page.getByLabel('In reply to', {exact:true}).fill('https://example.org/offline-reply');
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
  assert.equal(await page.getByLabel('In reply to', {exact:true}).inputValue(), 'https://example.org/offline-reply');
  assert.equal(await page.getByLabel('Your writing').inputValue(), 'Recover this writing after reload');
  await noOverflow(page, width);
  assert.deepEqual(errors, []);
  assert.equal(cmsRequests, 0, 'manager must not request external CMS runtime');
  await context.close();
  console.log(`PASS ${width}px: login, install guidance, list, invalid inputs, preview, create/update SHA, publishing, 409/401 draft preservation, confirmed targeted delete, logout, offline draft recovery, reduced-height overflow`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
