// The record contains witnesses' attributions, not a database of somebody's mind.
export const ENTRY_KINDS = ['reading', 'connection', 'question', 'challenge', 'perspective', 'clarification'];
const idPattern = /^[a-z0-9][a-z0-9-]{0,99}$/;
const validId = value => typeof value === 'string' && idPattern.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 12000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const list = (value, max) => Array.isArray(value) && value.length <= max;
const normalise = value => value.replace(/\s+/g, ' ').trim();
const fail = message => { throw new Error(`Invalid brain ledger: ${message}`); };
const unique = (values, label) => { if (new Set(values).size !== values.length) fail(`duplicate ${label}`); };
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z');

export function validateLedger(ledger) {
  if (!object(ledger) || ledger.version !== 1 || !list(ledger.readers, 1000) || !list(ledger.threads, 500) || !list(ledger.entries, 10000)) fail('version or collections');
  for (const reader of ledger.readers) {
    if (!object(reader) || !validId(reader.id) || !text(reader.name, 200) || !text(reader.provenance, 2000) || !text(reader.run, 200) || !text(reader.model, 200)) fail('reader provenance');
  }
  unique(ledger.readers.map(reader => reader.id), 'reader');
  for (const thread of ledger.threads) {
    if (!object(thread) || !validId(thread.id) || !text(thread.title, 200) || !text(thread.summary, 2000) || !(thread.issue === null || (Number.isSafeInteger(thread.issue) && thread.issue > 0))) fail('thread');
  }
  unique(ledger.threads.map(thread => thread.id), 'thread');
  const readers = new Set(ledger.readers.map(reader => reader.id));
  const threads = new Set(ledger.threads.map(thread => thread.id));
  const preceding = new Map();
  for (const entry of ledger.entries) {
    if (!object(entry) || !validId(entry.id) || preceding.has(entry.id) || !readers.has(entry.reader) || !threads.has(entry.thread) || !ENTRY_KINDS.includes(entry.kind) || !date(entry.createdAt) || !text(entry.text) || !text(entry.scope, 1000) || !list(entry.sources, 12) || !list(entry.repliesTo, 20) || !list(entry.revises, 20)) fail('entry, date or references');
    if (!entry.sources.length && entry.kind !== 'clarification') fail('an interpretation needs evidence');
    for (const source of entry.sources) {
      if (!object(source) || typeof source.slug !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(source.slug) || !text(source.quote, 4000) || !/^[a-f0-9]{40}$/.test(source.revision) || (source.blob !== undefined && !/^[a-f0-9]{40}$/.test(source.blob))) fail('source quotation or immutable revision');
    }
    for (const ref of [...entry.repliesTo, ...entry.revises]) if (!preceding.has(ref)) fail('references must point to earlier records');
    for (const ref of entry.revises) {
      const prior = preceding.get(ref);
      if (prior.reader !== entry.reader || prior.thread !== entry.thread || prior.createdAt > entry.createdAt) fail('a reader may revise only its own earlier reading in the same thread');
    }
    if (entry.kind === 'clarification') {
      if (!text(entry.attributedTo, 200) || !text(entry.testimonyUrl, 500) || !/^https:\/\/github\.com\/sighmoan1\/bathos\/issues\/\d+#issuecomment-\d+$/.test(entry.testimonyUrl)) fail('reported clarifications require a public comment source and explicit attribution');
    }
    preceding.set(entry.id, entry);
  }
  return ledger;
}

export function articleSlugFromUrl(value) {
  try {
    const url = new URL(value, 'https://bathos.org');
    if (url.origin !== 'https://bathos.org') return null;
    const match = url.pathname.match(/^\/(?:posts|read)\/([^/]+)\/(?:index\.md)?$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

export function buildBrain(ledger, articles, explicitLinks = []) {
  validateLedger(ledger);
  const bySlug = new Map(articles.map(article => [article.slug, article]));
  const revised = new Set(ledger.entries.flatMap(entry => entry.revises));
  const entries = ledger.entries.map(entry => ({
    ...entry,
    url: `https://bathos.org/brain/#${entry.id}`,
    revised: revised.has(entry.id),
    sources: entry.sources.map(source => {
      const article = bySlug.get(source.slug);
      return {
        ...source,
        title: article?.title || source.slug,
        url: `https://bathos.org/posts/${encodeURIComponent(source.slug)}/`,
        revisionUrl: `https://github.com/sighmoan1/bathos/blob/${source.revision}/content/${encodeURIComponent(source.slug)}.md`,
        status: !article ? 'missing' : (source.blob && article.blob !== source.blob) || !normalise(article.content).includes(normalise(source.quote)) ? 'changed' : 'present',
        quotePresent: !!article && normalise(article.content).includes(normalise(source.quote)),
      };
    }),
  }));
  const links = [...new Map(explicitLinks.filter(link => bySlug.has(link.from) && bySlug.has(link.to) && link.from !== link.to).map(link => [`${link.from}\u0000${link.to}`, { from: link.from, to: link.to }])).values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const threads = ledger.threads.map(thread => ({ ...thread, url: `https://bathos.org/brain/#${thread.id}`, discussionUrl: thread.issue ? `https://github.com/sighmoan1/bathos/issues/${thread.issue}` : null, entryIds: entries.filter(entry => entry.thread === thread.id).map(entry => entry.id) }));
  return {
    version: 1,
    principle: 'These are attributed readings, not verified beliefs. Publication, recency, account identity, silence and AI agreement do not establish human endorsement. Read sources and live replies before attributing a current commitment.',
    updatedAt: entries.map(entry => entry.createdAt).sort().at(-1) || null,
    guideUrl: 'https://bathos.org/brain-agent.md',
    readers: ledger.readers,
    threads,
    entries,
    links,
    articles: [...articles].sort((a, b) => a.slug.localeCompare(b.slug)).map(article => ({ slug: article.slug, title: article.title, url: `https://bathos.org/posts/${encodeURIComponent(article.slug)}/`, backlinks: links.filter(link => link.to === article.slug).map(link => link.from), threads: threads.filter(thread => entries.some(entry => entry.thread === thread.id && entry.sources.some(source => source.slug === article.slug))).map(thread => thread.id) })),
  };
}
