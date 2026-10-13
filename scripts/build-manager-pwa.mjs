import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = path.resolve("out");
const html = await fs.readFile(path.join(root, "manage/index.html"), "utf8");
const assets = new Set(["/manage/", "/manage/manifest.webmanifest", "/manage/icon-192.png", "/manage/icon-512.png", "/manage/apple-icon.png"]);
for (const match of html.matchAll(/(?:src|href)="([^"?#]+)[^"]*"/g)) {
  if (match[1].startsWith("/_next/static/")) assets.add(match[1].replaceAll("&amp;", "&"));
}
for (const asset of [...assets].filter(asset => asset.endsWith(".css"))) {
  const css = await fs.readFile(path.join(root, asset), "utf8");
  for (const match of css.matchAll(/url\(["']?([^\)"']+)["']?\)/g)) {
    const url = new URL(match[1], "https://bathos.org" + asset);
    if (url.origin === "https://bathos.org" && url.pathname.startsWith("/_next/static/")) assets.add(url.pathname);
  }
}
const digest = createHash("sha256").update(html);
// Refresh cached HTML when response security headers change, even if its body does not.
digest.update(await fs.readFile("public/_headers"));
for (const asset of [...assets].sort()) {
  if (asset !== "/manage/") digest.update(await fs.readFile(path.join(root, asset)));
}
const template = await fs.readFile("public/manage/sw.js", "utf8");
const sw = template.replace(/const CACHE_NAME = .*?;/, `const CACHE_NAME = "bathos-manager-${digest.digest("hex").slice(0, 16)}";`)
  .replace(/const PRECACHE = .*?;/, `const PRECACHE = ${JSON.stringify([...assets].sort())};`);
await fs.writeFile(path.join(root, "manage/sw.js"), sw);
console.log(`Post manager offline shell: ${assets.size} local assets.`);
