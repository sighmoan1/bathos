/* Optional browser check: NODE_PATH=/path/to/playwright/node_modules node scripts/check-admin-mobile.cjs */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = { load_config_file: false, backend: { name: 'test-repo' }, media_folder: 'images', collections: [{ name: 'posts', label: 'Posts', folder: 'content', create: true, fields: [
  { name: 'title', label: 'Title', widget: 'string' }, { name: 'description', label: 'Description', widget: 'text' },
  { name: 'date', label: 'Date', widget: 'datetime' }, { name: 'tags', label: 'Tags', widget: 'list' }, { name: 'body', label: 'Body', widget: 'markdown' },
] }] };
(async () => {
  // Download the pinned runtime, then serve locally so the test shares production
  // shell/assets but never signs into GitHub or modifies repository content.
  const bundle = await fetch('https://unpkg.com/decap-cms@3.9.0/dist/decap-cms.js').then(r => { assert.ok(r.ok); return r.text(); });
  const server = http.createServer((req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Content-Type', route.endsWith('.js') ? 'application/javascript; charset=utf-8' : route.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
    if (route === '/decap.js') return res.end(bundle);
    if (route === '/admin/bootstrap.js') return res.end(`CMS.init({config:${JSON.stringify(config)}});`);
    const file = path.join(root, 'public', route === '/admin/' ? 'admin/index.html' : route);
    if (!file.startsWith(path.join(root, 'public') + path.sep) || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    let data = fs.readFileSync(file);
    if (route === '/admin/') data = data.toString().replace(/https:\/\/unpkg\.com\/decap-cms@3\.9\.0\/dist\/decap-cms\.js/, '/decap.js').replace(/ integrity="[^"]*"/g, '');
    res.end(data);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    for (const width of [375, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/admin/`);
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await noOverflow();
      await page.getByRole('link', { name: 'New Posts' }).click();
      await page.locator('input[id^="title-field"]').fill('Phone draft');
      await page.locator('textarea[id^="description-field"]').fill('Written on a phone');
      await page.getByRole('button', { name: 'Now', exact: true }).click();
      await page.locator('input[id^="tags-field"]').fill('mobile');
      await page.locator('[contenteditable=true]').fill('Mobile body');
      await noOverflow();
      await page.getByRole('button', { name: 'Preview post' }).click();
      await page.getByRole('button', { name: 'Edit post' }).waitFor();
      assert.equal(await page.locator('.Pane1').isVisible(), false);
      await noOverflow();
      await page.getByRole('button', { name: 'Edit post' }).click();
      let guarded = false;
      page.once('dialog', async dialog => { guarded = dialog.type() === 'confirm'; await dialog.dismiss(); });
      await page.locator('a[class*="-ToolbarSectionBackLink"]').click();
      assert.ok(guarded);
      assert.match(page.url(), /\/new/);
      assert.equal(await page.locator('input[id^="title-field"]').inputValue(), 'Phone draft');
      await page.setViewportSize({ width, height: 375 });
      await page.waitForTimeout(60);
      assert.ok(await page.locator('[class*="-EditorContainer"] > [class*="-ToolbarContainer"]').evaluate(el => el.getBoundingClientRect().bottom < innerHeight));
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByText('Publish now', { exact: true }).click();
      await page.getByRole('button', { name: 'Delete entry', exact: true }).waitFor();
      await page.setViewportSize({ width, height: 812 });
      await page.locator('input[id^="title-field"]').fill('Updated phone draft');
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByText('Publish now', { exact: true }).click();
      await page.getByText('Changes saved', { exact: true }).waitFor();
      await noOverflow();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Delete entry', exact: true }).click();
      await page.getByText('No Entries', { exact: true }).waitFor();
      await noOverflow();
      if (fs.existsSync(path.join(root, 'public/admin/publishing.js'))) assert.ok(await page.locator('#publishing-status').isVisible());
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: create, preview, unsaved guard, reduced height, publish, update, delete, no overflow`);
      await page.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
