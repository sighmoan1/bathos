import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const maxBytes = 10 * 1024 * 1024;
const maxPixels = 40_000_000;
const formats = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp', '.gif': 'gif' };
const slugPattern = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${label} must be non-empty, single-line text.`);
  }
  return value.trim();
}

function escapeMarkdown(value) {
  return value.replace(/[\\`*_{}\[\]()#+.!<>~|&-]/g, '\\$&');
}

// Reject symlinked destinations so a post or image cannot escape this checkout.
async function checkPath(base, relative) {
  let current = base;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`Symlinked destination: ${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return current;
}

export async function addImage(options, repositoryRoot = root) {
  const { post, file, name, after } = options;
  if (!slugPattern.test(post ?? '')) throw new Error('Post must be an existing article slug (case-sensitive).');
  const stem = name ?? path.basename(file ?? '', path.extname(file ?? ''));
  if (!slugPattern.test(stem)) throw new Error('Name must contain letters, numbers and separating hyphens only.');
  const alt = text(options.alt, 'Alt text');
  const caption = options.caption === undefined ? undefined : text(options.caption, 'Caption');
  const extension = path.extname(file ?? '').toLowerCase();
  if (!formats[extension]) throw new Error('Use a PNG, JPEG, WebP or GIF file; SVG is not supported.');
  const source = await fs.open(file, 'r');
  let bytes;
  try {
    const stat = await source.stat();
    if (!stat.isFile() || stat.size === 0 || stat.size > maxBytes) throw new Error('Image must be a regular file between 1 byte and 10 MiB.');
    bytes = await source.readFile();
    if (bytes.length > maxBytes) throw new Error('Image exceeds 10 MiB.');
  } finally { await source.close(); }
  const decoder = sharp(bytes, { failOn: 'warning', limitInputPixels: maxPixels, animated: true });
  const metadata = await decoder.metadata();
  if (metadata.format !== formats[extension]) throw new Error('Image contents do not match its filename extension.');
  if ((metadata.pages ?? 1) !== 1) throw new Error('Use a still image; animated or multipage files are not supported.');
  // Fully decode before writing, so truncated files are rejected as well as bad headers.
  await decoder.raw().toBuffer();

  const articlePath = await checkPath(repositoryRoot, `content/${post}.md`);
  const article = await fs.readFile(articlePath, 'utf8');
  const directory = await checkPath(repositoryRoot, `public/images/posts/${post}`);
  const destination = await checkPath(repositoryRoot, `public/images/posts/${post}/${stem}${extension}`);
  const url = `/images/posts/${post}/${stem}${extension}`;
  if (article.includes(url)) throw new Error('This image is already referenced in the article.');
  const markdown = `![${escapeMarkdown(alt)}](${url})${caption ? `\n\n*${escapeMarkdown(caption)}*` : ''}`;
  let updated;
  if (after !== undefined) {
    const heading = text(after, 'Heading');
    const lines = article.split('\n');
    const matches = lines.flatMap((line, index) => /^#{1,6} +/.test(line) && line.replace(/^#{1,6} +/, '').replace(/ +#+ *$/, '') === heading ? [index] : []);
    if (matches.length !== 1) throw new Error('Heading must match exactly one Markdown heading in the article.');
    lines.splice(matches[0] + 1, 0, '', markdown);
    updated = lines.join('\n');
  } else {
    updated = `${article.trimEnd()}\n\n${markdown}\n`;
  }
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(destination, bytes, { flag: 'wx' });
  const temporaryArticle = `${articlePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryArticle, updated, { flag: 'wx', mode: (await fs.stat(articlePath)).mode });
    if (await fs.readFile(articlePath, 'utf8') !== article) throw new Error('Article changed while processing; retry with the latest version.');
    await fs.rename(temporaryArticle, articlePath);
  } catch (error) {
    await fs.unlink(destination);
    throw error;
  } finally {
    await fs.rm(temporaryArticle, { force: true });
  }
  return { destination, articlePath, markdown, width: metadata.width, height: metadata.height };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: Object.fromEntries(['post', 'file', 'name', 'alt', 'caption', 'after'].map(key => [key, { type: 'string' }])) });
    const result = await addImage(values);
    console.log(`Added ${result.width} × ${result.height} image to ${result.articlePath}\n\n${result.markdown}`);
  } catch (error) {
    console.error(`blog:add-image: ${error.message}\nUsage: pnpm blog:add-image --post SLUG --file PATH --name NAME --alt "Description" [--caption "Caption"] [--after "Heading"]`);
    process.exitCode = 1;
  }
}
