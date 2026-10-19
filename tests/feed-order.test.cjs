const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/feed-order.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { publicationWeight, weightedShuffle, sessionFeedOrder } = exportsObject;
const now = Date.parse('2026-10-19T00:00:00Z');
const posts = [{slug:'new', date:'2026-10-19'}, {slug:'old', date:'2000-01-01'}, {slug:'undated'}];
const slugs = (items) => Array.from(items, item => item.slug);
function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
function storage(initial = null) { let value = initial; return {getItem: () => value, setItem: (_, next) => { value = next; }}; }

test('publication boost halves in 30 days, stays bounded and handles bad/future dates', () => {
  assert.equal(publicationWeight('2026-10-19', now), 4);
  assert.equal(publicationWeight('2026-09-19', now), 2.5);
  assert.equal(publicationWeight('2026-08-20', now), 1.75);
  for (const date of [undefined, null, '', 'bad']) assert.equal(publicationWeight(date, now), 1);
  assert.equal(publicationWeight('2099-01-01', now), 4);
  assert.ok(publicationWeight('2000-01-01', now) >= 1);
});

test('shuffle returns every article once without mutating input, including empty and singleton decks', () => {
  const input = Object.freeze(posts.slice());
  const result = weightedShuffle(input, now, seeded(1));
  assert.deepEqual(slugs(result).sort(), slugs(input).sort());
  assert.deepEqual(slugs(input), ['new','old','undated']);
  assert.equal(result.length, new Set(result).size);
  assert.equal(weightedShuffle([], now).length, 0);
  assert.equal(weightedShuffle([posts[0]], now, () => 0)[0], posts[0]);
});

test('newer articles win more often but old articles can lead (deterministic simulation)', () => {
  const random = seeded(42);
  let newestFirst = 0;
  for (let i = 0; i < 20000; i++) if (weightedShuffle(posts.slice(0, 2), now, random)[0].slug === 'new') newestFirst++;
  // The exact first-position probability is 4 / (4 + 1) = 80%.
  assert.ok(newestFirst > 15500 && newestFirst < 16500, String(newestFirst));
  assert.equal(weightedShuffle(posts.slice(0, 2), now, (() => { const draws = [.99, .01]; return () => draws.shift(); })())[0].slug, 'old');
});

test('session reuses order without drawing randomness and reconciles removed/new slugs', () => {
  const store = storage();
  const first = sessionFeedOrder(posts, store, now, seeded(4));
  assert.deepEqual(slugs(sessionFeedOrder(posts.slice().reverse(), store, now + 86400000, () => { throw Error('reshuffled'); })), slugs(first));
  const updated = sessionFeedOrder([...posts.filter(p => p.slug !== 'old'), {slug:'added'}], store, now, seeded(3));
  assert.deepEqual(slugs(updated), [...slugs(first).filter(s => s !== 'old'), 'added']);
});

test('corrupt, duplicate, stale and inaccessible session storage cannot hide articles', () => {
  for (const value of ['broken', '{}', '[1]', '["old","old","removed"]']) {
    assert.deepEqual(slugs(sessionFeedOrder(posts, storage(value), now, seeded(1))).sort(), slugs(posts).sort());
  }
  const blocked = {getItem() {throw Error('blocked');}, setItem() {throw Error('blocked');}};
  assert.equal(sessionFeedOrder(posts, blocked, now, seeded(1)).length, posts.length);
  assert.equal(sessionFeedOrder(posts, undefined, now, seeded(1)).length, posts.length);
});
