const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bathos-image-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content'));
  await fs.writeFile(path.join(root, 'content/Gassing.md'), '---\ntitle: Gassing\n---\n\n## Example\n\nOriginal text.\n');
  const file = path.join(root, 'source.png');
  await sharp({ create: { width: 2, height: 3, channels: 3, background: 'red' } }).png().toFile(file);
  const { addImage } = await import('../scripts/blog-add-image.mjs');
  return { root, file, addImage, options: { post: 'Gassing', file, name: 'example', alt: 'A [red] rectangle <example>', caption: 'Source *example*', after: 'Example' } };
}

test('copies original bytes and inserts escaped alt and caption after a case-sensitive heading', async t => {
  const { root, file, addImage, options } = await fixture(t);
  const result = await addImage(options, root);
  assert.deepEqual(await fs.readFile(result.destination), await fs.readFile(file));
  const article = await fs.readFile(result.articlePath, 'utf8');
  assert.ok(article.includes('## Example\n\n![A \\[red\\] rectangle \\<example\\>](/images/posts/Gassing/example.png)\n\n*Source \\*example\\**\n\nOriginal text.'));
  await assert.rejects(addImage(options, root), /already referenced/);
});

test('no caption appends Markdown; existing assets are never overwritten', async t => {
  const { root, addImage, options } = await fixture(t);
  delete options.after; delete options.caption;
  const result = await addImage(options, root);
  assert.ok((await fs.readFile(result.articlePath, 'utf8')).endsWith(result.markdown + '\n'));
  await fs.writeFile(result.articlePath, 'Original.\n');
  await assert.rejects(addImage(options, root), /EEXIST/);
  assert.equal(await fs.readFile(result.articlePath, 'utf8'), 'Original.\n');
});

test('rejects unsafe names, absent alt, missing or duplicate headings and symlink destinations without changing article', async t => {
  const { root, addImage, options } = await fixture(t);
  const article = path.join(root, 'content/Gassing.md');
  const before = await fs.readFile(article, 'utf8');
  for (const override of [{ post: '../escape' }, { name: '../escape' }, { alt: '' }, { alt: 'line\nbreak' }, { after: 'Missing' }]) {
    await assert.rejects(addImage({ ...options, ...override }, root));
    assert.equal(await fs.readFile(article, 'utf8'), before);
  }
  await fs.writeFile(article, before + '\n## Example\n');
  await assert.rejects(addImage(options, root), /exactly one/);
  await fs.writeFile(article, before);
  await fs.symlink(os.tmpdir(), path.join(root, 'public'));
  await assert.rejects(addImage(options, root), /Symlinked/);
});

test('rejects disguised, truncated, oversized and animated files before publishing', async t => {
  const { root, file, addImage, options } = await fixture(t);
  const valid = await fs.readFile(file);
  await fs.writeFile(file, '<svg><script>alert(1)</script></svg>');
  await assert.rejects(addImage(options, root));
  await fs.writeFile(file, valid.subarray(0, 40));
  await assert.rejects(addImage(options, root));
  await fs.writeFile(file, Buffer.alloc(10 * 1024 * 1024 + 1));
  await assert.rejects(addImage(options, root), /10 MiB/);
  await fs.writeFile(file, valid);
  const fake = path.join(root, 'source.jpg');
  await fs.writeFile(fake, valid);
  await assert.rejects(addImage({ ...options, file: fake }, root), /do not match/);
  const animated = path.join(root, 'animated.gif');
  const frames = Buffer.alloc(2 * 6 * 3, 255);
  frames.fill(0, 0, 2 * 3 * 3);
  await sharp(frames, { raw: { width: 2, height: 6, channels: 3, pageHeight: 3 } }).gif().toFile(animated);
  await assert.rejects(addImage({ ...options, file: animated }, root), /still image/);
  await assert.rejects(fs.access(path.join(root, 'public')));
});
