const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pagesHeaders } = require('./helpers/pages-headers.cjs');

test('manager and legacy entry points deny framing without restricting application scripts', () => {
  for (const url of ['/manage', '/manage/', '/manage/index.html', '/manage/other', '/admin', '/admin/', '/admin/index.html']) {
    const headers = pagesHeaders(url);
    assert.equal(headers['content-security-policy'], "frame-ancestors 'none'", url);
    assert.equal(headers['x-frame-options'], 'DENY', url);
  }
  assert.equal(pagesHeaders('/manage/sw.js')['cache-control'], 'no-cache, no-store, must-revalidate');
  for (const url of ['/', '/posts/example/', '/manager/', '/administrator/', '/_next/static/chunk.js']) {
    assert.equal(pagesHeaders(url)['content-security-policy'], undefined, url);
  }
});

test('manager cache version changes for header-only releases', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bathos-manager-headers-'));
  try {
    fs.mkdirSync(path.join(root, 'out/manage'), { recursive: true });
    fs.mkdirSync(path.join(root, 'public/manage'), { recursive: true });
    fs.writeFileSync(path.join(root, 'out/manage/index.html'), '<html><body>Manager</body></html>');
    for (const name of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-icon.png']) fs.writeFileSync(path.join(root, 'out/manage', name), name);
    fs.copyFileSync(path.join(__dirname, '../public/manage/sw.js'), path.join(root, 'public/manage/sw.js'));
    const build = () => {
      execFileSync(process.execPath, [path.join(__dirname, '../scripts/build-manager-pwa.mjs')], { cwd: root });
      return fs.readFileSync(path.join(root, 'out/manage/sw.js'), 'utf8').match(/const CACHE_NAME = "([^"]+)"/)[1];
    };
    fs.writeFileSync(path.join(root, 'public/_headers'), '/manage/*\n  Cache-Control: no-cache\n');
    const before = build();
    assert.equal(build(), before, 'identical releases keep stable cache versions');
    fs.writeFileSync(path.join(root, 'public/_headers'), fs.readFileSync(path.join(__dirname, '../public/_headers')));
    assert.notEqual(build(), before, 'new response policy invalidates cached HTML');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
