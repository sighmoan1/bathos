import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 2) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6) return false;
  // Only ordinary global unicast; reject mapped IPv4 and transition/special ranges.
  const groups = address.toLowerCase().split(':');
  const first = parseInt(groups[0], 16);
  const second = parseInt(groups[1] || '0', 16);
  return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && first !== 0x3fff &&
    !(first === 0x2001 && (second < 0x200 || second === 0xdb8));
}

export function publicURL(value, base) {
  const url = new URL(value, base);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    (url.port && !['80','443'].includes(url.port)) ||
    hostname === 'localhost' || hostname.endsWith('.localhost') ||
    (isIP(hostname) && !publicAddress(hostname))) throw new Error('Unsafe public HTTP URL');
  url.hash = '';
  return url;
}

export async function resolvePublic(url, lookup = dns.lookup) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] :
    await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({address}) => !publicAddress(address))) {
    throw new Error('DNS returned a non-public address');
  }
  return addresses[0];
}

export function createTransport({ lookup = dns.lookup, request = (url, options, callback) =>
  (url.protocol === 'https:' ? https : http).request(url, options, callback), timeoutMs = 10000,
  maxBytes = 1024 * 1024, maxRedirects = 5 } = {}) {
  return async function transport(value, { method = 'GET', body } = {}) {
    let url = publicURL(value);
    for (let hops = 0; ; hops++) {
      let timer;
      const selected = await Promise.race([
        resolvePublic(url, lookup),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')), timeoutMs); })
      ]).finally(() => clearTimeout(timer));
      const result = await new Promise((resolve, reject) => {
        const headers = { 'User-Agent': 'Bathos-Webmention/1.0', Accept: 'text/html, */*;q=0.1', 'Accept-Encoding': 'identity' };
        if (body !== undefined) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          headers['Content-Length'] = Buffer.byteLength(body);
        }
        // Never perform a second DNS lookup: the validated IP is pinned to this socket.
        const req = request(url, { method, headers, agent: false,
          lookup: (_hostname, options, callback) => {
            if (options.all) callback(null, [selected]);
            else callback(null, selected.address, selected.family);
          } }, response => {
          const chunks = []; let size = 0;
          response.on('data', chunk => {
            size += chunk.length;
            if (size > maxBytes) req.destroy(new Error('Response exceeds body limit'));
            else chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'), url: url.href }));
        });
        const deadline = setTimeout(() => req.destroy(new Error('Request timeout')), timeoutMs);
        req.on('error', reject);
        req.on('close', () => clearTimeout(deadline));
        req.end(body);
      });
      if (![301,302,303,307,308].includes(result.status)) return result;
      if (!result.headers.location || hops >= maxRedirects) throw new Error('Redirect limit or missing location');
      if (method === 'POST' && ![307,308].includes(result.status)) throw new Error('Endpoint redirect would discard POST');
      const next = publicURL(result.headers.location, url);
      if (url.protocol === 'https:' && next.protocol === 'http:') throw new Error('HTTPS downgrade redirect');
      url = next;
    }
  };
}
