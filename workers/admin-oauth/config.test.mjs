import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const matter = require('gray-matter');
const config = matter(`---\n${fs.readFileSync(new URL('../../public/admin/config.yml',import.meta.url),'utf8')}\n---`).data;
test('CMS preserves existing Markdown fields, branch and filename model',()=>{
 assert.equal(config.backend.repo,'sighmoan1/bathos');assert.equal(config.backend.branch,'main');assert.equal(config.backend.auth_scope,'repo');
 const collection=config.collections[0];
 assert.equal(collection.folder,'content');assert.equal(collection.extension,'md');assert.equal(collection.create,true);assert.equal(collection.delete,true);
 assert.deepEqual(collection.fields.map(field=>field.name),['title','description','date','tags','body']);
 const directory=new URL('../../content/',import.meta.url);
 for(const file of fs.readdirSync(directory).filter(file=>file.endsWith('.md'))){
  const post=matter(fs.readFileSync(new URL(file,directory),'utf8'));
  assert.equal(typeof post.data.title,'string');assert.equal(typeof post.data.description,'string');
  assert.match(String(post.data.date),/^\d{4}-\d{2}-\d{2}$/);assert.ok(Array.isArray(post.data.tags));assert.ok(post.content.trim());
 }
});
