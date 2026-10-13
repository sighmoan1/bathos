import { parse } from 'parse5';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createTransport, publicURL } from './webmention-network.mjs';

export function links(html, pageURL) {
  const root = parse(html); const elements = [];
  function walk(node) {
    if (node.tagName) elements.push(node);
    // Template contents are inert and deliberately excluded.
    for (const child of node.childNodes || []) walk(child);
  }
  walk(root);
  let base = pageURL;
  const firstBase = elements.find(node => node.tagName === 'base' && node.attrs.some(a => a.name === 'href'));
  if (firstBase) { try { base = new URL(firstBase.attrs.find(a => a.name === 'href').value, pageURL).href; } catch {} }
  return elements.filter(node => ['a','link'].includes(node.tagName)).flatMap(node => {
    const attrs = Object.fromEntries(node.attrs.map(a => [a.name,a.value]));
    if (!attrs.href) return [];
    try { return [{ tag: node.tagName, url: new URL(attrs.href, base).href,
      rel: (attrs.rel || '').toLowerCase().split(/\s+/), classes: (attrs.class || '').split(/\s+/) }]; } catch { return []; }
  });
}

export function discoverEndpoint(response) {
  // Delimiters inside quoted parameter values or URI references are data.
  const header = Array.isArray(response.headers.link) ? response.headers.link.join(',') : response.headers.link || '';
  function splitOutside(value, separator) {
    const parts = []; let start = 0; let quoted = false; let angle = false; let escaped = false;
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (quoted && escaped) { escaped = false; continue; }
      if (quoted && char === '\\') { escaped = true; continue; }
      if (char === '"' && !angle) quoted = !quoted;
      if (!quoted && char === '<') angle = true;
      if (!quoted && char === '>') angle = false;
      if (!quoted && !angle && char === separator) { parts.push(value.slice(start,i)); start = i + 1; }
    }
    parts.push(value.slice(start)); return parts;
  }
  for (const value of splitOutside(header, ',')) {
    const [reference,...parameters] = splitOutside(value, ';');
    const uri = reference.match(/^\s*<([^>]*)>\s*$/);
    const rel = parameters.map(parameter => parameter.match(/^\s*rel\s*=\s*(?:"([^"]*)"|([^;\s,]+))\s*$/i)).find(Boolean);
    if (uri && rel && (rel[1] || rel[2]).toLowerCase().split(/\s+/).includes('webmention')) {
      return publicURL(uri[1], response.url).href;
    }
  }
  if (/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers['content-type'] || '')) {
    const endpoint = links(response.body, response.url).find(link => link.rel.includes('webmention'));
    if (endpoint) return publicURL(endpoint.url).href;
  }
  return null;
}

export async function sendWebmention({ source, target, transport = createTransport(), retries = 2,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  source = publicURL(source).href; target = publicURL(target).href;
  if (new URL(source).origin !== 'https://bathos.org') throw new Error('Source must be a canonical https://bathos.org URL');
  if (source === target) throw new Error('Source and target must differ');
  const live = await transport(source);
  if (live.status !== 200 || live.url !== source || !/^text\/html(?:;|$)/i.test(live.headers['content-type'] || '')) {
    throw new Error('Source is unpublished, redirected, or not HTML');
  }
  if (!links(live.body, source).some(link => link.url === target)) throw new Error('Live source does not link to target');
  const destination = await transport(target);
  if (destination.status < 200 || destination.status >= 300) throw new Error(`Target discovery HTTP ${destination.status}`);
  const endpoint = discoverEndpoint(destination);
  if (!endpoint) return { status: 'unsupported', source, target };
  const body = new URLSearchParams({ source, target }).toString();
  for (let attempt = 0; ; attempt++) {
    let result;
    // A transport error may occur after delivery. Leave retry to an explicit operator rerun.
    try { result = await transport(endpoint, { method: 'POST', body }); }
    catch (error) { throw new Error(`Delivery uncertain; inspect receiver before --resend: ${error.message}`); }
    if (result.status >= 200 && result.status < 300) return { status: 'accepted', source, target, endpoint, httpStatus: result.status };
    if (result.status < 500 || attempt >= retries) throw new Error(`Webmention POST HTTP ${result.status}`);
    await sleep(250 * 2 ** attempt);
  }
}

export async function main(args = process.argv.slice(2), { transport = createTransport() } = {}) {
  let source, page, statePath = '.webmentions-sent.json', resend = false;
  const targets = [];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--resend') resend = true;
    else if (['--source','--page','--target','--state'].includes(flag) && args[i+1] && !args[i+1].startsWith('--')) {
      const value = args[++i];
      if (flag === '--source') source = value;
      if (flag === '--page') page = value;
      if (flag === '--target') targets.push(value);
      if (flag === '--state') statePath = value;
    } else throw new Error(`Unknown or incomplete argument: ${flag}`);
  }
  if (!source) throw new Error('Required: --source https://bathos.org/posts/slug/ and --page FILE or --target URL');
  source = publicURL(source).href;
  if (page) targets.push(...links(await readFile(page,'utf8'),source).filter(link => link.classes.includes('u-in-reply-to')).map(link => link.url));
  if (!targets.length) throw new Error('No reply targets; supply --page with u-in-reply-to or --target');
  let state = {};
  try { state = JSON.parse(await readFile(statePath,'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!state || Array.isArray(state) || typeof state !== 'object') throw new Error('Invalid delivery state');
  let failed = false;
  for (const target of new Set(targets.map(value => publicURL(value).href))) {
    const key = createHash('sha256').update(`${source}\n${target}`).digest('hex');
    if (state[key] && !resend) { console.log(JSON.stringify({status:'already-accepted',source,target})); continue; }
    try {
      const result = await sendWebmention({source,target,transport});
      if (result.status === 'accepted') {
        state[key] = {...result, sentAt: new Date().toISOString()};
        await writeFile(`${statePath}.tmp`,JSON.stringify(state,null,2)+'\n',{mode:0o600});
        await rename(`${statePath}.tmp`,statePath);
      }
      console.log(JSON.stringify(result));
    } catch (error) { failed = true; console.error(JSON.stringify({status:'failed',source,target,error:error.message})); }
  }
  if (failed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
