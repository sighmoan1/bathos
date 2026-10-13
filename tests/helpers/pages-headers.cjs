const fs = require('node:fs');
const path = require('node:path');
// Interpret this site's path-only Pages rules for offline/browser regression checks.
function pagesHeaders(pathname, source = fs.readFileSync(path.join(__dirname, '../../public/_headers'), 'utf8')) {
  const headers = {};
  let matches = false;
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = '^' + line.trim().split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
      matches = new RegExp(pattern).test(pathname);
    } else if (matches) {
      const colon = line.indexOf(':');
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      headers[key] = headers[key] ? headers[key] + ', ' + value : value;
    }
  }
  return headers;
}
module.exports = { pagesHeaders };
