import ipaddr from 'ipaddr.js';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function publicURL(value) {
  if (typeof value !== "string" || !value) throw new HttpError(400, "Invalid URL");
  let url;
  try { url = new URL(value); } catch { throw new HttpError(400, 'Invalid URL'); }
  if (value.length > 2048 || url.href.length > 2048 || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || url.hash || !url.hostname.includes('.') || url.hostname.endsWith('.')) throw new HttpError(400, 'Unsafe URL');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(host) || /(?:^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)) throw new HttpError(400, 'Unsafe host');
  return url;
}
export function publicIP(value) {
  try { const address = ipaddr.parse(value); return address.range() === 'unicast'; } catch { return false; }
}
export async function boundedText(response, maximum) {
  if (Number(response.headers.get('content-length')) > maximum) throw new HttpError(413, 'Body too large');
  const reader = response.body?.getReader();
  if (!reader) return '';
  const parts = []; let size = 0;
  let timer;
  const deadline = new Promise((_, reject) => { timer=setTimeout(() => { reader.cancel().catch(() => {}); reject(new HttpError(408,'Body read timeout')); },8000); });
  try {
    for (;;) { const {done,value} = await Promise.race([reader.read(),deadline]); if (done) break; size += value.byteLength; if (size > maximum) throw new HttpError(413, 'Body too large'); parts.push(value); }
  } finally { clearTimeout(timer); await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(bytes);
}
async function checkDNS(host, fetcher, signal) {
  let count = 0;
  for (const type of ['A','AAAA']) {
    const reply = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {headers:{accept:'application/dns-json'}, redirect:'manual', signal});
    if (!reply.ok) throw new HttpError(422, 'DNS lookup failed');
    const data = JSON.parse(await boundedText(reply, 16384));
    if (data.Status !== 0) throw new HttpError(422, 'DNS lookup failed');
    for (const answer of data.Answer || []) if ([1,28].includes(answer.type)) { count++; if (!publicIP(answer.data)) throw new HttpError(422, 'Non-public DNS address'); }
  }
  if (!count) throw new HttpError(422, 'No public DNS address');
}
export async function safeHTML(value, fetcher = fetch) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let url = publicURL(value);
    for (let hop=0; hop<=3; hop++) {
      await checkDNS(url.hostname, fetcher, controller.signal);
      const response = await fetcher(url.href, {method:'GET', redirect:'manual', cache:'no-store', signal:controller.signal, headers:{accept:'text/html', 'user-agent':'Bathos-Webmention/1.0'}});
      if ([301,302,303,307,308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location || hop === 3) throw new HttpError(422, 'Redirect limit');
        url = publicURL(new URL(location, url).href); continue;
      }
      if ([404,410].includes(response.status)) { await response.body?.cancel(); return {gone:true, url:url.href}; }
      if (!response.ok || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw new HttpError(422, 'Expected published HTML'); }
      return {html:await boundedText(response,262144), url:url.href};
    }
  } catch(error) { if (error instanceof HttpError) throw error; throw new HttpError(422, 'Source verification failed'); }
  finally { clearTimeout(timer); }
}
export async function digest(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))), x=>x.toString(16).padStart(2,'0')).join(''); }
export async function authenticated(request, secret) {
  if (!secret || secret.length < 32) return false;
  const [provided, expected] = await Promise.all([digest(request.headers.get('authorization') || ''),digest(`Bearer ${secret}`)]);
  return crypto.subtle.timingSafeEqual(new TextEncoder().encode(provided),new TextEncoder().encode(expected));
}
