import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const matter = require('gray-matter');
test('admin redirects to the manager and exposes no obsolete browser-token client assets',()=>{
 const directory=new URL('../../public/admin/',import.meta.url);
 assert.deepEqual(fs.readdirSync(directory),['index.html']);
 const html=fs.readFileSync(new URL('index.html',directory),'utf8');
 assert.match(html,/url=\/manage\//);assert.doesNotMatch(html,/<script|decap/i);
});
test('existing Markdown retains the manager content model',()=>{
 const directory=new URL('../../content/',import.meta.url);
 for(const file of fs.readdirSync(directory).filter(file=>file.endsWith('.md'))){
  const post=matter(fs.readFileSync(new URL(file,directory),'utf8'));
  assert.equal(typeof post.data.title,'string');assert.equal(typeof post.data.description,'string');
  assert.match(String(post.data.date),/^\d{4}-\d{2}-\d{2}$/);assert.ok(Array.isArray(post.data.tags));assert.ok(post.content.trim());
 }
});
